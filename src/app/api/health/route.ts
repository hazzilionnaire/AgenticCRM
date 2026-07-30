import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * TEMPORARY deployment diagnostic. Reports which precondition a sign-in needs
 * but doesn't have — env vars present, schema migrated, users seeded — without
 * echoing any secret value. Delete this route once the deployment is healthy;
 * it is deliberately unauthenticated, so it must not outlive the debugging.
 */

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

export async function GET() {
  const authSecret = process.env.AUTH_SECRET;

  return NextResponse.json({
    env: {
      DATABASE_URL: {
        set: Boolean(process.env.DATABASE_URL),
        // Whether the pg driver will negotiate TLS, which hosted Postgres requires.
        sslmodeInUrl: (process.env.DATABASE_URL ?? "").includes("sslmode="),
      },
      AUTH_SECRET: {
        set: Boolean(authSecret),
        // getSession/createSession throw below 32 characters.
        longEnough: (authSecret?.length ?? 0) >= 32,
      },
    },
    database: {
      connects: await check(() => prisma.$queryRaw`SELECT 1`),
      userTable: await check(() => prisma.user.count()),
      industryTable: await check(() => prisma.industry.count()),
    },
  });
}
