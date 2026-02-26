-- migration.sql
CREATE TABLE "ClosingMonth" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "year" INT NOT NULL,
  "kind" "BudgetKind" NOT NULL,
  "closingMonth" INT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "ClosingMonth_year_kind" ON "ClosingMonth" ("year", "kind");
