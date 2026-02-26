-- CreateEnum
CREATE TYPE "BscPerspectiveName" AS ENUM ('FINANCEIRO', 'CLIENTE', 'PROCESSOS', 'APRENDIZADO_CRESCIMENTO');

-- CreateEnum
CREATE TYPE "BscIndicatorDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- CreateEnum
CREATE TYPE "BscImportStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "BscImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "BscImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "warnings" JSONB,
    "counters" JSONB,
    "errorMessage" TEXT,
    "importedById" TEXT,

    CONSTRAINT "BscImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscPerspective" (
    "id" TEXT NOT NULL,
    "name" "BscPerspectiveName" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscPerspective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscObjective" (
    "id" TEXT NOT NULL,
    "perspectiveId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscIndicator" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsible" TEXT,
    "dataOwner" TEXT,
    "level" INTEGER,
    "process" TEXT,
    "direction" "BscIndicatorDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscIndicatorYearTarget" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "targetValue" DECIMAL(65,30),
    "rawValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscIndicatorYearTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscIndicatorMonthTarget" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetValue" DECIMAL(65,30),
    "rawValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscIndicatorMonthTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscIndicatorMonthActual" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "actualValue" DECIMAL(65,30),
    "rawValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscIndicatorMonthActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscIndicatorActionPlan" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "period" TEXT,
    "fact" TEXT,
    "priority" TEXT,
    "cause" TEXT,
    "action" TEXT,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "effectiveness" TEXT,
    "relatedIndicators" TEXT,
    "sourceSheet" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscIndicatorActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "owner" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "duration" TEXT,
    "percentComplete" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbs" TEXT,
    "name" TEXT NOT NULL,
    "assignee" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "duration" TEXT,
    "bucket" TEXT,
    "percentComplete" DECIMAL(65,30),
    "parentWbs" TEXT,
    "level" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BscTaskSnapshot" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "percentComplete" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BscTaskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BscImport_fileHash_idx" ON "BscImport"("fileHash");

-- CreateIndex
CREATE INDEX "BscImport_startedAt_idx" ON "BscImport"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BscPerspective_name_key" ON "BscPerspective"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BscObjective_slug_key" ON "BscObjective"("slug");

-- CreateIndex
CREATE INDEX "BscObjective_perspectiveId_idx" ON "BscObjective"("perspectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "BscIndicator_code_key" ON "BscIndicator"("code");

-- CreateIndex
CREATE INDEX "BscIndicator_objectiveId_idx" ON "BscIndicator"("objectiveId");

-- CreateIndex
CREATE INDEX "BscIndicatorYearTarget_year_idx" ON "BscIndicatorYearTarget"("year");

-- CreateIndex
CREATE UNIQUE INDEX "BscIndicatorYearTarget_indicatorId_year_key" ON "BscIndicatorYearTarget"("indicatorId", "year");

-- CreateIndex
CREATE INDEX "BscIndicatorMonthTarget_year_month_idx" ON "BscIndicatorMonthTarget"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BscIndicatorMonthTarget_indicatorId_year_month_key" ON "BscIndicatorMonthTarget"("indicatorId", "year", "month");

-- CreateIndex
CREATE INDEX "BscIndicatorMonthActual_year_month_idx" ON "BscIndicatorMonthActual"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BscIndicatorMonthActual_indicatorId_year_month_key" ON "BscIndicatorMonthActual"("indicatorId", "year", "month");

-- CreateIndex
CREATE INDEX "BscIndicatorActionPlan_indicatorId_idx" ON "BscIndicatorActionPlan"("indicatorId");

-- CreateIndex
CREATE INDEX "BscIndicatorActionPlan_sourceSheet_rowIndex_idx" ON "BscIndicatorActionPlan"("sourceSheet", "rowIndex");

-- CreateIndex
CREATE INDEX "BscProject_snapshotDate_idx" ON "BscProject"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "BscProject_name_snapshotDate_key" ON "BscProject"("name", "snapshotDate");

-- CreateIndex
CREATE INDEX "BscProjectTask_projectId_idx" ON "BscProjectTask"("projectId");

-- CreateIndex
CREATE INDEX "BscProjectTask_wbs_idx" ON "BscProjectTask"("wbs");

-- CreateIndex
CREATE UNIQUE INDEX "BscProjectTask_projectId_wbs_name_key" ON "BscProjectTask"("projectId", "wbs", "name");

-- CreateIndex
CREATE INDEX "BscTaskSnapshot_snapshotDate_idx" ON "BscTaskSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "BscTaskSnapshot_taskId_snapshotDate_key" ON "BscTaskSnapshot"("taskId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "BscImport" ADD CONSTRAINT "BscImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscObjective" ADD CONSTRAINT "BscObjective_perspectiveId_fkey" FOREIGN KEY ("perspectiveId") REFERENCES "BscPerspective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscIndicator" ADD CONSTRAINT "BscIndicator_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "BscObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscIndicatorYearTarget" ADD CONSTRAINT "BscIndicatorYearTarget_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "BscIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscIndicatorMonthTarget" ADD CONSTRAINT "BscIndicatorMonthTarget_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "BscIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscIndicatorMonthActual" ADD CONSTRAINT "BscIndicatorMonthActual_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "BscIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscIndicatorActionPlan" ADD CONSTRAINT "BscIndicatorActionPlan_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "BscIndicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscProjectTask" ADD CONSTRAINT "BscProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BscProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BscTaskSnapshot" ADD CONSTRAINT "BscTaskSnapshot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "BscProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ImportedBudget2026Entry_year_month_scenario_coordinatorId_accou" RENAME TO "ImportedBudget2026Entry_year_month_scenario_coordinatorId_a_key";

