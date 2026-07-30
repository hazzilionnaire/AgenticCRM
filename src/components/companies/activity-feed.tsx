import type { ActivityType } from "@/generated/prisma/enums";
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  EMPLOYEE_BAND_LABELS,
  LEAD_SOURCE_LABELS,
  LIFECYCLE_STAGE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PAYMENT_TERMS_LABELS,
  REVENUE_BAND_LABELS,
  WORKFLOW_STAGE_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { tierLabel } from "@/server/tiering/calculate-tier";
import { Badge, EmptyState } from "@/components/ui/primitives";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: unknown;
  createdAt: string | Date;
  actor: { id: string; name: string | null; email: string } | null;
}

/** Human labels for the field names stored in the change log. */
const FIELD_LABELS: Record<string, string> = {
  legalName: "Legal name",
  dbaName: "DBA name",
  industryId: "Industry",
  companyType: "Company type",
  parentId: "Parent company",
  dunsNumber: "DUNS number",
  taxId: "Tax ID",
  websiteDomain: "Website domain",
  employeeBand: "Employee count",
  annualRevenueExact: "Annual revenue (exact)",
  annualRevenueBand: "Annual revenue (band)",
  locationCount: "Locations",
  ownershipType: "Ownership type",
  ownerId: "Account owner",
  lifecycleStage: "Lifecycle stage",
  accountStatus: "Account status",
  customerSince: "Customer since",
  leadSource: "Lead source",
  tcv: "TCV",
  acv: "ACV",
  paymentTerms: "Payment terms",
  creditRating: "Credit rating",
  renewalDate: "Renewal date",
  workflowStage: "Workflow stage",
  tier: "Tier",
  phone: "Phone",
  emailDomain: "Email domain",
  timeZone: "Time zone",
  collaborators: "Collaborators",
};

const ENUM_LABELS: Record<string, Record<string, string>> = {
  employeeBand: EMPLOYEE_BAND_LABELS,
  annualRevenueBand: REVENUE_BAND_LABELS,
  companyType: COMPANY_TYPE_LABELS,
  ownershipType: OWNERSHIP_TYPE_LABELS,
  lifecycleStage: LIFECYCLE_STAGE_LABELS,
  accountStatus: ACCOUNT_STATUS_LABELS,
  leadSource: LEAD_SOURCE_LABELS,
  paymentTerms: PAYMENT_TERMS_LABELS,
  workflowStage: WORKFLOW_STAGE_LABELS,
};

const TYPE_TONE: Record<string, "neutral" | "blue" | "green" | "amber" | "violet" | "red"> = {
  COMPANY_CREATED: "green",
  FIELD_CHANGED: "neutral",
  WORKFLOW_STAGE_CHANGED: "blue",
  OWNER_ASSIGNED: "violet",
  TIER_RECALCULATED: "amber",
  COLLABORATOR_ADDED: "violet",
  SUPPORT_OFFER_DISMISSED: "neutral",
  COMPANY_DELETED: "red",
  COMPANY_RESTORED: "green",
};

const MONEY_FIELDS = new Set(["annualRevenueExact", "tcv", "acv"]);
const DATE_FIELDS = new Set(["customerSince", "renewalDate"]);

function renderValue(
  field: string | null,
  value: string | null,
  names: Record<string, string>,
) {
  if (value === null || value === "") return <span className="text-[var(--muted)]">empty</span>;
  if (field === "tier") return `Tier ${value} · ${tierLabel(Number(value))}`;
  if (field && MONEY_FIELDS.has(field)) return formatCurrency(value);
  if (field && DATE_FIELDS.has(field)) return formatDate(value);
  if (field && ENUM_LABELS[field]?.[value]) return ENUM_LABELS[field][value];
  // FKs are stored as IDs; swap in the display name when we have one.
  if (names[value]) return names[value];
  if (value.length > 60) return `${value.slice(0, 60)}…`;
  return value;
}

function describe(entry: ActivityEntry, names: Record<string, string>) {
  switch (entry.type) {
    case "COMPANY_CREATED":
      return <>Company created</>;
    case "COMPANY_DELETED":
      return <>Company deleted</>;
    case "COMPANY_RESTORED":
      return <>Company restored</>;
    case "COLLABORATOR_ADDED":
      return (
        <>
          Added {renderValue(null, entry.newValue, names)} as tier support
        </>
      );
    case "SUPPORT_OFFER_DISMISSED":
      return <>Declined the suggested tier support rep</>;
    case "TIER_RECALCULATED":
      return (
        <>
          Tier recalculated: {renderValue("tier", entry.oldValue, names)} →{" "}
          <strong>{renderValue("tier", entry.newValue, names)}</strong>
        </>
      );
    case "OWNER_ASSIGNED":
      return (
        <>
          Account owner set to <strong>{renderValue(null, entry.newValue, names)}</strong>
        </>
      );
    default: {
      const label = entry.field ? (FIELD_LABELS[entry.field] ?? entry.field) : "Field";
      return (
        <>
          <strong>{label}</strong>: {renderValue(entry.field, entry.oldValue, names)} →{" "}
          <strong>{renderValue(entry.field, entry.newValue, names)}</strong>
        </>
      );
    }
  }
}

export function ActivityFeed({
  entries,
  names,
}: {
  entries: ActivityEntry[];
  /** id → display name, for resolving FK values (owners, industries, parents). */
  names: Record<string, string>;
}) {
  if (entries.length === 0) {
    return <EmptyState title="No activity yet" hint="Edits and stage changes appear here." />;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <div className="pt-0.5">
            <Badge tone={TYPE_TONE[entry.type] ?? "neutral"}>
              {entry.type.replaceAll("_", " ").toLowerCase()}
            </Badge>
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words">{describe(entry, names)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {entry.actor ? (entry.actor.name ?? entry.actor.email) : "System"} ·{" "}
              {formatDateTime(entry.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
