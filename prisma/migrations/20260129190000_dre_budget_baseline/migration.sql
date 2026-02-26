CREATE TABLE "DreBudgetBaseline" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sourceFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DreBudgetBaseline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DreBudgetBaseline_year_accountCode_month_key" ON "DreBudgetBaseline"("year", "accountCode", "month");
CREATE INDEX "DreBudgetBaseline_year_idx" ON "DreBudgetBaseline"("year");
CREATE INDEX "DreBudgetBaseline_accountCode_idx" ON "DreBudgetBaseline"("accountCode");
