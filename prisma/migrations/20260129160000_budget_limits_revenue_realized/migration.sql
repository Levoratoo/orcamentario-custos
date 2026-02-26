-- CreateTable
CREATE TABLE "BudgetLimit" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "proacaoId" TEXT NOT NULL,
  "userId" TEXT,
  "maxValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BudgetLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueProjection" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RevenueProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealizedValue" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "accountCode" TEXT NOT NULL,
  "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RealizedValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLimit_year_proacaoId_userId_key" ON "BudgetLimit"("year", "proacaoId", "userId");

-- CreateIndex
CREATE INDEX "BudgetLimit_proacaoId_idx" ON "BudgetLimit"("proacaoId");

-- CreateIndex
CREATE INDEX "BudgetLimit_userId_idx" ON "BudgetLimit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueProjection_year_month_key" ON "RevenueProjection"("year", "month");

-- CreateIndex
CREATE INDEX "RevenueProjection_year_idx" ON "RevenueProjection"("year");

-- CreateIndex
CREATE UNIQUE INDEX "RealizedValue_year_month_accountCode_key" ON "RealizedValue"("year", "month", "accountCode");

-- CreateIndex
CREATE INDEX "RealizedValue_year_idx" ON "RealizedValue"("year");

-- CreateIndex
CREATE INDEX "RealizedValue_accountCode_idx" ON "RealizedValue"("accountCode");

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_proacaoId_fkey" FOREIGN KEY ("proacaoId") REFERENCES "Proacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
