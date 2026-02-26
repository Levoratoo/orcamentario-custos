-- CreateTable
CREATE TABLE "UserAccountAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserAccountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccountAssignment_userId_accountId_key" ON "UserAccountAssignment"("userId", "accountId");

-- CreateIndex
CREATE INDEX "UserAccountAssignment_userId_idx" ON "UserAccountAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserAccountAssignment_accountId_idx" ON "UserAccountAssignment"("accountId");

-- CreateIndex
CREATE INDEX "UserAccountAssignment_createdById_idx" ON "UserAccountAssignment"("createdById");

-- AddForeignKey
ALTER TABLE "UserAccountAssignment" ADD CONSTRAINT "UserAccountAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountAssignment" ADD CONSTRAINT "UserAccountAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlanningAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountAssignment" ADD CONSTRAINT "UserAccountAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
