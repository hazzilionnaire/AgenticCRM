/**
 * Display labels for enum values. Client-safe: imports only the generated enum
 * constants, never the Prisma client itself.
 */
import {
  AccountStatus,
  CompanyType,
  EmployeeBand,
  LeadSource,
  LifecycleStage,
  OwnershipType,
  PaymentTerms,
  RevenueBand,
  UserRole,
  WorkflowStage,
} from "@/generated/prisma/enums";

export const EMPLOYEE_BAND_LABELS: Record<EmployeeBand, string> = {
  [EmployeeBand.SIZE_1_49]: "1–49",
  [EmployeeBand.SIZE_50_249]: "50–249",
  [EmployeeBand.SIZE_250_999]: "250–999",
  [EmployeeBand.SIZE_1000_PLUS]: "1,000+",
};

export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  [RevenueBand.UNDER_10M]: "< $10M",
  [RevenueBand.FROM_10M_TO_50M]: "$10M – $50M",
  [RevenueBand.FROM_50M_TO_1B]: "$50M – $1B",
  [RevenueBand.OVER_1B]: "$1B+",
};

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  [CompanyType.CUSTOMER]: "Customer",
  [CompanyType.PROSPECT]: "Prospect",
  [CompanyType.PARTNER]: "Partner",
  [CompanyType.VENDOR]: "Vendor",
};

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  [OwnershipType.PUBLIC]: "Public",
  [OwnershipType.PRIVATE]: "Private",
  [OwnershipType.PE_BACKED]: "PE-backed",
  [OwnershipType.FRANCHISE]: "Franchise",
};

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  [LifecycleStage.LEAD]: "Lead",
  [LifecycleStage.PROSPECT]: "Prospect",
  [LifecycleStage.CUSTOMER]: "Customer",
  [LifecycleStage.CHURNED]: "Churned",
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: "Active",
  [AccountStatus.INACTIVE]: "Inactive",
  [AccountStatus.AT_RISK]: "At risk",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  [LeadSource.REFERRAL]: "Referral",
  [LeadSource.OUTBOUND]: "Outbound",
  [LeadSource.INBOUND]: "Inbound",
  [LeadSource.OTHER]: "Other",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  [PaymentTerms.DUE_ON_RECEIPT]: "Due on receipt",
  [PaymentTerms.NET_15]: "Net 15",
  [PaymentTerms.NET_30]: "Net 30",
  [PaymentTerms.NET_45]: "Net 45",
  [PaymentTerms.NET_60]: "Net 60",
  [PaymentTerms.NET_90]: "Net 90",
};

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  [WorkflowStage.PENDING]: "New lead",
  [WorkflowStage.CONTACTED]: "Contacted",
  [WorkflowStage.QUALIFIED]: "Qualified",
  [WorkflowStage.PROPOSAL_SENT]: "Proposal sent",
  [WorkflowStage.NEGOTIATION]: "Negotiation",
  [WorkflowStage.CLOSED_WON]: "Closed won",
  [WorkflowStage.CLOSED_LOST]: "Closed lost",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.REP]: "Rep",
  [UserRole.ADMIN]: "Admin",
};

/** Turns a label map into `<select>`-ready options, preserving declaration order. */
export function toOptions<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export function formatCurrency(value: string | number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
