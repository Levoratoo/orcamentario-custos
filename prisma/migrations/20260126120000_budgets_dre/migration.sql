-- migration.sql
DO $$
BEGIN
  CREATE TYPE "BudgetKind" AS ENUM ('BUDGET', 'ACTUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'READY', 'PROCESSING', 'ERROR', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DreMode" AS ENUM ('PREVISTO', 'REALIZADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "Budget" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "year" INT NOT NULL,
  "kind" "BudgetKind" NOT NULL DEFAULT 'BUDGET',
  "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "fileName" TEXT,
  "notes" TEXT,
  "version" INT NOT NULL DEFAULT 1,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "Budget_year_idx" ON "Budget" ("year");
CREATE INDEX "Budget_kind_active_idx" ON "Budget" ("kind", "isActive");

CREATE TABLE "BudgetImport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "budgetId" UUID NOT NULL,
  "version" INT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" "BudgetStatus" NOT NULL,
  "errorMessage" TEXT,
  "uploadedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetImport_budget_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE
);

CREATE INDEX "BudgetImport_budget_idx" ON "BudgetImport" ("budgetId", "uploadedAt");

CREATE TABLE "DreLine" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "budgetId" UUID NOT NULL,
  "nodeKey" TEXT NOT NULL,
  "parentKey" TEXT,
  "level" INT NOT NULL,
  "sortOrder" INT NOT NULL,
  "accountCode" TEXT,
  "accountName" TEXT NOT NULL,
  "groupPath" TEXT NOT NULL,
  "month" INT,
  "mode" "DreMode" NOT NULL,
  "value" NUMERIC NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "DreLine_budget_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE
);

CREATE INDEX "DreLine_budget_idx" ON "DreLine" ("budgetId");
CREATE INDEX "DreLine_node_idx" ON "DreLine" ("nodeKey");
CREATE INDEX "DreLine_parent_idx" ON "DreLine" ("parentKey");
CREATE INDEX "DreLine_month_idx" ON "DreLine" ("month");
