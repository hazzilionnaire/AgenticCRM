-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REP', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('CUSTOMER', 'PROSPECT', 'PARTNER', 'VENDOR');

-- CreateEnum
CREATE TYPE "EmployeeBand" AS ENUM ('SIZE_1_49', 'SIZE_50_249', 'SIZE_250_999', 'SIZE_1000_PLUS');

-- CreateEnum
CREATE TYPE "RevenueBand" AS ENUM ('UNDER_10M', 'FROM_10M_TO_50M', 'FROM_50M_TO_1B', 'OVER_1B');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('PUBLIC', 'PRIVATE', 'PE_BACKED', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "LifecycleStage" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER', 'CHURNED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'AT_RISK');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'OUTBOUND', 'INBOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('DUE_ON_RECEIPT', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('PENDING', 'CONTACTED');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssignmentStrategy" AS ENUM ('ROUND_ROBIN', 'FIXED');

-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('TIER_SUPPORT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TIER_CHANGED_SUPPORT_OFFER', 'SUPPORT_OFFER_ACCEPTED', 'COMPANY_ASSIGNED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('COMPANY_CREATED', 'FIELD_CHANGED', 'WORKFLOW_STAGE_CHANGED', 'OWNER_ASSIGNED', 'TIER_RECALCULATED', 'COLLABORATOR_ADDED', 'SUPPORT_OFFER_DISMISSED', 'COMPANY_DELETED', 'COMPANY_RESTORED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'REP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Industry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "dbaName" TEXT,
    "industryId" TEXT,
    "companyType" "CompanyType" NOT NULL DEFAULT 'PROSPECT',
    "parentId" TEXT,
    "dunsNumber" TEXT,
    "taxId" TEXT,
    "websiteDomain" TEXT,
    "employeeBand" "EmployeeBand",
    "annualRevenueExact" DECIMAL(18,2),
    "annualRevenueBand" "RevenueBand",
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tier" INTEGER,
    "tierCalculatedAt" TIMESTAMP(3),
    "locationCount" INTEGER,
    "ownershipType" "OwnershipType",
    "billingStreet1" TEXT,
    "billingStreet2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostal" TEXT,
    "billingCountry" TEXT,
    "shippingStreet1" TEXT,
    "shippingStreet2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostal" TEXT,
    "shippingCountry" TEXT,
    "phone" TEXT,
    "emailDomain" TEXT,
    "timeZone" TEXT,
    "ownerId" TEXT,
    "ownerAssignedBy" "AssignmentSource",
    "ownerAssignedAt" TIMESTAMP(3),
    "lifecycleStage" "LifecycleStage" NOT NULL DEFAULT 'LEAD',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "customerSince" TIMESTAMP(3),
    "leadSource" "LeadSource",
    "tcv" DECIMAL(18,2),
    "acv" DECIMAL(18,2),
    "paymentTerms" "PaymentTerms",
    "creditRating" TEXT,
    "renewalDate" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "openDealsCount" INTEGER NOT NULL DEFAULT 0,
    "openTicketsCount" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER,
    "npsScore" INTEGER,
    "workflowStage" "WorkflowStage" NOT NULL DEFAULT 'PENDING',
    "workflowStageChangedAt" TIMESTAMP(3),
    "workflowStageChangedById" TEXT,
    "score" INTEGER,
    "scoreUpdatedAt" TIMESTAMP(3),
    "enrichmentSource" TEXT,
    "enrichmentUpdatedAt" TIMESTAMP(3),
    "enrichmentData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "strategy" "AssignmentStrategy" NOT NULL DEFAULT 'ROUND_ROBIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cursor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRuleMember" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssignmentRuleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCollaborator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'TIER_SUPPORT',
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "suggestedUserId" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ActivityType" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Industry_slug_key" ON "Industry"("slug");

-- CreateIndex
CREATE INDEX "Industry_isActive_sortOrder_idx" ON "Industry"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Company_legalName_idx" ON "Company"("legalName");

-- CreateIndex
CREATE INDEX "Company_industryId_idx" ON "Company"("industryId");

-- CreateIndex
CREATE INDEX "Company_tier_idx" ON "Company"("tier");

-- CreateIndex
CREATE INDEX "Company_employeeBand_idx" ON "Company"("employeeBand");

-- CreateIndex
CREATE INDEX "Company_annualRevenueBand_idx" ON "Company"("annualRevenueBand");

-- CreateIndex
CREATE INDEX "Company_lifecycleStage_idx" ON "Company"("lifecycleStage");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

-- CreateIndex
CREATE INDEX "Company_workflowStage_idx" ON "Company"("workflowStage");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentRule_tier_key" ON "AssignmentRule"("tier");

-- CreateIndex
CREATE INDEX "AssignmentRuleMember_ruleId_sortOrder_idx" ON "AssignmentRuleMember"("ruleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentRuleMember_ruleId_userId_key" ON "AssignmentRuleMember"("ruleId", "userId");

-- CreateIndex
CREATE INDEX "CompanyCollaborator_userId_idx" ON "CompanyCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCollaborator_companyId_userId_key" ON "CompanyCollaborator"("companyId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_createdAt_idx" ON "ActivityLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleMember" ADD CONSTRAINT "AssignmentRuleMember_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AssignmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRuleMember" ADD CONSTRAINT "AssignmentRuleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCollaborator" ADD CONSTRAINT "CompanyCollaborator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCollaborator" ADD CONSTRAINT "CompanyCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCollaborator" ADD CONSTRAINT "CompanyCollaborator_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_suggestedUserId_fkey" FOREIGN KEY ("suggestedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
