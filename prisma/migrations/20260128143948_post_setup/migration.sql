/*
  Warnings:

  - The primary key for the `Account` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AccountPlan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AccountSponsor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Attachment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `AuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Budget` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetImport` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetItemValue` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `value` on the `BudgetItemValue` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - The primary key for the `BudgetLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetScenarioSnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ClosingMonth` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CoordinatorProfile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CostCenter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DreLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `value` on the `DreLine` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - The primary key for the `ImportJob` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RefreshToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Scenario` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "AccountPlan" DROP CONSTRAINT "AccountPlan_parent_fkey";

-- DropForeignKey
ALTER TABLE "AccountSponsor" DROP CONSTRAINT "AccountSponsor_costcenter_fkey";

-- DropForeignKey
ALTER TABLE "AccountSponsor" DROP CONSTRAINT "AccountSponsor_user_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actor_fkey";

-- DropForeignKey
ALTER TABLE "BudgetImport" DROP CONSTRAINT "BudgetImport_budget_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_budget_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_costcenter_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_user_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItemValue" DROP CONSTRAINT "BudgetItemValue_item_fkey";

-- DropForeignKey
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_account_fkey";

-- DropForeignKey
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_costcenter_fkey";

-- DropForeignKey
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_scenario_fkey";

-- DropForeignKey
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "BudgetScenarioSnapshot" DROP CONSTRAINT "BudgetScenarioSnapshot_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "BudgetScenarioSnapshot" DROP CONSTRAINT "BudgetScenarioSnapshot_scenario_fkey";

-- DropForeignKey
ALTER TABLE "CoordinatorProfile" DROP CONSTRAINT "CoordinatorProfile_user_fkey";

-- DropForeignKey
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_owner_fkey";

-- DropForeignKey
ALTER TABLE "DreLine" DROP CONSTRAINT "DreLine_budget_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_user_fkey";

-- DropForeignKey
ALTER TABLE "Scenario" DROP CONSTRAINT "Scenario_createdBy_fkey";

-- AlterTable
ALTER TABLE "Account" DROP CONSTRAINT "Account_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AccountPlan" DROP CONSTRAINT "AccountPlan_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "parentId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "AccountPlan_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AccountSponsor" DROP CONSTRAINT "AccountSponsor_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "costCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "sponsorUserId" SET DATA TYPE TEXT,
ALTER COLUMN "activeFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "activeTo" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "AccountSponsor_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "actorUserId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "Budget_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetImport" DROP CONSTRAINT "BudgetImport_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "budgetId" SET DATA TYPE TEXT,
ALTER COLUMN "uploadedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "BudgetImport_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "budgetId" SET DATA TYPE TEXT,
ALTER COLUMN "costCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetItemValue" DROP CONSTRAINT "BudgetItemValue_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "budgetItemId" SET DATA TYPE TEXT,
ALTER COLUMN "value" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "BudgetItemValue_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetLine" DROP CONSTRAINT "BudgetLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "scenarioId" SET DATA TYPE TEXT,
ALTER COLUMN "costCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "accountId" SET DATA TYPE TEXT,
ALTER COLUMN "createdById" SET DATA TYPE TEXT,
ALTER COLUMN "updatedById" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetScenarioSnapshot" DROP CONSTRAINT "BudgetScenarioSnapshot_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "scenarioId" SET DATA TYPE TEXT,
ALTER COLUMN "createdById" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "BudgetScenarioSnapshot_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ClosingMonth" DROP CONSTRAINT "ClosingMonth_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "ClosingMonth_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CoordinatorProfile" DROP CONSTRAINT "CoordinatorProfile_pkey",
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CoordinatorProfile_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "CostCenter" DROP CONSTRAINT "CostCenter_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "ownerCoordinatorId" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DreLine" DROP CONSTRAINT "DreLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "budgetId" SET DATA TYPE TEXT,
ALTER COLUMN "value" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "DreLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ImportJob" DROP CONSTRAINT "ImportJob_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "replacedBy" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Scenario" DROP CONSTRAINT "Scenario_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdById" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "submittedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "approvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lockedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_ownerCoordinatorId_fkey" FOREIGN KEY ("ownerCoordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPlan" ADD CONSTRAINT "AccountPlan_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetScenarioSnapshot" ADD CONSTRAINT "BudgetScenarioSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetImport" ADD CONSTRAINT "BudgetImport_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreLine" ADD CONSTRAINT "DreLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSponsor" ADD CONSTRAINT "AccountSponsor_sponsorUserId_fkey" FOREIGN KEY ("sponsorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSponsor" ADD CONSTRAINT "AccountSponsor_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItemValue" ADD CONSTRAINT "BudgetItemValue_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AccountPlan_parent_idx" RENAME TO "AccountPlan_parentId_idx";

-- RenameIndex
ALTER INDEX "AccountSponsor_account_idx" RENAME TO "AccountSponsor_accountCode_costCenterId_idx";

-- RenameIndex
ALTER INDEX "AccountSponsor_sponsor_idx" RENAME TO "AccountSponsor_sponsorUserId_idx";

-- RenameIndex
ALTER INDEX "AuditLog_entity_idx" RENAME TO "AuditLog_entityType_entityId_idx";

-- RenameIndex
ALTER INDEX "Budget_kind_active_idx" RENAME TO "Budget_kind_isActive_idx";

-- RenameIndex
ALTER INDEX "BudgetImport_budget_idx" RENAME TO "BudgetImport_budgetId_uploadedAt_idx";

-- RenameIndex
ALTER INDEX "BudgetItem_budget_account_idx" RENAME TO "BudgetItem_budgetId_accountCode_costCenterId_idx";

-- RenameIndex
ALTER INDEX "BudgetItem_budget_idx" RENAME TO "BudgetItem_budgetId_idx";

-- RenameIndex
ALTER INDEX "BudgetItemValue_item_idx" RENAME TO "BudgetItemValue_budgetItemId_idx";

-- RenameIndex
ALTER INDEX "BudgetItemValue_unique" RENAME TO "BudgetItemValue_budgetItemId_month_key";

-- RenameIndex
ALTER INDEX "BudgetLine_account_idx" RENAME TO "BudgetLine_accountId_idx";

-- RenameIndex
ALTER INDEX "BudgetLine_costcenter_idx" RENAME TO "BudgetLine_costCenterId_idx";

-- RenameIndex
ALTER INDEX "BudgetLine_scenario_idx" RENAME TO "BudgetLine_scenarioId_idx";

-- RenameIndex
ALTER INDEX "BudgetLine_unique" RENAME TO "BudgetLine_scenarioId_costCenterId_accountId_description_key";

-- RenameIndex
ALTER INDEX "BudgetScenarioSnapshot_scenario_idx" RENAME TO "BudgetScenarioSnapshot_scenarioId_createdAt_idx";

-- RenameIndex
ALTER INDEX "ClosingMonth_year_kind" RENAME TO "ClosingMonth_year_kind_key";

-- RenameIndex
ALTER INDEX "CostCenter_owner_idx" RENAME TO "CostCenter_ownerCoordinatorId_idx";

-- RenameIndex
ALTER INDEX "DreLine_budget_idx" RENAME TO "DreLine_budgetId_idx";

-- RenameIndex
ALTER INDEX "DreLine_node_idx" RENAME TO "DreLine_nodeKey_idx";

-- RenameIndex
ALTER INDEX "DreLine_parent_idx" RENAME TO "DreLine_parentKey_idx";

-- RenameIndex
ALTER INDEX "RefreshToken_user_idx" RENAME TO "RefreshToken_userId_idx";
