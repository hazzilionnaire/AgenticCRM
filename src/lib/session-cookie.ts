/**
 * Isolated so middleware (Edge runtime) can read the cookie name without
 * pulling in Prisma, bcrypt or anything else from `@/lib/auth`.
 */
export const SESSION_COOKIE_NAME = "crm_session";
