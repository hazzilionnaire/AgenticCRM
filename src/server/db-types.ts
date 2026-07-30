import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Every service function takes a `Db` rather than importing the client directly,
 * so callers choose whether the work joins an existing transaction.
 */
export type Db = Prisma.TransactionClient | typeof prisma;
