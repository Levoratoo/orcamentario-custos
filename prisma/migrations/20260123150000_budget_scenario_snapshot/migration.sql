-- CreateTable
CREATE TABLE "BudgetScenarioSnapshot" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "scenarioId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "createdById" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetScenarioSnapshot_scenario_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE,
  CONSTRAINT "BudgetScenarioSnapshot_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "BudgetScenarioSnapshot_scenario_idx" ON "BudgetScenarioSnapshot" ("scenarioId", "createdAt");
