-- migration.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONTROLLER', 'COORDINATOR');
CREATE TYPE "ScenarioStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED');
CREATE TYPE "DriverType" AS ENUM ('FIXED', 'HEADCOUNT', 'PERCENT_PAYROLL', 'CONTRACT', 'CONSUMPTION', 'OTHER');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "CoordinatorProfile" (
  "userId" UUID PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "phone" TEXT,
  CONSTRAINT "CoordinatorProfile_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "CostCenter" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "ownerCoordinatorId" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "CostCenter_owner_fkey" FOREIGN KEY ("ownerCoordinatorId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX "CostCenter_owner_idx" ON "CostCenter" ("ownerCoordinatorId");

CREATE TABLE "Account" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Scenario" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "year" INT NOT NULL,
  "status" "ScenarioStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "submittedAt" TIMESTAMP,
  "approvedAt" TIMESTAMP,
  "lockedAt" TIMESTAMP,
  CONSTRAINT "Scenario_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE INDEX "Scenario_status_idx" ON "Scenario" ("status");

CREATE TABLE "BudgetLine" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "scenarioId" UUID NOT NULL,
  "costCenterId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "driverType" "DriverType" NOT NULL,
  "driverValue" JSONB,
  "monthlyValues" JSONB NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "assumptions" TEXT,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetLine_scenario_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE,
  CONSTRAINT "BudgetLine_costcenter_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT,
  CONSTRAINT "BudgetLine_account_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT,
  CONSTRAINT "BudgetLine_createdBy_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "BudgetLine_updatedBy_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE INDEX "BudgetLine_scenario_idx" ON "BudgetLine" ("scenarioId");
CREATE INDEX "BudgetLine_costcenter_idx" ON "BudgetLine" ("costCenterId");
CREATE INDEX "BudgetLine_account_idx" ON "BudgetLine" ("accountId");
CREATE UNIQUE INDEX "BudgetLine_unique" ON "BudgetLine" ("scenarioId", "costCenterId", "accountId", "description");

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorUserId" UUID NOT NULL,
  "requestId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AuditLog_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog" ("entityType", "entityId");

CREATE TABLE "RefreshToken" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "revokedAt" TIMESTAMP,
  "replacedBy" UUID,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "RefreshToken_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "RefreshToken_user_idx" ON "RefreshToken" ("userId");

CREATE TABLE "Attachment" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
