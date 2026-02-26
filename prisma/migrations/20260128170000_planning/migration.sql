-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

UPDATE "User"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-z0-9]+', '.', 'g'))
WHERE "username" IS NULL AND "email" IS NOT NULL;

UPDATE "User"
SET "username" = concat('user.', "id")
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable
CREATE TABLE "Proacao" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Proacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningAccount" (
  "id" TEXT NOT NULL,
  "proacaoId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanningAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningValue" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanningValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proacao_name_key" ON "Proacao"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningAccount_proacaoId_code_ownerUserId_key" ON "PlanningAccount"("proacaoId", "code", "ownerUserId");

-- CreateIndex
CREATE INDEX "PlanningAccount_proacaoId_idx" ON "PlanningAccount"("proacaoId");

-- CreateIndex
CREATE INDEX "PlanningAccount_ownerUserId_idx" ON "PlanningAccount"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningValue_accountId_year_month_key" ON "PlanningValue"("accountId", "year", "month");

-- CreateIndex
CREATE INDEX "PlanningValue_accountId_year_idx" ON "PlanningValue"("accountId", "year");

-- AddForeignKey
ALTER TABLE "PlanningAccount" ADD CONSTRAINT "PlanningAccount_proacaoId_fkey" FOREIGN KEY ("proacaoId") REFERENCES "Proacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningAccount" ADD CONSTRAINT "PlanningAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningValue" ADD CONSTRAINT "PlanningValue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlanningAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningValue" ADD CONSTRAINT "PlanningValue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


