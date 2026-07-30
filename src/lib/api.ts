import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";
import { AiNotConfiguredError } from "@/server/ai/draft-intro-email";
import { CompanyError } from "@/server/companies/service";
import { NotificationError } from "@/server/notifications/service";

/**
 * One place that decides how a thrown error becomes a response, so route
 * handlers stay free of try/catch boilerplate.
 */
export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  if (
    error instanceof UnauthorizedError ||
    error instanceof CompanyError ||
    error instanceof NotificationError ||
    error instanceof AiNotConfiguredError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Prisma Decimal and Date don't survive JSON cleanly. Decimals become strings so
 * precision isn't lost to a float round-trip.
 */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v && typeof v === "object" && "toFixed" in v && typeof v.toFixed === "function") {
        return v.toString();
      }
      return v;
    }),
  );
}
