import { Injectable } from '@nestjs/common';
import { BscImportStatus, BscPerspectiveName, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseWorkbookSheets } from './parsers/parseWorkbook';
import { parseMapaSheet } from './parsers/parseMapaSheet';
import { parseGestaoSheet } from './parsers/parseGestaoSheet';
import { parseIndicatorSheet } from './parsers/parseIndicatorSheet';
import { parseProjectSheet } from './parsers/parseProjectSheet';
import { parseBaseSheet } from './parsers/parseBaseSheet';
import { parseTabSheet } from './parsers/parseTabSheet';
import { fileSha256, slugify } from './utils/normalize';
import { logImportInfo, pushWarning, type ImportWarningLog } from './utils/logger';
import { BscImportsRepo } from '../repositories/bscImports.repo';
import { BscPerspectiveRepo } from '../repositories/bscPerspective.repo';
import { BscObjectiveRepo } from '../repositories/bscObjective.repo';
import { BscIndicatorRepo } from '../repositories/bscIndicator.repo';
import { BscTargetsRepo } from '../repositories/bscTargets.repo';
import { BscActualsRepo } from '../repositories/bscActuals.repo';
import { BscActionPlansRepo } from '../repositories/bscActionPlans.repo';
import { BscProjectsRepo } from '../repositories/bscProjects.repo';
import { BscTasksRepo } from '../repositories/bscTasks.repo';
import { BscSnapshotsRepo } from '../repositories/bscSnapshots.repo';
import { inferParentWbs, inferWbsLevel } from './utils/wbs';

type Counters = {
  objectivesCreated: number;
  objectivesUpdated: number;
  indicatorsCreated: number;
  indicatorsUpdated: number;
  yearTargetsCreated: number;
  yearTargetsUpdated: number;
  monthTargetsCreated: number;
  monthTargetsUpdated: number;
  monthActualsCreated: number;
  monthActualsUpdated: number;
  actionPlansInserted: number;
  projectsCreated: number;
  projectsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  snapshotsCreated: number;
  snapshotsUpdated: number;
};

const defaultCounters = (): Counters => ({
  objectivesCreated: 0,
  objectivesUpdated: 0,
  indicatorsCreated: 0,
  indicatorsUpdated: 0,
  yearTargetsCreated: 0,
  yearTargetsUpdated: 0,
  monthTargetsCreated: 0,
  monthTargetsUpdated: 0,
  monthActualsCreated: 0,
  monthActualsUpdated: 0,
  actionPlansInserted: 0,
  projectsCreated: 0,
  projectsUpdated: 0,
  tasksCreated: 0,
  tasksUpdated: 0,
  snapshotsCreated: 0,
  snapshotsUpdated: 0,
});

@Injectable()
export class BscExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: BscImportsRepo,
    private readonly perspectiveRepo: BscPerspectiveRepo,
    private readonly objectiveRepo: BscObjectiveRepo,
    private readonly indicatorRepo: BscIndicatorRepo,
    private readonly targetsRepo: BscTargetsRepo,
    private readonly actualsRepo: BscActualsRepo,
    private readonly actionPlansRepo: BscActionPlansRepo,
    private readonly projectsRepo: BscProjectsRepo,
    private readonly tasksRepo: BscTasksRepo,
    private readonly snapshotsRepo: BscSnapshotsRepo,
  ) {}

  listImports() {
    return this.importsRepo.list();
  }

  getImport(id: string) {
    return this.importsRepo.findById(id);
  }

  async importExcel(file: Express.Multer.File, userId?: string, force = false) {
    return this.import(file.buffer, file.originalname, userId ?? null, { force });
  }

  async import(
    buffer: Buffer,
    fileName: string,
    userId?: string | null,
    options?: { force?: boolean },
  ) {
    const hash = fileSha256(buffer);
    if (!options?.force) {
      const existing = await this.prisma.bscImport.findFirst({
        where: { fileHash: hash, status: { in: [BscImportStatus.SUCCESS, BscImportStatus.PARTIAL] } },
        orderBy: { startedAt: 'desc' },
      });
      if (existing) {
        return {
          importId: existing.id,
          status: existing.status,
          reused: true,
          warningsCount: Array.isArray(existing.warnings) ? (existing.warnings as any[]).length : 0,
          counters: existing.counters ?? {},
        };
      }
    }

    const job = await this.importsRepo.createStart({
      fileName,
      fileHash: hash,
      importedById: userId ?? null,
    });

    const warnings: ImportWarningLog[] = [];
    const counters = defaultCounters();

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const grouped = parseWorkbookSheets(workbook);

      if (!grouped.mapa) {
        pushWarning(warnings, {
          sheetName: 'MAPA',
          rowIndex: 0,
          message: 'Aba MAPA não encontrada.',
          type: 'missing_sheet',
        });
      }

      await this.prisma.$transaction(
        async (tx) => {
          const indicatorIdByCode = new Map<string, string>();
          const objectiveIdBySlug = new Map<string, string>();
          const fileYear = this.extractYearFromFileName(fileName);
          let monthlyYear = fileYear ?? null;

          if (grouped.mapa) {
            const detectedYear = await this.processMapa(
              tx,
              grouped.mapa,
              indicatorIdByCode,
              objectiveIdBySlug,
              warnings,
              counters,
            );
            if (!monthlyYear) {
              monthlyYear = detectedYear;
            }
          } else {
            throw new Error('MAPA_MISSING');
          }

          if (!monthlyYear) {
            monthlyYear = 2025;
          }

          if (grouped.gestao) {
            await this.processGestao(tx, grouped.gestao, indicatorIdByCode, warnings, counters, monthlyYear);
          }

          for (const sheet of grouped.indicatorSheets) {
            await this.processIndicatorSheet(tx, sheet, indicatorIdByCode, warnings, counters, monthlyYear);
          }

          for (const item of grouped.projectSheets) {
            await this.processProjectSheet(tx, item.sheet, item.snapshotDate, warnings, counters);
          }

          if (grouped.baseSheet) {
            await this.processBaseSheet(tx, grouped.baseSheet, warnings, counters);
          }

          if (grouped.tabSheet) {
            await this.processTabSheet(tx, grouped.tabSheet, warnings, counters);
          }
        },
        {
          timeout: 120000,
          maxWait: 10000,
        },
      );

      const status = warnings.length > 0 ? BscImportStatus.PARTIAL : BscImportStatus.SUCCESS;
      if (status === BscImportStatus.PARTIAL) {
        await this.importsRepo.finishPartial(
          job.id,
          warnings as unknown as Prisma.JsonValue,
          counters as unknown as Prisma.JsonValue,
        );
      } else {
        await this.importsRepo.finishSuccess(
          job.id,
          warnings as unknown as Prisma.JsonValue,
          counters as unknown as Prisma.JsonValue,
        );
      }

      return {
        importId: job.id,
        status,
        warningsCount: warnings.length,
        counters,
      };
    } catch (error: any) {
      await this.importsRepo.finishFailed(
        job.id,
        warnings as unknown as Prisma.JsonValue,
        counters as unknown as Prisma.JsonValue,
        String(error?.message ?? error),
      );
      throw error;
    }
  }

  private extractYearFromFileName(fileName: string): number | null {
    const matches = fileName.match(/20\d{2}/g);
    if (!matches || matches.length === 0) return null;
    const candidate = Number(matches[matches.length - 1]);
    if (Number.isNaN(candidate)) return null;
    return candidate;
  }

  private perspectiveOrder(name: BscPerspectiveName) {
    return {
      [BscPerspectiveName.FINANCEIRO]: 1,
      [BscPerspectiveName.CLIENTE]: 2,
      [BscPerspectiveName.PROCESSOS]: 3,
      [BscPerspectiveName.APRENDIZADO_CRESCIMENTO]: 4,
    }[name];
  }

  private async ensureObjective(
    perspectiveId: string,
    perspectiveName: BscPerspectiveName,
    objectiveName: string,
    counters: Counters,
  ) {
    const normalized = objectiveName.trim() || 'Objetivo sem nome';
    const slug = `${slugify(perspectiveName)}-${slugify(normalized)}`;
    const existing = await this.objectiveRepo.findBySlug(slug);
    if (existing) {
      await this.objectiveRepo.update(existing.id, { perspectiveId, name: normalized });
      counters.objectivesUpdated += 1;
      return existing.id;
    }
    const created = await this.objectiveRepo.create({
      perspectiveId,
      name: normalized,
      slug,
    });
    counters.objectivesCreated += 1;
    return created.id;
  }

  private async ensureIndicator(
    code: string,
    objectiveId: string,
    data: {
      name: string;
      responsible?: string | null;
      dataOwner?: string | null;
      keywords?: string | null;
      level?: number | null;
      process?: string | null;
      needsReview?: boolean;
    },
    counters: Counters,
  ) {
    const existing = await this.indicatorRepo.findByCode(code);
    if (existing) {
      await this.indicatorRepo.update(existing.id, { objectiveId, ...data });
      counters.indicatorsUpdated += 1;
      return existing.id;
    }
    const created = await this.indicatorRepo.create({ code, objectiveId, ...data });
    counters.indicatorsCreated += 1;
    return created.id;
  }

  private async ensurePlaceholderIndicator(code: string, counters: Counters) {
    const perspective = await this.perspectiveRepo.upsert(
      BscPerspectiveName.PROCESSOS,
      this.perspectiveOrder(BscPerspectiveName.PROCESSOS),
    );
    const objectiveId = await this.ensureObjective(
      perspective.id,
      BscPerspectiveName.PROCESSOS,
      'Objetivo não mapeado (import)',
      counters,
    );
    return this.ensureIndicator(
      code,
      objectiveId,
      {
        name: code,
        needsReview: true,
      },
      counters,
    );
  }

  private async processMapa(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    indicatorIdByCode: Map<string, string>,
    _objectiveIdBySlug: Map<string, string>,
    warnings: ImportWarningLog[],
    counters: Counters,
  ): Promise<number | null> {
    const parsed = parseMapaSheet(sheet);
    if (!parsed.headerRowIndex) {
      throw new Error('MAPA_HEADER_NOT_FOUND');
    }

    const yearSet = new Set<number>();

    for (const row of parsed.rows) {
      if (!row.perspective || !row.indicatorCode) {
        if (row.objective || row.indicatorName) {
          pushWarning(warnings, {
            sheetName: sheet.name,
            rowIndex: row.rowIndex,
            message: 'Linha MAPA inválida (perspectiva/código ausente).',
            type: 'mapa_invalid_row',
          });
        }
        continue;
      }

      const perspective = await this.perspectiveRepo.upsert(
        row.perspective,
        this.perspectiveOrder(row.perspective),
      );
      const objectiveId = await this.ensureObjective(
        perspective.id,
        row.perspective,
        row.objective,
        counters,
      );
      const indicatorId = await this.ensureIndicator(
        row.indicatorCode,
        objectiveId,
        {
          name: row.indicatorName || row.indicatorCode,
          responsible: row.responsible,
          dataOwner: row.dataOwner,
          keywords: row.keywords,
          level: row.level,
          process: row.process,
          needsReview: false,
        },
        counters,
      );
      indicatorIdByCode.set(row.indicatorCode, indicatorId);

      for (const target of row.annualTargets) {
        yearSet.add(target.year);
        const before = await this.prisma.bscIndicatorYearTarget.findUnique({
          where: { indicatorId_year: { indicatorId, year: target.year } },
          select: { id: true },
        });
        await this.targetsRepo.upsertYearTarget(
          indicatorId,
          target.year,
          target.targetValue,
          target.rawValue == null ? null : String(target.rawValue),
        );
        if (before) counters.yearTargetsUpdated += 1;
        else counters.yearTargetsCreated += 1;
        if (target.rawValue != null && target.targetValue == null) {
          pushWarning(warnings, {
            sheetName: sheet.name,
            rowIndex: row.rowIndex,
            message: `Meta anual ${target.year} não numérica para ${row.indicatorCode}.`,
            type: 'non_numeric_year_target',
          });
        }
      }
    }

    logImportInfo('mapa', {
      objectivesCreated: counters.objectivesCreated,
      objectivesUpdated: counters.objectivesUpdated,
      indicatorsCreated: counters.indicatorsCreated,
      indicatorsUpdated: counters.indicatorsUpdated,
      yearTargetsCreated: counters.yearTargetsCreated,
      yearTargetsUpdated: counters.yearTargetsUpdated,
    });

    if (yearSet.size === 0) return null;
    const sorted = Array.from(yearSet).sort((a, b) => a - b);
    return sorted[0] ?? null;
  }

  private async processGestao(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    indicatorIdByCode: Map<string, string>,
    warnings: ImportWarningLog[],
    counters: Counters,
    year: number,
  ) {
    const parsed = parseGestaoSheet(sheet);
    if (!parsed.headerRowIndex) {
      pushWarning(warnings, {
        sheetName: sheet.name,
        rowIndex: 0,
        message: 'Header da aba GESTAO não encontrado.',
        type: 'gestao_header_missing',
      });
      return;
    }

    for (const row of parsed.rows) {
      if (!row.indicatorCode) continue;
      let indicatorId = indicatorIdByCode.get(row.indicatorCode) ?? null;
      if (!indicatorId) {
        indicatorId = await this.ensurePlaceholderIndicator(row.indicatorCode, counters);
        indicatorIdByCode.set(row.indicatorCode, indicatorId);
        pushWarning(warnings, {
          sheetName: sheet.name,
          rowIndex: row.rowIndex,
          message: `Indicador ${row.indicatorCode} não estava no MAPA (placeholder criado).`,
          type: 'placeholder_indicator',
        });
      }

      if (row.yearTargetRaw != null) {
        const before = await this.prisma.bscIndicatorYearTarget.findUnique({
          where: { indicatorId_year: { indicatorId, year } },
          select: { id: true },
        });
        await this.targetsRepo.upsertYearTarget(
          indicatorId,
          year,
          row.yearTargetValue,
          row.yearTargetRaw == null ? null : String(row.yearTargetRaw),
        );
        if (before) counters.yearTargetsUpdated += 1;
        else counters.yearTargetsCreated += 1;
      }

      for (const monthTarget of row.monthTargets) {
        const before = await this.prisma.bscIndicatorMonthTarget.findUnique({
          where: { indicatorId_year_month: { indicatorId, year, month: monthTarget.month } },
          select: { id: true, targetValue: true },
        });
        if (before && before.targetValue != null && monthTarget.value != null && Number(before.targetValue) !== monthTarget.value) {
          pushWarning(warnings, {
            sheetName: sheet.name,
            rowIndex: row.rowIndex,
            message: `Conflito meta mensal em ${row.indicatorCode} M${monthTarget.month} (GESTAO vs valor anterior).`,
            type: 'target_conflict',
          });
        }
        await this.targetsRepo.upsertMonthTarget(
          indicatorId,
          year,
          monthTarget.month,
          monthTarget.value,
          monthTarget.rawValue == null ? null : String(monthTarget.rawValue),
        );
        if (before) counters.monthTargetsUpdated += 1;
        else counters.monthTargetsCreated += 1;
      }

      for (const monthActual of row.monthActuals) {
        const before = await this.prisma.bscIndicatorMonthActual.findUnique({
          where: { indicatorId_year_month: { indicatorId, year, month: monthActual.month } },
          select: { id: true },
        });
        await this.actualsRepo.upsertMonthActual(
          indicatorId,
          year,
          monthActual.month,
          monthActual.value,
          monthActual.rawValue == null ? null : String(monthActual.rawValue),
        );
        if (before) counters.monthActualsUpdated += 1;
        else counters.monthActualsCreated += 1;
      }
    }

    logImportInfo('gestao', {
      monthTargetsCreated: counters.monthTargetsCreated,
      monthTargetsUpdated: counters.monthTargetsUpdated,
      monthActualsCreated: counters.monthActualsCreated,
      monthActualsUpdated: counters.monthActualsUpdated,
    });
  }

  private async processIndicatorSheet(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    indicatorIdByCode: Map<string, string>,
    warnings: ImportWarningLog[],
    counters: Counters,
    year: number,
  ) {
    const codeMatch = sheet.name.trim().match(/^([FCPA]\d+(?:\.\d+){0,2})/i);
    if (!codeMatch) return;
    const code = codeMatch[1].toUpperCase();
    let indicatorId = indicatorIdByCode.get(code) ?? null;
    if (!indicatorId) {
      indicatorId = await this.ensurePlaceholderIndicator(code, counters);
      indicatorIdByCode.set(code, indicatorId);
      pushWarning(warnings, {
        sheetName: sheet.name,
        rowIndex: 0,
        message: `Indicador ${code} não encontrado previamente (placeholder).`,
        type: 'placeholder_indicator',
      });
    }

    const parsed = parseIndicatorSheet(sheet);

      for (const monthly of parsed.monthlyRows) {
        if (monthly.targetRaw != null || monthly.targetValue != null) {
          const before = await this.prisma.bscIndicatorMonthTarget.findUnique({
            where: { indicatorId_year_month: { indicatorId, year, month: monthly.month } },
            select: { id: true, targetValue: true, rawValue: true },
          });
          const existingValue = before?.targetValue == null ? null : Number(before.targetValue);
          const incomingValue = monthly.targetValue;
          const incomingRaw = monthly.targetRaw == null ? '' : String(monthly.targetRaw).trim();
          const hasIncomingSignal = incomingRaw !== '' || incomingValue != null;
          const shouldSkipBecauseGestaoIsBetter =
            before != null &&
            existingValue != null &&
            existingValue !== 0 &&
            hasIncomingSignal &&
            (incomingValue == null || incomingValue === 0);

          if (!shouldSkipBecauseGestaoIsBetter) {
            await this.targetsRepo.upsertMonthTarget(
              indicatorId,
              year,
              monthly.month,
              incomingValue,
              monthly.targetRaw == null ? null : String(monthly.targetRaw),
            );
            if (before) counters.monthTargetsUpdated += 1;
            else counters.monthTargetsCreated += 1;
          }
        }
        if (monthly.actualRaw != null || monthly.actualValue != null) {
          const before = await this.prisma.bscIndicatorMonthActual.findUnique({
            where: { indicatorId_year_month: { indicatorId, year, month: monthly.month } },
            select: { id: true },
          });
          await this.actualsRepo.upsertMonthActual(
            indicatorId,
            year,
            monthly.month,
            monthly.actualValue,
            monthly.actualRaw == null ? null : String(monthly.actualRaw),
        );
        if (before) counters.monthActualsUpdated += 1;
        else counters.monthActualsCreated += 1;
      }
    }

    await this.actionPlansRepo.deleteByIndicatorAndSheet(indicatorId, sheet.name);
    for (const action of parsed.actionRows) {
      await this.actionPlansRepo.create({
        indicatorId,
        period: action.period,
        fact: action.fact,
        priority: action.priority,
        cause: action.cause,
        action: action.action,
        owner: action.owner,
        dueDate: action.dueDateIso ? new Date(`${action.dueDateIso}T00:00:00.000Z`) : null,
        effectiveness: action.effectiveness,
        relatedIndicators: action.relatedIndicators,
        sourceSheet: sheet.name,
        rowIndex: action.rowIndex,
      });
      counters.actionPlansInserted += 1;
    }
  }

  private async processProjectSheet(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    snapshotDate: string | null,
    warnings: ImportWarningLog[],
    counters: Counters,
  ) {
    const parsed = parseProjectSheet(sheet);
    const effectiveSnapshot = snapshotDate ?? parsed.snapshotDate;
    if (!effectiveSnapshot) {
      pushWarning(warnings, {
        sheetName: sheet.name,
        rowIndex: 0,
        message: 'Snapshot não encontrado no nome da aba project.',
        type: 'project_snapshot_missing',
      });
      return;
    }

    const project = await this.projectsRepo.upsertByNameAndSnapshot(
      parsed.projectName,
      new Date(`${effectiveSnapshot}T00:00:00.000Z`),
    );
    const projectWasExisting = await this.prisma.bscProject.count({
      where: { id: project.id },
    });
    if (projectWasExisting > 0) counters.projectsUpdated += 1;

    for (const task of parsed.tasks) {
      const existingTask = await this.prisma.bscProjectTask.findUnique({
        where: { projectId_wbs_name: { projectId: project.id, wbs: task.wbs, name: task.name } },
        select: { id: true },
      });
      const taskRow = await this.tasksRepo.upsertByNaturalKey(
        project.id,
        task.wbs,
        task.name,
        {
          assignee: task.assignee,
          startDate: task.startDateIso ? new Date(`${task.startDateIso}T00:00:00.000Z`) : null,
          endDate: task.endDateIso ? new Date(`${task.endDateIso}T00:00:00.000Z`) : null,
          duration: task.duration,
          bucket: task.bucket,
          percentComplete: task.percentComplete,
          parentWbs: inferParentWbs(task.wbs),
          level: inferWbsLevel(task.wbs),
        },
      );
      if (existingTask) counters.tasksUpdated += 1;
      else counters.tasksCreated += 1;

      const existingSnapshot = await this.prisma.bscTaskSnapshot.findUnique({
        where: {
          taskId_snapshotDate: {
            taskId: taskRow.id,
            snapshotDate: new Date(`${effectiveSnapshot}T00:00:00.000Z`),
          },
        },
        select: { id: true },
      });
      await this.snapshotsRepo.upsertTaskSnapshot(
        taskRow.id,
        new Date(`${effectiveSnapshot}T00:00:00.000Z`),
        task.percentComplete,
      );
      if (existingSnapshot) counters.snapshotsUpdated += 1;
      else counters.snapshotsCreated += 1;
    }
  }

  private async processBaseSheet(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    _warnings: ImportWarningLog[],
    counters: Counters,
  ) {
    const rows = parseBaseSheet(sheet);
    for (const row of rows) {
      const project = await this.projectsRepo.upsertByNameAndSnapshot(
        'BSC Printbag',
        new Date(`${row.snapshotDate}T00:00:00.000Z`),
      );
      const existingTask = await this.prisma.bscProjectTask.findUnique({
        where: { projectId_wbs_name: { projectId: project.id, wbs: row.wbs, name: row.name } },
        select: { id: true },
      });
      const task = await this.tasksRepo.upsertByNaturalKey(project.id, row.wbs, row.name, {
        percentComplete: row.percentComplete,
        parentWbs: inferParentWbs(row.wbs),
        level: inferWbsLevel(row.wbs),
      });
      if (existingTask) counters.tasksUpdated += 1;
      else counters.tasksCreated += 1;

      const existingSnapshot = await this.prisma.bscTaskSnapshot.findUnique({
        where: {
          taskId_snapshotDate: {
            taskId: task.id,
            snapshotDate: new Date(`${row.snapshotDate}T00:00:00.000Z`),
          },
        },
        select: { id: true },
      });
      await this.snapshotsRepo.upsertTaskSnapshot(
        task.id,
        new Date(`${row.snapshotDate}T00:00:00.000Z`),
        row.percentComplete,
      );
      if (existingSnapshot) counters.snapshotsUpdated += 1;
      else counters.snapshotsCreated += 1;
    }
  }

  private async processTabSheet(
    _tx: Prisma.TransactionClient,
    sheet: ExcelJS.Worksheet,
    warnings: ImportWarningLog[],
    counters: Counters,
  ) {
    const parsed = parseTabSheet(sheet);
    if (parsed.cells.length === 0) return;
    const tasks = await this.prisma.bscProjectTask.findMany({
      select: { id: true, wbs: true, name: true },
    });
    const byWbs = new Map<string, string>();
    const byName = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.wbs) byWbs.set(task.wbs.toUpperCase(), task.id);
      byName.set(task.name.toUpperCase(), task.id);
    });

    let matched = 0;
    for (const cell of parsed.cells) {
      const taskId = byWbs.get(cell.wbsOrName) ?? byName.get(cell.wbsOrName) ?? null;
      if (!taskId) continue;
      matched += 1;
      const existingSnapshot = await this.prisma.bscTaskSnapshot.findUnique({
        where: {
          taskId_snapshotDate: {
            taskId,
            snapshotDate: new Date(`${cell.snapshotDate}T00:00:00.000Z`),
          },
        },
        select: { id: true },
      });
      await this.snapshotsRepo.upsertTaskSnapshot(
        taskId,
        new Date(`${cell.snapshotDate}T00:00:00.000Z`),
        cell.percentComplete,
      );
      if (existingSnapshot) counters.snapshotsUpdated += 1;
      else counters.snapshotsCreated += 1;
    }

    const matchRate = parsed.cells.length > 0 ? matched / parsed.cells.length : 0;
    if (matchRate < 0.7) {
      pushWarning(warnings, {
        sheetName: sheet.name,
        rowIndex: parsed.headerRow,
        message: `TAB com baixa taxa de match (${(matchRate * 100).toFixed(1)}%).`,
        type: 'tab_low_match',
      });
    }
  }
}
