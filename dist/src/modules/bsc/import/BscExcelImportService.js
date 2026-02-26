"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BscExcelImportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = __importStar(require("exceljs"));
const prisma_service_1 = require("../../../prisma/prisma.service");
const parseWorkbook_1 = require("./parsers/parseWorkbook");
const parseMapaSheet_1 = require("./parsers/parseMapaSheet");
const parseGestaoSheet_1 = require("./parsers/parseGestaoSheet");
const parseIndicatorSheet_1 = require("./parsers/parseIndicatorSheet");
const parseProjectSheet_1 = require("./parsers/parseProjectSheet");
const parseBaseSheet_1 = require("./parsers/parseBaseSheet");
const parseTabSheet_1 = require("./parsers/parseTabSheet");
const normalize_1 = require("./utils/normalize");
const logger_1 = require("./utils/logger");
const bscImports_repo_1 = require("../repositories/bscImports.repo");
const bscPerspective_repo_1 = require("../repositories/bscPerspective.repo");
const bscObjective_repo_1 = require("../repositories/bscObjective.repo");
const bscIndicator_repo_1 = require("../repositories/bscIndicator.repo");
const bscTargets_repo_1 = require("../repositories/bscTargets.repo");
const bscActuals_repo_1 = require("../repositories/bscActuals.repo");
const bscActionPlans_repo_1 = require("../repositories/bscActionPlans.repo");
const bscProjects_repo_1 = require("../repositories/bscProjects.repo");
const bscTasks_repo_1 = require("../repositories/bscTasks.repo");
const bscSnapshots_repo_1 = require("../repositories/bscSnapshots.repo");
const wbs_1 = require("./utils/wbs");
const defaultCounters = () => ({
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
let BscExcelImportService = class BscExcelImportService {
    constructor(prisma, importsRepo, perspectiveRepo, objectiveRepo, indicatorRepo, targetsRepo, actualsRepo, actionPlansRepo, projectsRepo, tasksRepo, snapshotsRepo) {
        this.prisma = prisma;
        this.importsRepo = importsRepo;
        this.perspectiveRepo = perspectiveRepo;
        this.objectiveRepo = objectiveRepo;
        this.indicatorRepo = indicatorRepo;
        this.targetsRepo = targetsRepo;
        this.actualsRepo = actualsRepo;
        this.actionPlansRepo = actionPlansRepo;
        this.projectsRepo = projectsRepo;
        this.tasksRepo = tasksRepo;
        this.snapshotsRepo = snapshotsRepo;
    }
    listImports() {
        return this.importsRepo.list();
    }
    getImport(id) {
        return this.importsRepo.findById(id);
    }
    async importExcel(file, userId, force = false) {
        return this.import(file.buffer, file.originalname, userId ?? null, { force });
    }
    async import(buffer, fileName, userId, options) {
        const hash = (0, normalize_1.fileSha256)(buffer);
        if (!options?.force) {
            const existing = await this.prisma.bscImport.findFirst({
                where: { fileHash: hash, status: { in: [client_1.BscImportStatus.SUCCESS, client_1.BscImportStatus.PARTIAL] } },
                orderBy: { startedAt: 'desc' },
            });
            if (existing) {
                return {
                    importId: existing.id,
                    status: existing.status,
                    reused: true,
                    warningsCount: Array.isArray(existing.warnings) ? existing.warnings.length : 0,
                    counters: existing.counters ?? {},
                };
            }
        }
        const job = await this.importsRepo.createStart({
            fileName,
            fileHash: hash,
            importedById: userId ?? null,
        });
        const warnings = [];
        const counters = defaultCounters();
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const grouped = (0, parseWorkbook_1.parseWorkbookSheets)(workbook);
            if (!grouped.mapa) {
                (0, logger_1.pushWarning)(warnings, {
                    sheetName: 'MAPA',
                    rowIndex: 0,
                    message: 'Aba MAPA não encontrada.',
                    type: 'missing_sheet',
                });
            }
            await this.prisma.$transaction(async (tx) => {
                const indicatorIdByCode = new Map();
                const objectiveIdBySlug = new Map();
                const fileYear = this.extractYearFromFileName(fileName);
                let monthlyYear = fileYear ?? null;
                if (grouped.mapa) {
                    const detectedYear = await this.processMapa(tx, grouped.mapa, indicatorIdByCode, objectiveIdBySlug, warnings, counters);
                    if (!monthlyYear) {
                        monthlyYear = detectedYear;
                    }
                }
                else {
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
            }, {
                timeout: 120000,
                maxWait: 10000,
            });
            const status = warnings.length > 0 ? client_1.BscImportStatus.PARTIAL : client_1.BscImportStatus.SUCCESS;
            if (status === client_1.BscImportStatus.PARTIAL) {
                await this.importsRepo.finishPartial(job.id, warnings, counters);
            }
            else {
                await this.importsRepo.finishSuccess(job.id, warnings, counters);
            }
            return {
                importId: job.id,
                status,
                warningsCount: warnings.length,
                counters,
            };
        }
        catch (error) {
            await this.importsRepo.finishFailed(job.id, warnings, counters, String(error?.message ?? error));
            throw error;
        }
    }
    extractYearFromFileName(fileName) {
        const matches = fileName.match(/20\d{2}/g);
        if (!matches || matches.length === 0)
            return null;
        const candidate = Number(matches[matches.length - 1]);
        if (Number.isNaN(candidate))
            return null;
        return candidate;
    }
    perspectiveOrder(name) {
        return {
            [client_1.BscPerspectiveName.FINANCEIRO]: 1,
            [client_1.BscPerspectiveName.CLIENTE]: 2,
            [client_1.BscPerspectiveName.PROCESSOS]: 3,
            [client_1.BscPerspectiveName.APRENDIZADO_CRESCIMENTO]: 4,
        }[name];
    }
    async ensureObjective(perspectiveId, perspectiveName, objectiveName, counters) {
        const normalized = objectiveName.trim() || 'Objetivo sem nome';
        const slug = `${(0, normalize_1.slugify)(perspectiveName)}-${(0, normalize_1.slugify)(normalized)}`;
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
    async ensureIndicator(code, objectiveId, data, counters) {
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
    async ensurePlaceholderIndicator(code, counters) {
        const perspective = await this.perspectiveRepo.upsert(client_1.BscPerspectiveName.PROCESSOS, this.perspectiveOrder(client_1.BscPerspectiveName.PROCESSOS));
        const objectiveId = await this.ensureObjective(perspective.id, client_1.BscPerspectiveName.PROCESSOS, 'Objetivo não mapeado (import)', counters);
        return this.ensureIndicator(code, objectiveId, {
            name: code,
            needsReview: true,
        }, counters);
    }
    async processMapa(_tx, sheet, indicatorIdByCode, _objectiveIdBySlug, warnings, counters) {
        const parsed = (0, parseMapaSheet_1.parseMapaSheet)(sheet);
        if (!parsed.headerRowIndex) {
            throw new Error('MAPA_HEADER_NOT_FOUND');
        }
        const yearSet = new Set();
        for (const row of parsed.rows) {
            if (!row.perspective || !row.indicatorCode) {
                if (row.objective || row.indicatorName) {
                    (0, logger_1.pushWarning)(warnings, {
                        sheetName: sheet.name,
                        rowIndex: row.rowIndex,
                        message: 'Linha MAPA inválida (perspectiva/código ausente).',
                        type: 'mapa_invalid_row',
                    });
                }
                continue;
            }
            const perspective = await this.perspectiveRepo.upsert(row.perspective, this.perspectiveOrder(row.perspective));
            const objectiveId = await this.ensureObjective(perspective.id, row.perspective, row.objective, counters);
            const indicatorId = await this.ensureIndicator(row.indicatorCode, objectiveId, {
                name: row.indicatorName || row.indicatorCode,
                responsible: row.responsible,
                dataOwner: row.dataOwner,
                keywords: row.keywords,
                level: row.level,
                process: row.process,
                needsReview: false,
            }, counters);
            indicatorIdByCode.set(row.indicatorCode, indicatorId);
            for (const target of row.annualTargets) {
                yearSet.add(target.year);
                const before = await this.prisma.bscIndicatorYearTarget.findUnique({
                    where: { indicatorId_year: { indicatorId, year: target.year } },
                    select: { id: true },
                });
                await this.targetsRepo.upsertYearTarget(indicatorId, target.year, target.targetValue, target.rawValue == null ? null : String(target.rawValue));
                if (before)
                    counters.yearTargetsUpdated += 1;
                else
                    counters.yearTargetsCreated += 1;
                if (target.rawValue != null && target.targetValue == null) {
                    (0, logger_1.pushWarning)(warnings, {
                        sheetName: sheet.name,
                        rowIndex: row.rowIndex,
                        message: `Meta anual ${target.year} não numérica para ${row.indicatorCode}.`,
                        type: 'non_numeric_year_target',
                    });
                }
            }
        }
        (0, logger_1.logImportInfo)('mapa', {
            objectivesCreated: counters.objectivesCreated,
            objectivesUpdated: counters.objectivesUpdated,
            indicatorsCreated: counters.indicatorsCreated,
            indicatorsUpdated: counters.indicatorsUpdated,
            yearTargetsCreated: counters.yearTargetsCreated,
            yearTargetsUpdated: counters.yearTargetsUpdated,
        });
        if (yearSet.size === 0)
            return null;
        const sorted = Array.from(yearSet).sort((a, b) => a - b);
        return sorted[0] ?? null;
    }
    async processGestao(_tx, sheet, indicatorIdByCode, warnings, counters, year) {
        const parsed = (0, parseGestaoSheet_1.parseGestaoSheet)(sheet);
        if (!parsed.headerRowIndex) {
            (0, logger_1.pushWarning)(warnings, {
                sheetName: sheet.name,
                rowIndex: 0,
                message: 'Header da aba GESTAO não encontrado.',
                type: 'gestao_header_missing',
            });
            return;
        }
        for (const row of parsed.rows) {
            if (!row.indicatorCode)
                continue;
            let indicatorId = indicatorIdByCode.get(row.indicatorCode) ?? null;
            if (!indicatorId) {
                indicatorId = await this.ensurePlaceholderIndicator(row.indicatorCode, counters);
                indicatorIdByCode.set(row.indicatorCode, indicatorId);
                (0, logger_1.pushWarning)(warnings, {
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
                await this.targetsRepo.upsertYearTarget(indicatorId, year, row.yearTargetValue, row.yearTargetRaw == null ? null : String(row.yearTargetRaw));
                if (before)
                    counters.yearTargetsUpdated += 1;
                else
                    counters.yearTargetsCreated += 1;
            }
            for (const monthTarget of row.monthTargets) {
                const before = await this.prisma.bscIndicatorMonthTarget.findUnique({
                    where: { indicatorId_year_month: { indicatorId, year, month: monthTarget.month } },
                    select: { id: true, targetValue: true },
                });
                if (before && before.targetValue != null && monthTarget.value != null && Number(before.targetValue) !== monthTarget.value) {
                    (0, logger_1.pushWarning)(warnings, {
                        sheetName: sheet.name,
                        rowIndex: row.rowIndex,
                        message: `Conflito meta mensal em ${row.indicatorCode} M${monthTarget.month} (GESTAO vs valor anterior).`,
                        type: 'target_conflict',
                    });
                }
                await this.targetsRepo.upsertMonthTarget(indicatorId, year, monthTarget.month, monthTarget.value, monthTarget.rawValue == null ? null : String(monthTarget.rawValue));
                if (before)
                    counters.monthTargetsUpdated += 1;
                else
                    counters.monthTargetsCreated += 1;
            }
            for (const monthActual of row.monthActuals) {
                const before = await this.prisma.bscIndicatorMonthActual.findUnique({
                    where: { indicatorId_year_month: { indicatorId, year, month: monthActual.month } },
                    select: { id: true },
                });
                await this.actualsRepo.upsertMonthActual(indicatorId, year, monthActual.month, monthActual.value, monthActual.rawValue == null ? null : String(monthActual.rawValue));
                if (before)
                    counters.monthActualsUpdated += 1;
                else
                    counters.monthActualsCreated += 1;
            }
        }
        (0, logger_1.logImportInfo)('gestao', {
            monthTargetsCreated: counters.monthTargetsCreated,
            monthTargetsUpdated: counters.monthTargetsUpdated,
            monthActualsCreated: counters.monthActualsCreated,
            monthActualsUpdated: counters.monthActualsUpdated,
        });
    }
    async processIndicatorSheet(_tx, sheet, indicatorIdByCode, warnings, counters, year) {
        const codeMatch = sheet.name.trim().match(/^([FCPA]\d+(?:\.\d+){0,2})/i);
        if (!codeMatch)
            return;
        const code = codeMatch[1].toUpperCase();
        let indicatorId = indicatorIdByCode.get(code) ?? null;
        if (!indicatorId) {
            indicatorId = await this.ensurePlaceholderIndicator(code, counters);
            indicatorIdByCode.set(code, indicatorId);
            (0, logger_1.pushWarning)(warnings, {
                sheetName: sheet.name,
                rowIndex: 0,
                message: `Indicador ${code} não encontrado previamente (placeholder).`,
                type: 'placeholder_indicator',
            });
        }
        const parsed = (0, parseIndicatorSheet_1.parseIndicatorSheet)(sheet);
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
                const shouldSkipBecauseGestaoIsBetter = before != null &&
                    existingValue != null &&
                    existingValue !== 0 &&
                    hasIncomingSignal &&
                    (incomingValue == null || incomingValue === 0);
                if (!shouldSkipBecauseGestaoIsBetter) {
                    await this.targetsRepo.upsertMonthTarget(indicatorId, year, monthly.month, incomingValue, monthly.targetRaw == null ? null : String(monthly.targetRaw));
                    if (before)
                        counters.monthTargetsUpdated += 1;
                    else
                        counters.monthTargetsCreated += 1;
                }
            }
            if (monthly.actualRaw != null || monthly.actualValue != null) {
                const before = await this.prisma.bscIndicatorMonthActual.findUnique({
                    where: { indicatorId_year_month: { indicatorId, year, month: monthly.month } },
                    select: { id: true },
                });
                await this.actualsRepo.upsertMonthActual(indicatorId, year, monthly.month, monthly.actualValue, monthly.actualRaw == null ? null : String(monthly.actualRaw));
                if (before)
                    counters.monthActualsUpdated += 1;
                else
                    counters.monthActualsCreated += 1;
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
    async processProjectSheet(_tx, sheet, snapshotDate, warnings, counters) {
        const parsed = (0, parseProjectSheet_1.parseProjectSheet)(sheet);
        const effectiveSnapshot = snapshotDate ?? parsed.snapshotDate;
        if (!effectiveSnapshot) {
            (0, logger_1.pushWarning)(warnings, {
                sheetName: sheet.name,
                rowIndex: 0,
                message: 'Snapshot não encontrado no nome da aba project.',
                type: 'project_snapshot_missing',
            });
            return;
        }
        const project = await this.projectsRepo.upsertByNameAndSnapshot(parsed.projectName, new Date(`${effectiveSnapshot}T00:00:00.000Z`));
        const projectWasExisting = await this.prisma.bscProject.count({
            where: { id: project.id },
        });
        if (projectWasExisting > 0)
            counters.projectsUpdated += 1;
        for (const task of parsed.tasks) {
            const existingTask = await this.prisma.bscProjectTask.findUnique({
                where: { projectId_wbs_name: { projectId: project.id, wbs: task.wbs, name: task.name } },
                select: { id: true },
            });
            const taskRow = await this.tasksRepo.upsertByNaturalKey(project.id, task.wbs, task.name, {
                assignee: task.assignee,
                startDate: task.startDateIso ? new Date(`${task.startDateIso}T00:00:00.000Z`) : null,
                endDate: task.endDateIso ? new Date(`${task.endDateIso}T00:00:00.000Z`) : null,
                duration: task.duration,
                bucket: task.bucket,
                percentComplete: task.percentComplete,
                parentWbs: (0, wbs_1.inferParentWbs)(task.wbs),
                level: (0, wbs_1.inferWbsLevel)(task.wbs),
            });
            if (existingTask)
                counters.tasksUpdated += 1;
            else
                counters.tasksCreated += 1;
            const existingSnapshot = await this.prisma.bscTaskSnapshot.findUnique({
                where: {
                    taskId_snapshotDate: {
                        taskId: taskRow.id,
                        snapshotDate: new Date(`${effectiveSnapshot}T00:00:00.000Z`),
                    },
                },
                select: { id: true },
            });
            await this.snapshotsRepo.upsertTaskSnapshot(taskRow.id, new Date(`${effectiveSnapshot}T00:00:00.000Z`), task.percentComplete);
            if (existingSnapshot)
                counters.snapshotsUpdated += 1;
            else
                counters.snapshotsCreated += 1;
        }
    }
    async processBaseSheet(_tx, sheet, _warnings, counters) {
        const rows = (0, parseBaseSheet_1.parseBaseSheet)(sheet);
        for (const row of rows) {
            const project = await this.projectsRepo.upsertByNameAndSnapshot('BSC Printbag', new Date(`${row.snapshotDate}T00:00:00.000Z`));
            const existingTask = await this.prisma.bscProjectTask.findUnique({
                where: { projectId_wbs_name: { projectId: project.id, wbs: row.wbs, name: row.name } },
                select: { id: true },
            });
            const task = await this.tasksRepo.upsertByNaturalKey(project.id, row.wbs, row.name, {
                percentComplete: row.percentComplete,
                parentWbs: (0, wbs_1.inferParentWbs)(row.wbs),
                level: (0, wbs_1.inferWbsLevel)(row.wbs),
            });
            if (existingTask)
                counters.tasksUpdated += 1;
            else
                counters.tasksCreated += 1;
            const existingSnapshot = await this.prisma.bscTaskSnapshot.findUnique({
                where: {
                    taskId_snapshotDate: {
                        taskId: task.id,
                        snapshotDate: new Date(`${row.snapshotDate}T00:00:00.000Z`),
                    },
                },
                select: { id: true },
            });
            await this.snapshotsRepo.upsertTaskSnapshot(task.id, new Date(`${row.snapshotDate}T00:00:00.000Z`), row.percentComplete);
            if (existingSnapshot)
                counters.snapshotsUpdated += 1;
            else
                counters.snapshotsCreated += 1;
        }
    }
    async processTabSheet(_tx, sheet, warnings, counters) {
        const parsed = (0, parseTabSheet_1.parseTabSheet)(sheet);
        if (parsed.cells.length === 0)
            return;
        const tasks = await this.prisma.bscProjectTask.findMany({
            select: { id: true, wbs: true, name: true },
        });
        const byWbs = new Map();
        const byName = new Map();
        tasks.forEach((task) => {
            if (task.wbs)
                byWbs.set(task.wbs.toUpperCase(), task.id);
            byName.set(task.name.toUpperCase(), task.id);
        });
        let matched = 0;
        for (const cell of parsed.cells) {
            const taskId = byWbs.get(cell.wbsOrName) ?? byName.get(cell.wbsOrName) ?? null;
            if (!taskId)
                continue;
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
            await this.snapshotsRepo.upsertTaskSnapshot(taskId, new Date(`${cell.snapshotDate}T00:00:00.000Z`), cell.percentComplete);
            if (existingSnapshot)
                counters.snapshotsUpdated += 1;
            else
                counters.snapshotsCreated += 1;
        }
        const matchRate = parsed.cells.length > 0 ? matched / parsed.cells.length : 0;
        if (matchRate < 0.7) {
            (0, logger_1.pushWarning)(warnings, {
                sheetName: sheet.name,
                rowIndex: parsed.headerRow,
                message: `TAB com baixa taxa de match (${(matchRate * 100).toFixed(1)}%).`,
                type: 'tab_low_match',
            });
        }
    }
};
exports.BscExcelImportService = BscExcelImportService;
exports.BscExcelImportService = BscExcelImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bscImports_repo_1.BscImportsRepo,
        bscPerspective_repo_1.BscPerspectiveRepo,
        bscObjective_repo_1.BscObjectiveRepo,
        bscIndicator_repo_1.BscIndicatorRepo,
        bscTargets_repo_1.BscTargetsRepo,
        bscActuals_repo_1.BscActualsRepo,
        bscActionPlans_repo_1.BscActionPlansRepo,
        bscProjects_repo_1.BscProjectsRepo,
        bscTasks_repo_1.BscTasksRepo,
        bscSnapshots_repo_1.BscSnapshotsRepo])
], BscExcelImportService);
//# sourceMappingURL=BscExcelImportService.js.map