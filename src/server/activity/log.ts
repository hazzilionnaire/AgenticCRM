import { ActivityType } from "@/generated/prisma/enums";
import type { Db } from "@/server/db-types";

export interface LogEntry {
  companyId: string;
  actorId?: string | null;
  type: ActivityType;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(db: Db, entry: LogEntry) {
  return db.activityLog.create({
    data: {
      companyId: entry.companyId,
      actorId: entry.actorId ?? null,
      type: entry.type,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      metadata: (entry.metadata ?? undefined) as never,
    },
  });
}

export async function logActivities(db: Db, entries: LogEntry[]) {
  if (entries.length === 0) return;
  await db.activityLog.createMany({
    data: entries.map((entry) => ({
      companyId: entry.companyId,
      actorId: entry.actorId ?? null,
      type: entry.type,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      metadata: (entry.metadata ?? undefined) as never,
    })),
  });
}

/** Renders a value for the change log. Dates and Decimals need coercing first. */
export function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    // Prisma Decimal and anything else with a meaningful toString.
    if ("toString" in value && typeof value.toString === "function") {
      const s = value.toString();
      if (s !== "[object Object]") return s;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Diffs a patch against the current row and returns one FIELD_CHANGED entry per
 * field that actually moved. Keys absent from the patch are untouched, so a
 * partial update never logs phantom changes.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  patch: Partial<T>,
  options: { companyId: string; actorId?: string | null; skip?: Set<string> } = {
    companyId: "",
  },
): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const [key, nextRaw] of Object.entries(patch)) {
    if (options.skip?.has(key)) continue;
    if (nextRaw === undefined) continue;

    const prev = stringifyValue(before[key]);
    const next = stringifyValue(nextRaw);
    if (prev === next) continue;

    entries.push({
      companyId: options.companyId,
      actorId: options.actorId,
      type: ActivityType.FIELD_CHANGED,
      field: key,
      oldValue: prev,
      newValue: next,
    });
  }
  return entries;
}
