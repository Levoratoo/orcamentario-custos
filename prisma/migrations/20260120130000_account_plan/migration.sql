-- CreateEnum
CREATE TYPE "AccountPlanType" AS ENUM ('T', 'A');

-- CreateTable
CREATE TABLE "AccountPlan" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL UNIQUE,
  "type" "AccountPlanType" NOT NULL,
  "classification" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL,
  "level" INT NOT NULL,
  "parentId" UUID,
  "isAtiva" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AccountPlan_parent_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountPlan"("id") ON DELETE SET NULL
);

CREATE INDEX "AccountPlan_parent_idx" ON "AccountPlan" ("parentId");
CREATE INDEX "AccountPlan_level_idx" ON "AccountPlan" ("level");

-- CreateTable
CREATE TABLE "ImportJob" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "fileName" TEXT NOT NULL,
  "totalRows" INT NOT NULL,
  "inserted" INT NOT NULL,
  "updated" INT NOT NULL,
  "errors" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
