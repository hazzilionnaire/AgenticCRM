import { z } from "zod";
import {
  AccountStatus,
  CompanyType,
  EmployeeBand,
  LeadSource,
  LifecycleStage,
  OwnershipType,
  PaymentTerms,
  RevenueBand,
  WorkflowStage,
} from "@/generated/prisma/enums";

/** "" from an HTML form means "cleared", which is null in the DB, not "". */
const optionalString = z
  .string()
  .trim()
  .max(255)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z
    .union([z.enum(Object.values(values) as [string, ...string[]]), z.literal("")])
    .transform((v) => (v === "" ? null : (v as T[keyof T])))
    .nullable()
    .optional();

const optionalDecimal = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    if (v === "" || v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a non-negative number" });
      return z.NEVER;
    }
    return n;
  })
  .nullable()
  .optional();

const optionalInt = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    if (v === "" || v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a non-negative whole number" });
      return z.NEVER;
    }
    return n;
  })
  .nullable()
  .optional();

const optionalDate = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    if (v === "" || v === null) return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  })
  .nullable()
  .optional();

/**
 * Note what is absent: `tier`, `tierCalculatedAt`, and the engagement rollups.
 * Those are derived server-side and are not writable through the API at all.
 */
export const companyWritableSchema = z.object({
  // Core identity
  legalName: z.string().trim().min(1, "Legal name is required").max(255),
  dbaName: optionalString,
  industryId: optionalString,
  companyType: z.enum(Object.values(CompanyType) as [string, ...string[]]).optional(),
  parentId: optionalString,
  dunsNumber: optionalString,
  taxId: optionalString,
  websiteDomain: optionalString,

  // Size & segmentation
  employeeBand: optionalEnum(EmployeeBand),
  annualRevenueExact: optionalDecimal,
  annualRevenueBand: optionalEnum(RevenueBand),
  currency: z.string().trim().length(3).optional(),
  locationCount: optionalInt,
  ownershipType: optionalEnum(OwnershipType),

  // Contact & location
  billingStreet1: optionalString,
  billingStreet2: optionalString,
  billingCity: optionalString,
  billingState: optionalString,
  billingPostal: optionalString,
  billingCountry: optionalString,
  shippingStreet1: optionalString,
  shippingStreet2: optionalString,
  shippingCity: optionalString,
  shippingState: optionalString,
  shippingPostal: optionalString,
  shippingCountry: optionalString,
  phone: optionalString,
  emailDomain: optionalString,
  timeZone: optionalString,

  // Relationship & lifecycle
  ownerId: optionalString,
  lifecycleStage: z.enum(Object.values(LifecycleStage) as [string, ...string[]]).optional(),
  accountStatus: z.enum(Object.values(AccountStatus) as [string, ...string[]]).optional(),
  customerSince: optionalDate,
  leadSource: optionalEnum(LeadSource),

  // Financial
  tcv: optionalDecimal,
  acv: optionalDecimal,
  paymentTerms: optionalEnum(PaymentTerms),
  creditRating: optionalString,
  renewalDate: optionalDate,
});

export const createCompanySchema = companyWritableSchema;
export const updateCompanySchema = companyWritableSchema.partial();

export const workflowTransitionSchema = z.object({
  stage: z.enum(Object.values(WorkflowStage) as [string, ...string[]]),
  note: z.string().trim().max(500).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ─────────────────────────── List query parameters ──────────────────────────

const csv = (values: Record<string, string>) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s in values)
        : [],
    );

export const SORTABLE_FIELDS = [
  "legalName",
  "tier",
  "employeeBand",
  "annualRevenueExact",
  "lifecycleStage",
  "owner",
  "industry",
  "workflowStage",
  "createdAt",
  "lastActivityAt",
] as const;

export const companyListQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  industryIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  employeeBands: csv(EmployeeBand),
  revenueBands: csv(RevenueBand),
  revenueMin: z.coerce.number().nonnegative().optional(),
  revenueMax: z.coerce.number().nonnegative().optional(),
  tiers: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => [1, 2, 3, 4].includes(n))
        : [],
    ),
  lifecycleStages: csv(LifecycleStage),
  workflowStages: csv(WorkflowStage),
  companyTypes: csv(CompanyType),
  accountStatuses: csv(AccountStatus),
  ownerIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  sort: z.enum(SORTABLE_FIELDS).default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  includeDeleted: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
