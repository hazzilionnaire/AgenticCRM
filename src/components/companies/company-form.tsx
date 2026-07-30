"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AccountStatus,
  CompanyType,
  LifecycleStage,
} from "@/generated/prisma/enums";
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  EMPLOYEE_BAND_LABELS,
  LEAD_SOURCE_LABELS,
  LIFECYCLE_STAGE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PAYMENT_TERMS_LABELS,
  REVENUE_BAND_LABELS,
  toOptions,
} from "@/lib/labels";
import { calculateTier, tierLabel } from "@/server/tiering/calculate-tier";
import { Button } from "@/components/ui/buttons";
import { Badge, Card, Field, inputClass, tierTone } from "@/components/ui/primitives";

export type CompanyFormValues = Record<string, string>;

export interface FormRefData {
  industries: { id: string; name: string }[];
  reps: { id: string; name: string | null; email: string }[];
  parents: { id: string; legalName: string }[];
}

const EMPTY: CompanyFormValues = {
  legalName: "",
  dbaName: "",
  industryId: "",
  companyType: CompanyType.PROSPECT,
  parentId: "",
  dunsNumber: "",
  taxId: "",
  websiteDomain: "",
  employeeBand: "",
  annualRevenueExact: "",
  annualRevenueBand: "",
  currency: "USD",
  locationCount: "",
  ownershipType: "",
  billingStreet1: "",
  billingStreet2: "",
  billingCity: "",
  billingState: "",
  billingPostal: "",
  billingCountry: "",
  shippingStreet1: "",
  shippingStreet2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostal: "",
  shippingCountry: "",
  phone: "",
  emailDomain: "",
  timeZone: "",
  ownerId: "",
  lifecycleStage: LifecycleStage.LEAD,
  accountStatus: AccountStatus.ACTIVE,
  customerSince: "",
  leadSource: "",
  tcv: "",
  acv: "",
  paymentTerms: "",
  creditRating: "",
  renewalDate: "",
};

function Select({
  value,
  onChange,
  options,
  placeholder = "—",
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {!required && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card title={title}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

export function CompanyForm({
  companyId,
  initial,
  refData,
  onSaved,
  onCancel,
}: {
  companyId?: string;
  initial?: CompanyFormValues;
  refData: FormRefData;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // Live preview of the derived tier, using the same pure function the server runs.
  const previewTier = useMemo(
    () =>
      calculateTier({
        employeeBand: (values.employeeBand || null) as never,
        annualRevenueExact: values.annualRevenueExact || null,
        annualRevenueBand: (values.annualRevenueBand || null) as never,
      }),
    [values.employeeBand, values.annualRevenueExact, values.annualRevenueBand],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const response = await fetch(
      companyId ? `/api/companies/${companyId}` : "/api/companies",
      {
        method: companyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(body.error ?? "Save failed");
      if (Array.isArray(body.fields)) {
        setFieldErrors(
          Object.fromEntries(
            body.fields.map((f: { path: string; message: string }) => [f.path, f.message]),
          ),
        );
      }
      setPending(false);
      return;
    }

    if (companyId) {
      onSaved?.();
      router.refresh();
      setPending(false);
    } else {
      router.push(`/companies/${body.id}`);
    }
  }

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[key]}</p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Section title="Core identity">
        <Field label="Legal name *" className="sm:col-span-2">
          <input
            required
            value={values.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            className={inputClass}
          />
          {err("legalName")}
        </Field>
        <Field label="DBA name">
          <input
            value={values.dbaName}
            onChange={(e) => set("dbaName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Industry">
          <Select
            value={values.industryId}
            onChange={(v) => set("industryId", v)}
            options={refData.industries.map((i) => ({ value: i.id, label: i.name }))}
          />
        </Field>
        <Field label="Company type">
          <Select
            required
            value={values.companyType}
            onChange={(v) => set("companyType", v)}
            options={toOptions(COMPANY_TYPE_LABELS)}
          />
        </Field>
        <Field label="Parent company" hint="For subsidiaries.">
          <Select
            value={values.parentId}
            onChange={(v) => set("parentId", v)}
            options={refData.parents.map((p) => ({ value: p.id, label: p.legalName }))}
            placeholder="— None —"
          />
          {err("parentId")}
        </Field>
        <Field label="Website domain">
          <input
            value={values.websiteDomain}
            onChange={(e) => set("websiteDomain", e.target.value)}
            placeholder="example.com"
            className={inputClass}
          />
        </Field>
        <Field label="DUNS number">
          <input
            value={values.dunsNumber}
            onChange={(e) => set("dunsNumber", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tax ID / EIN">
          <input
            value={values.taxId}
            onChange={(e) => set("taxId", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Card
        title="Size & segmentation"
        description="Tier is calculated from employee count and revenue — it can't be set by hand."
        actions={
          <Badge tone={tierTone(previewTier)}>
            {previewTier === null
              ? "Unclassified"
              : `Tier ${previewTier} · ${tierLabel(previewTier)}`}
          </Badge>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee count">
            <Select
              value={values.employeeBand}
              onChange={(v) => set("employeeBand", v)}
              options={toOptions(EMPLOYEE_BAND_LABELS)}
            />
          </Field>
          <Field label="Annual revenue (exact)" hint="Takes precedence over the band.">
            <input
              type="number"
              min={0}
              step="1"
              value={values.annualRevenueExact}
              onChange={(e) => set("annualRevenueExact", e.target.value)}
              className={inputClass}
            />
            {err("annualRevenueExact")}
          </Field>
          <Field label="Annual revenue (band)">
            <Select
              value={values.annualRevenueBand}
              onChange={(v) => set("annualRevenueBand", v)}
              options={toOptions(REVENUE_BAND_LABELS)}
            />
          </Field>
          <Field label="Locations / sites">
            <input
              type="number"
              min={0}
              value={values.locationCount}
              onChange={(e) => set("locationCount", e.target.value)}
              className={inputClass}
            />
            {err("locationCount")}
          </Field>
          <Field label="Ownership type">
            <Select
              value={values.ownershipType}
              onChange={(v) => set("ownershipType", v)}
              options={toOptions(OWNERSHIP_TYPE_LABELS)}
            />
          </Field>
          <Field label="Currency">
            <input
              value={values.currency}
              maxLength={3}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Section title="Contact & location">
        <Field label="Phone">
          <input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Main email domain">
          <input
            value={values.emailDomain}
            onChange={(e) => set("emailDomain", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Time zone" hint="IANA name, e.g. America/Toronto">
          <input
            value={values.timeZone}
            onChange={(e) => set("timeZone", e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2 lg:col-span-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Billing address
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Street 1">
              <input
                value={values.billingStreet1}
                onChange={(e) => set("billingStreet1", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Street 2">
              <input
                value={values.billingStreet2}
                onChange={(e) => set("billingStreet2", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                value={values.billingCity}
                onChange={(e) => set("billingCity", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="State / region">
              <input
                value={values.billingState}
                onChange={(e) => set("billingState", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Postal code">
              <input
                value={values.billingPostal}
                onChange={(e) => set("billingPostal", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Country">
              <input
                value={values.billingCountry}
                onChange={(e) => set("billingCountry", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Shipping / service address
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  shippingStreet1: prev.billingStreet1,
                  shippingStreet2: prev.billingStreet2,
                  shippingCity: prev.billingCity,
                  shippingState: prev.billingState,
                  shippingPostal: prev.billingPostal,
                  shippingCountry: prev.billingCountry,
                }))
              }
            >
              Copy from billing
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Street 1">
              <input
                value={values.shippingStreet1}
                onChange={(e) => set("shippingStreet1", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Street 2">
              <input
                value={values.shippingStreet2}
                onChange={(e) => set("shippingStreet2", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                value={values.shippingCity}
                onChange={(e) => set("shippingCity", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="State / region">
              <input
                value={values.shippingState}
                onChange={(e) => set("shippingState", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Postal code">
              <input
                value={values.shippingPostal}
                onChange={(e) => set("shippingPostal", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Country">
              <input
                value={values.shippingCountry}
                onChange={(e) => set("shippingCountry", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Relationship & lifecycle">
        <Field
          label="Account owner"
          hint="Setting an owner by hand protects it from auto-assignment."
        >
          <Select
            value={values.ownerId}
            onChange={(v) => set("ownerId", v)}
            options={refData.reps.map((r) => ({ value: r.id, label: r.name ?? r.email }))}
            placeholder="— Auto-assign by tier —"
          />
        </Field>
        <Field label="Lifecycle stage">
          <Select
            required
            value={values.lifecycleStage}
            onChange={(v) => set("lifecycleStage", v)}
            options={toOptions(LIFECYCLE_STAGE_LABELS)}
          />
        </Field>
        <Field label="Account status">
          <Select
            required
            value={values.accountStatus}
            onChange={(v) => set("accountStatus", v)}
            options={toOptions(ACCOUNT_STATUS_LABELS)}
          />
        </Field>
        <Field label="Lead source">
          <Select
            value={values.leadSource}
            onChange={(v) => set("leadSource", v)}
            options={toOptions(LEAD_SOURCE_LABELS)}
          />
        </Field>
        <Field label="Customer since">
          <input
            type="date"
            value={values.customerSince}
            onChange={(e) => set("customerSince", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Financial">
        <Field label="TCV">
          <input
            type="number"
            min={0}
            value={values.tcv}
            onChange={(e) => set("tcv", e.target.value)}
            className={inputClass}
          />
          {err("tcv")}
        </Field>
        <Field label="ACV">
          <input
            type="number"
            min={0}
            value={values.acv}
            onChange={(e) => set("acv", e.target.value)}
            className={inputClass}
          />
          {err("acv")}
        </Field>
        <Field label="Payment terms">
          <Select
            value={values.paymentTerms}
            onChange={(v) => set("paymentTerms", v)}
            options={toOptions(PAYMENT_TERMS_LABELS)}
          />
        </Field>
        <Field label="Credit / risk rating">
          <input
            value={values.creditRating}
            onChange={(e) => set("creditRating", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Renewal date">
          <input
            type="date"
            value={values.renewalDate}
            onChange={(e) => set("renewalDate", e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : companyId ? "Save changes" : "Create company"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
