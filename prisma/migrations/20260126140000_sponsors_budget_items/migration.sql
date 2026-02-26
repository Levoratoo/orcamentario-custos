-- migration.sql
CREATE TABLE "AccountSponsor" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "accountCode" TEXT NOT NULL,
  "costCenterId" UUID,
  "sponsorUserId" UUID,
  "sponsorDisplay" TEXT NOT NULL,
  "activeFrom" TIMESTAMP,
  "activeTo" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AccountSponsor_user_fkey" FOREIGN KEY ("sponsorUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "AccountSponsor_costcenter_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL
);
CREATE INDEX "AccountSponsor_account_idx" ON "AccountSponsor" ("accountCode", "costCenterId");
CREATE INDEX "AccountSponsor_sponsor_idx" ON "AccountSponsor" ("sponsorUserId");

CREATE TABLE "BudgetItem" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "budgetId" UUID NOT NULL,
  "accountCode" TEXT NOT NULL,
  "costCenterId" UUID,
  "itemName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isReimbursement" BOOLEAN NOT NULL DEFAULT FALSE,
  "comment" TEXT,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetItem_budget_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE,
  CONSTRAINT "BudgetItem_user_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "BudgetItem_costcenter_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL
);
CREATE INDEX "BudgetItem_budget_idx" ON "BudgetItem" ("budgetId");
CREATE INDEX "BudgetItem_budget_account_idx" ON "BudgetItem" ("budgetId", "accountCode", "costCenterId");

CREATE TABLE "BudgetItemValue" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "budgetItemId" UUID NOT NULL,
  "month" INT NOT NULL,
  "value" NUMERIC NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetItemValue_item_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "BudgetItemValue_unique" ON "BudgetItemValue" ("budgetItemId", "month");
CREATE INDEX "BudgetItemValue_item_idx" ON "BudgetItemValue" ("budgetItemId");
