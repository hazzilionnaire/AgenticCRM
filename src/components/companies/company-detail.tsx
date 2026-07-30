"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  EMPLOYEE_BAND_LABELS,
  LEAD_SOURCE_LABELS,
  LIFECYCLE_STAGE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PAYMENT_TERMS_LABELS,
  REVENUE_BAND_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { tierLabel } from "@/server/tiering/calculate-tier";
import { ActivityFeed, type ActivityEntry } from "@/components/companies/activity-feed";
import { CompanyForm, type FormRefData } from "@/components/companies/company-form";
import { DraftEmailButton } from "@/components/companies/draft-email-button";
import { WorkflowControl } from "@/components/companies/workflow-control";
import { Button } from "@/components/ui/buttons";
import { Badge, Card, ReadOnlyField, tierTone } from "@/components/ui/primitives";

/** Shape produced by getCompany(), already serialized for the client. */
export interface CompanyDetail {
  id: string;
  legalName: string;
  dbaName: string | null;
  companyType: string;
  dunsNumber: string | null;
  taxId: string | null;
  websiteDomain: string | null;
  employeeBand: string | null;
  annualRevenueExact: string | null;
  annualRevenueBand: string | null;
  currency: string;
  tier: number | null;
  tierCalculatedAt: string | null;
  locationCount: number | null;
  ownershipType: string | null;
  billingStreet1: string | null;
  billingStreet2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostal: string | null;
  billingCountry: string | null;
  shippingStreet1: string | null;
  shippingStreet2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostal: string | null;
  shippingCountry: string | null;
  phone: string | null;
  emailDomain: string | null;
  timeZone: string | null;
  ownerId: string | null;
  ownerAssignedBy: string | null;
  ownerAssignedAt: string | null;
  lifecycleStage: string;
  accountStatus: string;
  customerSince: string | null;
  leadSource: string | null;
  tcv: string | null;
  acv: string | null;
  paymentTerms: string | null;
  creditRating: string | null;
  renewalDate: string | null;
  lastActivityAt: string | null;
  openDealsCount: number;
  openTicketsCount: number;
  healthScore: number | null;
  npsScore: number | null;
  workflowStage: string;
  workflowStageChangedAt: string | null;
  workflowStageChangedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  industry: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string } | null;
  parent: { id: string; legalName: string } | null;
  subsidiaries: { id: string; legalName: string; tier: number | null }[];
  collaborators: {
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string };
  }[];
}

function toFormValues(company: CompanyDetail): Record<string, string> {
  const date = (v: string | null) => (v ? v.slice(0, 10) : "");
  return {
    legalName: company.legalName,
    dbaName: company.dbaName ?? "",
    industryId: company.industry?.id ?? "",
    companyType: company.companyType,
    parentId: company.parent?.id ?? "",
    dunsNumber: company.dunsNumber ?? "",
    taxId: company.taxId ?? "",
    websiteDomain: company.websiteDomain ?? "",
    employeeBand: company.employeeBand ?? "",
    annualRevenueExact: company.annualRevenueExact ?? "",
    annualRevenueBand: company.annualRevenueBand ?? "",
    currency: company.currency,
    locationCount: company.locationCount?.toString() ?? "",
    ownershipType: company.ownershipType ?? "",
    billingStreet1: company.billingStreet1 ?? "",
    billingStreet2: company.billingStreet2 ?? "",
    billingCity: company.billingCity ?? "",
    billingState: company.billingState ?? "",
    billingPostal: company.billingPostal ?? "",
    billingCountry: company.billingCountry ?? "",
    shippingStreet1: company.shippingStreet1 ?? "",
    shippingStreet2: company.shippingStreet2 ?? "",
    shippingCity: company.shippingCity ?? "",
    shippingState: company.shippingState ?? "",
    shippingPostal: company.shippingPostal ?? "",
    shippingCountry: company.shippingCountry ?? "",
    phone: company.phone ?? "",
    emailDomain: company.emailDomain ?? "",
    timeZone: company.timeZone ?? "",
    ownerId: company.ownerId ?? "",
    lifecycleStage: company.lifecycleStage,
    accountStatus: company.accountStatus,
    customerSince: date(company.customerSince),
    leadSource: company.leadSource ?? "",
    tcv: company.tcv ?? "",
    acv: company.acv ?? "",
    paymentTerms: company.paymentTerms ?? "",
    creditRating: company.creditRating ?? "",
    renewalDate: date(company.renewalDate),
  };
}

function addressLines(parts: (string | null)[]) {
  const lines = parts.filter(Boolean);
  if (lines.length === 0) return "—";
  return (
    <span className="whitespace-pre-line">
      {lines.join("\n")}
    </span>
  );
}

export function CompanyDetailView({
  company,
  activity,
  refData,
  names,
}: {
  company: CompanyDetail;
  activity: ActivityEntry[];
  refData: FormRefData;
  names: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isDeleted = Boolean(company.deletedAt);

  async function onDelete() {
    if (!confirm(`Delete ${company.legalName}? It can be restored afterwards.`)) return;
    setBusy(true);
    await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function onRestore() {
    setBusy(true);
    await fetch(`/api/companies/${company.id}/restore`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/companies" className="text-sm text-[var(--muted)] hover:underline">
            ← Companies
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{company.legalName}</h1>
            {company.dbaName && (
              <span className="text-sm text-[var(--muted)]">({company.dbaName})</span>
            )}
            <Badge tone={tierTone(company.tier)}>
              {company.tier === null
                ? "Unclassified"
                : `Tier ${company.tier} · ${tierLabel(company.tier)}`}
            </Badge>
            {isDeleted && <Badge tone="red">Deleted</Badge>}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {company.industry?.name ?? "No industry"} ·{" "}
            {COMPANY_TYPE_LABELS[company.companyType as never] ?? company.companyType} ·{" "}
            Owner: {company.owner ? (company.owner.name ?? company.owner.email) : "Unassigned"}
            {company.ownerAssignedBy === "MANUAL" && " (set manually)"}
          </p>
        </div>

        <div className="flex gap-2">
          {!isDeleted && <DraftEmailButton companyId={company.id} />}
          {!isDeleted && (
            <Button variant={editing ? "ghost" : "primary"} onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel edit" : "Edit"}
            </Button>
          )}
          {isDeleted ? (
            <Button variant="secondary" onClick={onRestore} disabled={busy}>
              Restore
            </Button>
          ) : (
            <Button variant="danger" onClick={onDelete} disabled={busy}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <CompanyForm
          companyId={company.id}
          initial={toFormValues(company)}
          refData={refData}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card title="Core identity">
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Legal name" value={company.legalName} />
                <ReadOnlyField label="DBA name" value={company.dbaName} />
                <ReadOnlyField label="Industry" value={company.industry?.name} />
                <ReadOnlyField
                  label="Company type"
                  value={COMPANY_TYPE_LABELS[company.companyType as never]}
                />
                <ReadOnlyField
                  label="Parent company"
                  value={
                    company.parent ? (
                      <Link
                        href={`/companies/${company.parent.id}`}
                        className="hover:text-[var(--accent)] hover:underline"
                      >
                        {company.parent.legalName}
                      </Link>
                    ) : null
                  }
                />
                <ReadOnlyField label="Website domain" value={company.websiteDomain} />
                <ReadOnlyField label="DUNS number" value={company.dunsNumber} />
                <ReadOnlyField label="Tax ID / EIN" value={company.taxId} />
                <ReadOnlyField
                  label="Subsidiaries"
                  value={
                    company.subsidiaries.length === 0 ? null : (
                      <span className="flex flex-col gap-0.5">
                        {company.subsidiaries.map((s) => (
                          <Link
                            key={s.id}
                            href={`/companies/${s.id}`}
                            className="hover:text-[var(--accent)] hover:underline"
                          >
                            {s.legalName}
                          </Link>
                        ))}
                      </span>
                    )
                  }
                />
              </dl>
            </Card>

            <Card
              title="Size & segmentation"
              description={
                company.tierCalculatedAt
                  ? `Tier derived automatically · last calculated ${formatDateTime(company.tierCalculatedAt)}`
                  : "Tier is derived from employee count and revenue."
              }
            >
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField
                  label="Employee count"
                  value={
                    company.employeeBand
                      ? EMPLOYEE_BAND_LABELS[company.employeeBand as never]
                      : null
                  }
                />
                <ReadOnlyField
                  label="Annual revenue (exact)"
                  value={
                    company.annualRevenueExact
                      ? formatCurrency(company.annualRevenueExact, company.currency)
                      : null
                  }
                />
                <ReadOnlyField
                  label="Annual revenue (band)"
                  value={
                    company.annualRevenueBand
                      ? REVENUE_BAND_LABELS[company.annualRevenueBand as never]
                      : null
                  }
                />
                <ReadOnlyField
                  label="Tier"
                  value={
                    company.tier === null
                      ? "Unclassified"
                      : `Tier ${company.tier} · ${tierLabel(company.tier)}`
                  }
                />
                <ReadOnlyField label="Locations / sites" value={company.locationCount} />
                <ReadOnlyField
                  label="Ownership type"
                  value={
                    company.ownershipType
                      ? OWNERSHIP_TYPE_LABELS[company.ownershipType as never]
                      : null
                  }
                />
              </dl>
            </Card>

            <Card title="Contact & location">
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField label="Phone" value={company.phone} />
                <ReadOnlyField label="Main email domain" value={company.emailDomain} />
                <ReadOnlyField label="Time zone" value={company.timeZone} />
                <ReadOnlyField
                  label="Billing address"
                  value={addressLines([
                    company.billingStreet1,
                    company.billingStreet2,
                    [company.billingCity, company.billingState, company.billingPostal]
                      .filter(Boolean)
                      .join(", ") || null,
                    company.billingCountry,
                  ])}
                />
                <ReadOnlyField
                  label="Shipping / service address"
                  value={addressLines([
                    company.shippingStreet1,
                    company.shippingStreet2,
                    [company.shippingCity, company.shippingState, company.shippingPostal]
                      .filter(Boolean)
                      .join(", ") || null,
                    company.shippingCountry,
                  ])}
                />
              </dl>
            </Card>

            <Card title="Relationship & lifecycle">
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField
                  label="Account owner"
                  value={company.owner ? (company.owner.name ?? company.owner.email) : null}
                />
                <ReadOnlyField
                  label="Owner set"
                  value={
                    company.ownerAssignedBy
                      ? `${company.ownerAssignedBy === "MANUAL" ? "Manually" : "Automatically"} · ${formatDate(company.ownerAssignedAt)}`
                      : null
                  }
                />
                <ReadOnlyField
                  label="Lifecycle stage"
                  value={LIFECYCLE_STAGE_LABELS[company.lifecycleStage as never]}
                />
                <ReadOnlyField
                  label="Account status"
                  value={ACCOUNT_STATUS_LABELS[company.accountStatus as never]}
                />
                <ReadOnlyField
                  label="Lead source"
                  value={
                    company.leadSource ? LEAD_SOURCE_LABELS[company.leadSource as never] : null
                  }
                />
                <ReadOnlyField label="Created" value={formatDate(company.createdAt)} />
                <ReadOnlyField
                  label="Customer since"
                  value={company.customerSince ? formatDate(company.customerSince) : null}
                />
              </dl>
            </Card>

            <Card title="Financial">
              <dl className="grid gap-4 sm:grid-cols-3">
                <ReadOnlyField
                  label="TCV"
                  value={company.tcv ? formatCurrency(company.tcv, company.currency) : null}
                />
                <ReadOnlyField
                  label="ACV"
                  value={company.acv ? formatCurrency(company.acv, company.currency) : null}
                />
                <ReadOnlyField
                  label="Payment terms"
                  value={
                    company.paymentTerms
                      ? PAYMENT_TERMS_LABELS[company.paymentTerms as never]
                      : null
                  }
                />
                <ReadOnlyField label="Credit / risk rating" value={company.creditRating} />
                <ReadOnlyField
                  label="Renewal date"
                  value={company.renewalDate ? formatDate(company.renewalDate) : null}
                />
              </dl>
            </Card>
          </div>

          <div className="space-y-4">
            <Card
              title="Prospect workflow"
              description="Stage changes are timestamped and attributed in the log."
            >
              <WorkflowControl
                companyId={company.id}
                stage={company.workflowStage as never}
                changedAt={company.workflowStageChangedAt}
                changedBy={
                  company.workflowStageChangedById
                    ? (names[company.workflowStageChangedById] ?? null)
                    : null
                }
                disabled={isDeleted}
              />
            </Card>

            <Card
              title="Engagement"
              description="Rollups — populated by integrations, not editable here."
            >
              <dl className="grid grid-cols-2 gap-4">
                <ReadOnlyField
                  label="Last activity"
                  value={company.lastActivityAt ? formatDate(company.lastActivityAt) : null}
                />
                <ReadOnlyField label="Open deals" value={company.openDealsCount} />
                <ReadOnlyField label="Open tickets" value={company.openTicketsCount} />
                <ReadOnlyField
                  label="Health / NPS"
                  value={
                    company.healthScore ?? company.npsScore ?? (
                      <span className="text-xs text-[var(--muted)]">Not yet integrated</span>
                    )
                  }
                />
              </dl>
            </Card>

            {company.collaborators.length > 0 && (
              <Card
                title="Tier support"
                description="Reps supporting the owner on this account."
              >
                <ul className="space-y-2 text-sm">
                  {company.collaborators.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span>{c.user.name ?? c.user.email}</span>
                      <Badge tone="violet">Tier support</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card title="Activity & change log">
              <ActivityFeed entries={activity} names={names} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
