CREATE TABLE "ImportedBudget2026Entry" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "coordinatorName" TEXT NOT NULL,
    "accountPathId" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "detailLabel" TEXT,
    "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'IMPORT_XLSX_PRO_ACAO_2026',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedBudget2026Entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportedBudget2026Entry_year_month_scenario_coordinatorId_accountPathId_key"
  ON "ImportedBudget2026Entry"("year", "month", "scenario", "coordinatorId", "accountPathId");
CREATE INDEX "ImportedBudget2026Entry_year_accountPathId_idx" ON "ImportedBudget2026Entry"("year", "accountPathId");
CREATE INDEX "ImportedBudget2026Entry_coordinatorId_idx" ON "ImportedBudget2026Entry"("coordinatorId");

ALTER TABLE "ImportedBudget2026Entry"
  ADD CONSTRAINT "ImportedBudget2026Entry_coordinatorId_fkey"
  FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
