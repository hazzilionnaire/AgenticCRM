import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  AccountStatus,
  AssignmentSource,
  AssignmentStrategy,
  CompanyType,
  EmployeeBand,
  LeadSource,
  LifecycleStage,
  OwnershipType,
  PaymentTerms,
  RevenueBand,
  UserRole,
  WorkflowStage,
} from "../src/generated/prisma/enums";
import { calculateTier } from "../src/server/tiering/calculate-tier";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const INDUSTRIES = [
  "Software & SaaS",
  "Financial Services",
  "Healthcare & Life Sciences",
  "Manufacturing",
  "Retail & E-commerce",
  "Professional Services",
  "Telecommunications",
  "Energy & Utilities",
  "Transportation & Logistics",
  "Education",
  "Government & Public Sector",
  "Hospitality & Travel",
  "Real Estate & Construction",
  "Media & Entertainment",
  "Nonprofit",
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const REPS = [
  { email: "admin@agenticcrm.test", name: "Avery Admin", role: UserRole.ADMIN },
  { email: "sam.smb@agenticcrm.test", name: "Sam Rivera", role: UserRole.REP },
  { email: "dana.smb@agenticcrm.test", name: "Dana Cole", role: UserRole.REP },
  { email: "morgan.mm@agenticcrm.test", name: "Morgan Ellis", role: UserRole.REP },
  { email: "priya.mm@agenticcrm.test", name: "Priya Nair", role: UserRole.REP },
  { email: "chris.ent@agenticcrm.test", name: "Chris Okafor", role: UserRole.REP },
  { email: "jamie.ent@agenticcrm.test", name: "Jamie Lindqvist", role: UserRole.REP },
  { email: "robin.strat@agenticcrm.test", name: "Robin Vasquez", role: UserRole.REP },
];

const DEFAULT_PASSWORD = "password123";

// Tier → the reps who work that segment. Editable in-app at /settings/assignment-rules.
const POOLS: Record<number, string[]> = {
  1: ["sam.smb@agenticcrm.test", "dana.smb@agenticcrm.test"],
  2: ["morgan.mm@agenticcrm.test", "priya.mm@agenticcrm.test"],
  3: ["chris.ent@agenticcrm.test", "jamie.ent@agenticcrm.test"],
  4: ["robin.strat@agenticcrm.test", "jamie.ent@agenticcrm.test"],
};

interface CompanySeed {
  legalName: string;
  dbaName?: string;
  industry: string;
  companyType: CompanyType;
  employeeBand?: EmployeeBand;
  annualRevenueExact?: number;
  annualRevenueBand?: RevenueBand;
  ownershipType?: OwnershipType;
  lifecycleStage: LifecycleStage;
  accountStatus?: AccountStatus;
  leadSource?: LeadSource;
  websiteDomain?: string;
  emailDomain?: string;
  phone?: string;
  timeZone?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  locationCount?: number;
  tcv?: number;
  acv?: number;
  paymentTerms?: PaymentTerms;
  creditRating?: string;
  customerSince?: Date;
  renewalDate?: Date;
  workflowStage?: WorkflowStage;
  openDealsCount?: number;
  openTicketsCount?: number;
  /**
   * Backdates lastActivityAt / workflowStageChangedAt by this many days.
   * Omit for "never contacted" -- the needs-attention scorer treats those
   * differently (falls back to how long ago the record was created).
   */
  daysSinceActivity?: number;
  /** Backdates createdAt by this many days. Omit to use "now" like every other seeded row. */
  daysSinceCreated?: number;
}

const COMPANIES: CompanySeed[] = [
  {
    legalName: "Northwind Analytics, Inc.",
    dbaName: "Northwind",
    industry: "Software & SaaS",
    companyType: CompanyType.CUSTOMER,
    employeeBand: EmployeeBand.SIZE_250_999,
    annualRevenueExact: 82_000_000,
    ownershipType: OwnershipType.PE_BACKED,
    lifecycleStage: LifecycleStage.CUSTOMER,
    accountStatus: AccountStatus.ACTIVE,
    leadSource: LeadSource.INBOUND,
    websiteDomain: "northwind.example",
    emailDomain: "northwind.example",
    phone: "+1 415 555 0142",
    timeZone: "America/Los_Angeles",
    billingCity: "San Francisco",
    billingState: "CA",
    billingCountry: "USA",
    locationCount: 4,
    tcv: 2_400_000,
    acv: 800_000,
    paymentTerms: PaymentTerms.NET_30,
    creditRating: "A-",
    customerSince: new Date("2023-02-14"),
    renewalDate: new Date("2026-02-14"),
    workflowStage: WorkflowStage.CONTACTED,
    openDealsCount: 2,
    openTicketsCount: 1,
    // Healthy, recently touched -- should NOT surface in "needs attention".
    daysSinceActivity: 3,
  },
  {
    legalName: "Cobalt Manufacturing Group Ltd.",
    industry: "Manufacturing",
    companyType: CompanyType.CUSTOMER,
    employeeBand: EmployeeBand.SIZE_1000_PLUS,
    annualRevenueExact: 1_450_000_000,
    ownershipType: OwnershipType.PUBLIC,
    lifecycleStage: LifecycleStage.CUSTOMER,
    accountStatus: AccountStatus.AT_RISK,
    leadSource: LeadSource.OUTBOUND,
    websiteDomain: "cobaltmfg.example",
    timeZone: "America/Chicago",
    billingCity: "Chicago",
    billingState: "IL",
    billingCountry: "USA",
    locationCount: 22,
    tcv: 11_000_000,
    acv: 3_600_000,
    paymentTerms: PaymentTerms.NET_60,
    creditRating: "AA",
    customerSince: new Date("2019-06-01"),
    renewalDate: new Date("2026-06-01"),
    workflowStage: WorkflowStage.CONTACTED,
    openDealsCount: 5,
    openTicketsCount: 7,
    // AT_RISK plus a stale touch, high tier -- should rank near the top.
    daysSinceActivity: 21,
  },
  {
    legalName: "Harbourline Logistics S.A.",
    industry: "Transportation & Logistics",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_50_249,
    annualRevenueBand: RevenueBand.FROM_10M_TO_50M,
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.PROSPECT,
    leadSource: LeadSource.REFERRAL,
    websiteDomain: "harbourline.example",
    timeZone: "Europe/Lisbon",
    billingCity: "Lisbon",
    billingCountry: "Portugal",
    locationCount: 6,
    // Qualified, then went quiet for a month and a half.
    workflowStage: WorkflowStage.QUALIFIED,
    daysSinceActivity: 45,
  },
  {
    legalName: "Fernwood Family Dental PC",
    industry: "Healthcare & Life Sciences",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_1_49,
    annualRevenueExact: 3_200_000,
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.LEAD,
    leadSource: LeadSource.INBOUND,
    websiteDomain: "fernwooddental.example",
    timeZone: "America/New_York",
    billingCity: "Providence",
    billingState: "RI",
    billingCountry: "USA",
    locationCount: 1,
    // Never contacted, but only 5 days old -- inside the grace period, so
    // it should NOT surface yet. Contrast with Redstone below.
    daysSinceCreated: 5,
  },
  {
    legalName: "Meridian Capital Partners LLP",
    industry: "Financial Services",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_50_249,
    // Revenue says Tier 4, headcount says Tier 2 — the higher wins.
    annualRevenueExact: 2_100_000_000,
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.PROSPECT,
    leadSource: LeadSource.REFERRAL,
    websiteDomain: "meridiancap.example",
    timeZone: "Europe/London",
    billingCity: "London",
    billingCountry: "United Kingdom",
    locationCount: 3,
    // A proposal that's gone quiet -- exactly what the digest exists to catch.
    workflowStage: WorkflowStage.PROPOSAL_SENT,
    daysSinceActivity: 30,
  },
  {
    legalName: "Sunnyside Grocers Co-operative",
    industry: "Retail & E-commerce",
    companyType: CompanyType.CUSTOMER,
    employeeBand: EmployeeBand.SIZE_250_999,
    annualRevenueBand: RevenueBand.FROM_50M_TO_1B,
    ownershipType: OwnershipType.FRANCHISE,
    lifecycleStage: LifecycleStage.CUSTOMER,
    accountStatus: AccountStatus.ACTIVE,
    leadSource: LeadSource.OUTBOUND,
    websiteDomain: "sunnysidegrocers.example",
    timeZone: "America/Denver",
    billingCity: "Boulder",
    billingState: "CO",
    billingCountry: "USA",
    locationCount: 48,
    tcv: 1_800_000,
    acv: 600_000,
    paymentTerms: PaymentTerms.NET_45,
    customerSince: new Date("2024-09-30"),
    renewalDate: new Date("2026-09-30"),
    workflowStage: WorkflowStage.CONTACTED,
    // Healthy -- should NOT surface.
    daysSinceActivity: 5,
  },
  {
    legalName: "Atlas Grid Energy Corporation",
    industry: "Energy & Utilities",
    companyType: CompanyType.PARTNER,
    employeeBand: EmployeeBand.SIZE_1000_PLUS,
    annualRevenueBand: RevenueBand.OVER_1B,
    ownershipType: OwnershipType.PUBLIC,
    lifecycleStage: LifecycleStage.CUSTOMER,
    accountStatus: AccountStatus.ACTIVE,
    leadSource: LeadSource.OTHER,
    websiteDomain: "atlasgrid.example",
    timeZone: "America/Toronto",
    billingCity: "Toronto",
    billingState: "ON",
    billingCountry: "Canada",
    locationCount: 15,
    tcv: 7_500_000,
    acv: 2_500_000,
    paymentTerms: PaymentTerms.NET_90,
    creditRating: "A+",
    customerSince: new Date("2021-11-15"),
    renewalDate: new Date("2027-11-15"),
    workflowStage: WorkflowStage.CONTACTED,
    openDealsCount: 3,
    // Highest tier in the seed and two months quiet -- should rank at or near
    // the top even without an AT_RISK flag.
    daysSinceActivity: 60,
  },
  {
    legalName: "Pinecrest Academy Trust",
    industry: "Education",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_250_999,
    annualRevenueBand: RevenueBand.UNDER_10M,
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.LEAD,
    leadSource: LeadSource.INBOUND,
    websiteDomain: "pinecrestacademy.example",
    timeZone: "Europe/Dublin",
    billingCity: "Dublin",
    billingCountry: "Ireland",
    locationCount: 9,
    // Actively in negotiation, touched 12 days ago -- just under the 14-day
    // staleness threshold, so this should sit right on the boundary and NOT
    // surface. Useful for checking the threshold itself, not just the cases
    // either side of it.
    workflowStage: WorkflowStage.NEGOTIATION,
    daysSinceActivity: 12,
  },
  {
    legalName: "Vantage Media Holdings",
    industry: "Media & Entertainment",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_50_249,
    annualRevenueExact: 24_000_000,
    ownershipType: OwnershipType.PE_BACKED,
    lifecycleStage: LifecycleStage.PROSPECT,
    leadSource: LeadSource.OUTBOUND,
    websiteDomain: "vantagemedia.example",
    timeZone: "America/New_York",
    billingCity: "New York",
    billingState: "NY",
    billingCountry: "USA",
    locationCount: 2,
    // Closed and lost three months ago -- terminal stages are excluded from
    // "needs attention" regardless of how stale they look.
    workflowStage: WorkflowStage.CLOSED_LOST,
    daysSinceActivity: 90,
  },
  {
    legalName: "Kestrel Cloud Services GmbH",
    industry: "Software & SaaS",
    companyType: CompanyType.VENDOR,
    employeeBand: EmployeeBand.SIZE_1_49,
    annualRevenueBand: RevenueBand.UNDER_10M,
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.CHURNED,
    accountStatus: AccountStatus.INACTIVE,
    leadSource: LeadSource.OTHER,
    websiteDomain: "kestrelcloud.example",
    timeZone: "Europe/Berlin",
    billingCity: "Berlin",
    billingCountry: "Germany",
    locationCount: 1,
    // Closed won long ago, since churned -- also terminal, also excluded.
    workflowStage: WorkflowStage.CLOSED_WON,
    daysSinceActivity: 120,
  },
  {
    legalName: "Orchard Hospitality Group",
    industry: "Hospitality & Travel",
    companyType: CompanyType.PROSPECT,
    employeeBand: EmployeeBand.SIZE_1000_PLUS,
    annualRevenueExact: 640_000_000,
    ownershipType: OwnershipType.PUBLIC,
    lifecycleStage: LifecycleStage.PROSPECT,
    leadSource: LeadSource.REFERRAL,
    websiteDomain: "orchardhospitality.example",
    timeZone: "Asia/Singapore",
    billingCity: "Singapore",
    billingCountry: "Singapore",
    locationCount: 63,
    // High tier, fresh -- should NOT surface despite the tier weight.
    workflowStage: WorkflowStage.QUALIFIED,
    daysSinceActivity: 2,
  },
  {
    legalName: "Redstone Civil Engineering Ltd.",
    industry: "Real Estate & Construction",
    companyType: CompanyType.PROSPECT,
    // No size data at all — stays unclassified and unassigned until enriched.
    ownershipType: OwnershipType.PRIVATE,
    lifecycleStage: LifecycleStage.LEAD,
    leadSource: LeadSource.INBOUND,
    websiteDomain: "redstonecivil.example",
    timeZone: "Australia/Sydney",
    billingCity: "Sydney",
    billingCountry: "Australia",
    // Never contacted, sitting untouched for 75 days, and unclassified so no
    // one owns it -- the single clearest "needs attention" case in the seed.
    daysSinceCreated: 75,
  },
];

async function main() {
  console.log("Seeding…");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = new Map<string, string>();
  for (const rep of REPS) {
    const user = await prisma.user.upsert({
      where: { email: rep.email },
      create: { email: rep.email, name: rep.name, role: rep.role, passwordHash },
      update: { name: rep.name, role: rep.role },
    });
    users.set(rep.email, user.id);
  }
  console.log(`  ${users.size} users`);

  const industries = new Map<string, string>();
  for (const [i, name] of INDUSTRIES.entries()) {
    const industry = await prisma.industry.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, sortOrder: i },
      update: { name, sortOrder: i },
    });
    industries.set(name, industry.id);
  }
  console.log(`  ${industries.size} industries`);

  for (const [tier, emails] of Object.entries(POOLS)) {
    const rule = await prisma.assignmentRule.upsert({
      where: { tier: Number(tier) },
      create: { tier: Number(tier), strategy: AssignmentStrategy.ROUND_ROBIN },
      update: {},
    });
    for (const [i, email] of emails.entries()) {
      const userId = users.get(email)!;
      await prisma.assignmentRuleMember.upsert({
        where: { ruleId_userId: { ruleId: rule.id, userId } },
        create: { ruleId: rule.id, userId, sortOrder: i },
        update: { sortOrder: i, isActive: true },
      });
    }
  }
  console.log(`  ${Object.keys(POOLS).length} assignment rules`);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * DAY_MS);

  // Seeded companies are written directly (not via the service) so the seed is
  // idempotent and deterministic; tier still comes from the same pure function.
  let created = 0;
  for (const c of COMPANIES) {
    const existing = await prisma.company.findFirst({
      where: { legalName: c.legalName },
      select: { id: true },
    });
    if (existing) continue;

    const { industry, daysSinceActivity, daysSinceCreated, ...rest } = c;
    const tier = calculateTier({
      employeeBand: rest.employeeBand ?? null,
      annualRevenueExact: rest.annualRevenueExact ?? null,
      annualRevenueBand: rest.annualRevenueBand ?? null,
    });

    // Round-robin the seeded owners the same way the engine would.
    let ownerId: string | null = null;
    if (tier !== null) {
      const rule = await prisma.assignmentRule.findUnique({
        where: { tier },
        include: { members: { orderBy: { sortOrder: "asc" } } },
      });
      if (rule && rule.members.length) {
        const member = rule.members[rule.cursor % rule.members.length];
        ownerId = member.userId;
        await prisma.assignmentRule.update({
          where: { id: rule.id },
          data: { cursor: (rule.cursor + 1) % rule.members.length },
        });
      }
    }

    // A stage change and a touch on the account are the same event for seed
    // purposes -- a real write path would let these diverge, but nothing here
    // needs that distinction.
    const lastActivityAt = daysSinceActivity !== undefined ? daysAgo(daysSinceActivity) : null;

    await prisma.company.create({
      data: {
        ...rest,
        industryId: industry ? industries.get(industry) ?? null : null,
        tier,
        tierCalculatedAt: tier === null ? null : new Date(),
        ownerId,
        ownerAssignedBy: ownerId ? AssignmentSource.AUTO : null,
        ownerAssignedAt: ownerId ? new Date() : null,
        lastActivityAt,
        workflowStageChangedAt: lastActivityAt,
        ...(daysSinceCreated !== undefined ? { createdAt: daysAgo(daysSinceCreated) } : {}),
      },
    });
    created += 1;
  }
  console.log(`  ${created} companies`);

  // Give one Enterprise account a manual owner so the tier-change support-offer
  // path is reachable straight from the seed.
  const northwind = await prisma.company.findFirst({
    where: { legalName: "Northwind Analytics, Inc." },
  });
  if (northwind) {
    await prisma.company.update({
      where: { id: northwind.id },
      data: {
        ownerId: users.get("chris.ent@agenticcrm.test")!,
        ownerAssignedBy: AssignmentSource.MANUAL,
        ownerAssignedAt: new Date(),
      },
    });
  }

  console.log(`\nDone. Sign in with any seeded email / "${DEFAULT_PASSWORD}", e.g.`);
  console.log("  admin@agenticcrm.test");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
