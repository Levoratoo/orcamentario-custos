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
exports.BscImportService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ExcelJS = __importStar(require("exceljs"));
const prisma_service_1 = require("../prisma/prisma.service");
const bsc_utils_1 = require("./bsc.utils");
const initCounters = () => ({
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
let BscImportService = class BscImportService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listImports() {
        return this.prisma.bscImport.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
    }
    async getImport(id) {
        return this.prisma.bscImport.findUnique({ where: { id } });
    }
    async importExcel(file, userId) {
        const hash = (0, bsc_utils_1.getFileHashSha256)(file.buffer);
        const existing = await this.prisma.bscImport.findFirst({
            where: { fileHash: hash, status: client_1.BscImportStatus.SUCCESS },
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
        const importJob = await this.prisma.bscImport.create({
            data: { fileName: file.originalname, fileHash: hash, importedById: userId ?? null },
        });
        const warnings = [];
        const counters = initCounters();
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(file.buffer);
            await this.prisma.$transaction(async (tx) => {
                const indicatorMap = new Map();
                await this.importMapa(tx, workbook, warnings, counters, indicatorMap);
                await this.importGestao(tx, workbook, warnings, counters, indicatorMap);
                await this.importIndicatorSheets(tx, workbook, warnings, counters, indicatorMap);
                await this.importProjectLikeSheets(tx, workbook, warnings, counters);
            }, {
                maxWait: 10000,
                timeout: 120000,
            });
            await this.prisma.bscImport.update({
                where: { id: importJob.id },
                data: {
                    status: client_1.BscImportStatus.SUCCESS,
                    finishedAt: new Date(),
                    warnings: warnings,
                    counters: counters,
                },
            });
            return { importId: importJob.id, status: client_1.BscImportStatus.SUCCESS, warningsCount: warnings.length, counters };
        }
        catch (error) {
            await this.prisma.bscImport.update({
                where: { id: importJob.id },
                data: {
                    status: client_1.BscImportStatus.ERROR,
                    finishedAt: new Date(),
                    warnings: warnings,
                    counters: counters,
                    errorMessage: String(error?.message ?? error),
                },
            });
            throw error;
        }
    }
    getCellValue(cell) {
        const v = cell.value;
        if (v == null)
            return null;
        if (typeof v === 'object' && 'result' in v)
            return v.result;
        if (typeof v === 'object' && 'text' in v)
            return v.text;
        if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText))
            return v.richText.map((x) => x.text).join('');
        return v;
    }
    findSheet(workbook, contains) {
        const key = (0, bsc_utils_1.toAsciiUpper)(contains);
        return workbook.worksheets.find((s) => (0, bsc_utils_1.toAsciiUpper)(s.name).includes(key));
    }
    findHeaderRow(sheet, required) {
        const keys = required.map((x) => (0, bsc_utils_1.toAsciiUpper)(x));
        for (let i = 1; i <= Math.min(sheet.rowCount, 70); i += 1) {
            const text = Array.from({ length: sheet.getRow(i).cellCount }, (_, idx) => (0, bsc_utils_1.toAsciiUpper)(this.getCellValue(sheet.getRow(i).getCell(idx + 1)))).join(' | ');
            if (keys.every((k) => text.includes(k)))
                return i;
        }
        return null;
    }
    headerMap(row) {
        const map = new Map();
        for (let c = 1; c <= row.cellCount; c += 1) {
            const value = (0, bsc_utils_1.toAsciiUpper)(this.getCellValue(row.getCell(c)));
            if (value)
                map.set(value, c);
        }
        return map;
    }
    findColumn(map, patterns) {
        for (const [header, col] of map.entries()) {
            if (patterns.some((r) => r.test(header)))
                return col;
        }
        return null;
    }
    async ensurePerspective(tx, name) {
        const orderIndex = { FINANCEIRO: 1, CLIENTE: 2, PROCESSOS: 3, APRENDIZADO_CRESCIMENTO: 4 }[name];
        return tx.bscPerspective.upsert({
            where: { name },
            update: { orderIndex },
            create: { name, orderIndex },
            select: { id: true },
        });
    }
    async ensureObjective(tx, perspectiveId, perspectiveName, objectiveName, counters) {
        const name = objectiveName.trim() || 'Objetivo sem nome';
        const slug = `${(0, bsc_utils_1.slugify)(perspectiveName)}-${(0, bsc_utils_1.slugify)(name)}`;
        const found = await tx.bscObjective.findUnique({ where: { slug } });
        if (found) {
            await tx.bscObjective.update({ where: { id: found.id }, data: { name, perspectiveId } });
            counters.objectivesUpdated += 1;
            return found.id;
        }
        const created = await tx.bscObjective.create({ data: { name, perspectiveId, slug }, select: { id: true } });
        counters.objectivesCreated += 1;
        return created.id;
    }
    async ensureIndicator(tx, code, objectiveId, data, counters) {
        const found = await tx.bscIndicator.findUnique({ where: { code } });
        if (found) {
            await tx.bscIndicator.update({ where: { id: found.id }, data: { objectiveId, ...data } });
            counters.indicatorsUpdated += 1;
            return found.id;
        }
        const created = await tx.bscIndicator.create({ data: { code, objectiveId, name: data.name ?? code, responsible: data.responsible ?? null, dataOwner: data.dataOwner ?? null, level: data.level ?? null, process: data.process ?? null, needsReview: data.needsReview ?? false } });
        counters.indicatorsCreated += 1;
        return created.id;
    }
    async ensurePlaceholderIndicator(tx, code, counters) {
        const p = await this.ensurePerspective(tx, client_1.BscPerspectiveName.PROCESSOS);
        const obj = await this.ensureObjective(tx, p.id, client_1.BscPerspectiveName.PROCESSOS, 'Objetivo não mapeado (import)', counters);
        return this.ensureIndicator(tx, code, obj, { name: code, needsReview: true }, counters);
    }
    async upsertYearTarget(tx, indicatorId, year, raw, counters) {
        const targetValue = (0, bsc_utils_1.parseNumberFlexible)(raw);
        const found = await tx.bscIndicatorYearTarget.findUnique({ where: { indicatorId_year: { indicatorId, year } } });
        if (found) {
            await tx.bscIndicatorYearTarget.update({ where: { id: found.id }, data: { targetValue, rawValue: raw == null ? null : String(raw) } });
            counters.yearTargetsUpdated += 1;
        }
        else {
            await tx.bscIndicatorYearTarget.create({ data: { indicatorId, year, targetValue, rawValue: raw == null ? null : String(raw) } });
            counters.yearTargetsCreated += 1;
        }
    }
    async upsertMonthTarget(tx, indicatorId, year, month, raw, counters) {
        const targetValue = (0, bsc_utils_1.parseNumberFlexible)(raw);
        const found = await tx.bscIndicatorMonthTarget.findUnique({ where: { indicatorId_year_month: { indicatorId, year, month } } });
        if (found) {
            await tx.bscIndicatorMonthTarget.update({ where: { id: found.id }, data: { targetValue, rawValue: raw == null ? null : String(raw) } });
            counters.monthTargetsUpdated += 1;
        }
        else {
            await tx.bscIndicatorMonthTarget.create({ data: { indicatorId, year, month, targetValue, rawValue: raw == null ? null : String(raw) } });
            counters.monthTargetsCreated += 1;
        }
    }
    async upsertMonthActual(tx, indicatorId, year, month, raw, counters) {
        const actualValue = (0, bsc_utils_1.parseNumberFlexible)(raw);
        const found = await tx.bscIndicatorMonthActual.findUnique({ where: { indicatorId_year_month: { indicatorId, year, month } } });
        if (found) {
            await tx.bscIndicatorMonthActual.update({ where: { id: found.id }, data: { actualValue, rawValue: raw == null ? null : String(raw) } });
            counters.monthActualsUpdated += 1;
        }
        else {
            await tx.bscIndicatorMonthActual.create({ data: { indicatorId, year, month, actualValue, rawValue: raw == null ? null : String(raw) } });
            counters.monthActualsCreated += 1;
        }
    }
    async importMapa(tx, workbook, warnings, counters, indicatorMap) {
        const sheet = this.findSheet(workbook, 'MAPA');
        if (!sheet)
            return;
        const hr = this.findHeaderRow(sheet, ['PERSPECTIVA', 'OBJETIV']);
        if (!hr)
            return;
        const map = this.headerMap(sheet.getRow(hr));
        const perspectiveCol = this.findColumn(map, [/PERSPECTIVA/]);
        const objectiveCol = this.findColumn(map, [/OBJETIV/]);
        const indicatorCol = this.findColumn(map, [/INDICADOR/]);
        const codeCol = this.findColumn(map, [/CODIGO/, /C[ÓO]D/]);
        const responsibleCol = this.findColumn(map, [/RESPONS/]);
        const dataOwnerCol = this.findColumn(map, [/ALIMENTADOR/, /DATA OWNER/]);
        const levelCol = this.findColumn(map, [/NIVEL/]);
        const processCol = this.findColumn(map, [/PROCESSO/]);
        const yearCols = new Map();
        for (const [header, col] of map.entries()) {
            const y = header.match(/20\d{2}/);
            if (y)
                yearCols.set(Number(y[0]), col);
        }
        for (let r = hr + 1; r <= sheet.rowCount; r += 1) {
            const row = sheet.getRow(r);
            const perspective = perspectiveCol ? (0, bsc_utils_1.resolvePerspective)(this.getCellValue(row.getCell(perspectiveCol))) : null;
            const objectiveName = objectiveCol ? String(this.getCellValue(row.getCell(objectiveCol)) ?? '').trim() : '';
            const codeRaw = codeCol ? this.getCellValue(row.getCell(codeCol)) : null;
            const indicatorRaw = indicatorCol ? this.getCellValue(row.getCell(indicatorCol)) : null;
            const parsed = (0, bsc_utils_1.parseIndicatorCodeAndName)(String(codeRaw ?? indicatorRaw ?? ''));
            const code = parsed.code ?? null;
            const name = parsed.name || (indicatorCol ? String(this.getCellValue(row.getCell(indicatorCol)) ?? '').trim() : '');
            if (!perspective && !objectiveName && !code)
                continue;
            if (!perspective || !code) {
                warnings.push({ sheetName: sheet.name, rowIndex: r, message: 'Linha MAPA ignorada por perspectiva/código inválido.' });
                continue;
            }
            const p = await this.ensurePerspective(tx, perspective);
            const objectiveId = await this.ensureObjective(tx, p.id, perspective, objectiveName, counters);
            const indicatorId = await this.ensureIndicator(tx, code, objectiveId, {
                name: name || code,
                responsible: responsibleCol ? String(this.getCellValue(row.getCell(responsibleCol)) ?? '').trim() || null : null,
                dataOwner: dataOwnerCol ? String(this.getCellValue(row.getCell(dataOwnerCol)) ?? '').trim() || null : null,
                level: levelCol ? (0, bsc_utils_1.parseNumberFlexible)(this.getCellValue(row.getCell(levelCol))) : null,
                process: processCol ? String(this.getCellValue(row.getCell(processCol)) ?? '').trim() || null : null,
                needsReview: false,
            }, counters);
            indicatorMap.set(code, indicatorId);
            for (const [year, col] of yearCols.entries()) {
                await this.upsertYearTarget(tx, indicatorId, year, this.getCellValue(row.getCell(col)), counters);
            }
        }
    }
    async importGestao(tx, workbook, warnings, counters, indicatorMap) {
        const sheet = this.findSheet(workbook, 'GESTAO');
        if (!sheet)
            return;
        const hr = this.findHeaderRow(sheet, ['JAN', 'FEV']) ?? this.findHeaderRow(sheet, ['MAR', 'ABR']);
        if (!hr)
            return;
        const map = this.headerMap(sheet.getRow(hr));
        const codeCol = this.findColumn(map, [/CODIGO/, /C[ÓO]D/]);
        const indicatorCol = this.findColumn(map, [/INDICADOR/]);
        const monthCols = new Map();
        const actualCols = new Map();
        for (const [h, c] of map.entries()) {
            const m = (0, bsc_utils_1.parseMonthFromLabel)(h);
            if (!m)
                continue;
            if (h.includes('REAL'))
                actualCols.set(m, c);
            else
                monthCols.set(m, c);
        }
        for (let r = hr + 1; r <= sheet.rowCount; r += 1) {
            const row = sheet.getRow(r);
            const parsed = (0, bsc_utils_1.parseIndicatorCodeAndName)(String((codeCol ? this.getCellValue(row.getCell(codeCol)) : null) ?? (indicatorCol ? this.getCellValue(row.getCell(indicatorCol)) : null) ?? ''));
            const code = parsed.code;
            if (!code)
                continue;
            let indicatorId = indicatorMap.get(code) ?? null;
            if (!indicatorId) {
                indicatorId = await this.ensurePlaceholderIndicator(tx, code, counters);
                indicatorMap.set(code, indicatorId);
                warnings.push({ sheetName: sheet.name, rowIndex: r, message: `Placeholder criado para ${code}.` });
            }
            for (const [m, c] of monthCols.entries()) {
                await this.upsertMonthTarget(tx, indicatorId, 2025, m, this.getCellValue(row.getCell(c)), counters);
            }
            for (const [m, c] of actualCols.entries()) {
                await this.upsertMonthActual(tx, indicatorId, 2025, m, this.getCellValue(row.getCell(c)), counters);
            }
        }
    }
    async importIndicatorSheets(tx, workbook, warnings, counters, indicatorMap) {
        for (const sheet of workbook.worksheets) {
            const codeMatch = sheet.name.trim().match(/^([FCPA]\d+(?:\.\d+)*)/i);
            if (!codeMatch)
                continue;
            const code = codeMatch[1].toUpperCase();
            let indicatorId = indicatorMap.get(code) ?? null;
            if (!indicatorId) {
                indicatorId = await this.ensurePlaceholderIndicator(tx, code, counters);
                indicatorMap.set(code, indicatorId);
            }
            const monthHeaderRow = this.findHeaderRow(sheet, ['JAN', 'FEV']) ?? this.findHeaderRow(sheet, ['MAR', 'ABR']);
            if (monthHeaderRow) {
                const row = sheet.getRow(monthHeaderRow);
                const monthCols = new Map();
                for (let c = 1; c <= row.cellCount; c += 1) {
                    const m = (0, bsc_utils_1.parseMonthFromLabel)(this.getCellValue(row.getCell(c)));
                    if (m)
                        monthCols.set(m, c);
                }
                for (let r = monthHeaderRow + 1; r <= Math.min(sheet.rowCount, monthHeaderRow + 20); r += 1) {
                    const lbl = (0, bsc_utils_1.toAsciiUpper)(this.getCellValue(sheet.getRow(r).getCell(1)));
                    if (!lbl)
                        continue;
                    const isMeta = lbl.includes('META');
                    const isReal = lbl.includes('REALIZ');
                    if (!isMeta && !isReal)
                        continue;
                    for (const [m, c] of monthCols.entries()) {
                        const raw = this.getCellValue(sheet.getRow(r).getCell(c));
                        if (isMeta)
                            await this.upsertMonthTarget(tx, indicatorId, 2025, m, raw, counters);
                        if (isReal)
                            await this.upsertMonthActual(tx, indicatorId, 2025, m, raw, counters);
                    }
                }
            }
            else {
                warnings.push({ sheetName: sheet.name, rowIndex: 0, message: `Sem grade mensal reconhecida para ${code}.` });
            }
            const actionHeader = this.findHeaderRow(sheet, ['FATO', 'CAUSA', 'ACAO']);
            if (actionHeader) {
                await tx.bscIndicatorActionPlan.deleteMany({ where: { indicatorId, sourceSheet: sheet.name } });
                const map = this.headerMap(sheet.getRow(actionHeader));
                const periodCol = this.findColumn(map, [/PERIODO/]);
                const factCol = this.findColumn(map, [/FATO/]);
                const priorityCol = this.findColumn(map, [/^P$/, /PRIORIDADE/]);
                const causeCol = this.findColumn(map, [/CAUSA/]);
                const actionCol = this.findColumn(map, [/ACAO/]);
                const ownerCol = this.findColumn(map, [/QUEM/, /RESPONS/]);
                const whenCol = this.findColumn(map, [/QUANDO/, /PRAZO/]);
                const effCol = this.findColumn(map, [/EFICAC/, /AVALIAC/]);
                let blanks = 0;
                for (let r = actionHeader + 1; r <= sheet.rowCount; r += 1) {
                    const fact = factCol ? String(this.getCellValue(sheet.getRow(r).getCell(factCol)) ?? '').trim() : '';
                    const action = actionCol ? String(this.getCellValue(sheet.getRow(r).getCell(actionCol)) ?? '').trim() : '';
                    const cause = causeCol ? String(this.getCellValue(sheet.getRow(r).getCell(causeCol)) ?? '').trim() : '';
                    if (!fact && !action && !cause) {
                        blanks += 1;
                        if (blanks >= 3)
                            break;
                        continue;
                    }
                    blanks = 0;
                    const dueIso = whenCol ? (0, bsc_utils_1.parseDateFlexible)(this.getCellValue(sheet.getRow(r).getCell(whenCol))) : null;
                    await tx.bscIndicatorActionPlan.create({
                        data: {
                            indicatorId,
                            sourceSheet: sheet.name,
                            rowIndex: r,
                            period: periodCol ? String(this.getCellValue(sheet.getRow(r).getCell(periodCol)) ?? '').trim() || null : null,
                            fact: fact || null,
                            priority: priorityCol ? String(this.getCellValue(sheet.getRow(r).getCell(priorityCol)) ?? '').trim() || null : null,
                            cause: cause || null,
                            action: action || null,
                            owner: ownerCol ? String(this.getCellValue(sheet.getRow(r).getCell(ownerCol)) ?? '').trim() || null : null,
                            dueDate: dueIso ? new Date(`${dueIso}T00:00:00.000Z`) : null,
                            effectiveness: effCol ? String(this.getCellValue(sheet.getRow(r).getCell(effCol)) ?? '').trim() || null : null,
                        },
                    });
                    counters.actionPlansInserted += 1;
                }
            }
        }
    }
    findProjectHeader(sheet) {
        for (let r = 1; r <= Math.min(sheet.rowCount, 60); r += 1) {
            const text = Array.from({ length: sheet.getRow(r).cellCount }, (_, i) => (0, bsc_utils_1.toAsciiUpper)(this.getCellValue(sheet.getRow(r).getCell(i + 1)))).join(' | ');
            if ((text.includes('TAREFA') || text.includes('TASK')) && (text.includes('%') || text.includes('WBS') || text.includes('CONCLUI')))
                return r;
        }
        return null;
    }
    async upsertProject(tx, name, snapshotIso, counters) {
        const snapshotDate = new Date(`${snapshotIso}T00:00:00.000Z`);
        const found = await tx.bscProject.findUnique({ where: { name_snapshotDate: { name, snapshotDate } } });
        if (found) {
            counters.projectsUpdated += 1;
            return found.id;
        }
        const created = await tx.bscProject.create({ data: { name, snapshotDate }, select: { id: true } });
        counters.projectsCreated += 1;
        return created.id;
    }
    async upsertTask(tx, projectId, wbs, name, percent, counters) {
        const found = await tx.bscProjectTask.findUnique({ where: { projectId_wbs_name: { projectId, wbs, name } } });
        const data = { assignee: null, startDate: null, endDate: null, duration: null, bucket: null, percentComplete: percent, parentWbs: (0, bsc_utils_1.inferParentWbs)(wbs), level: (0, bsc_utils_1.inferWbsLevel)(wbs) };
        if (found) {
            await tx.bscProjectTask.update({ where: { id: found.id }, data });
            counters.tasksUpdated += 1;
            return found.id;
        }
        const created = await tx.bscProjectTask.create({ data: { projectId, wbs, name, ...data }, select: { id: true } });
        counters.tasksCreated += 1;
        return created.id;
    }
    async upsertSnapshot(tx, taskId, snapshotIso, percent, counters) {
        const snapshotDate = new Date(`${snapshotIso}T00:00:00.000Z`);
        const found = await tx.bscTaskSnapshot.findUnique({ where: { taskId_snapshotDate: { taskId, snapshotDate } } });
        if (found) {
            await tx.bscTaskSnapshot.update({ where: { id: found.id }, data: { percentComplete: percent } });
            counters.snapshotsUpdated += 1;
        }
        else {
            await tx.bscTaskSnapshot.create({ data: { taskId, snapshotDate, percentComplete: percent } });
            counters.snapshotsCreated += 1;
        }
    }
    async importProjectLikeSheets(tx, workbook, warnings, counters) {
        const sheets = workbook.worksheets.filter((s) => {
            const n = (0, bsc_utils_1.toAsciiUpper)(s.name);
            return n.includes('.PROJECT') || n === 'BASE' || n === 'TAB';
        });
        for (const sheet of sheets) {
            const snap = (0, bsc_utils_1.parseSnapshotDateFromSheetName)(sheet.name);
            const header = this.findProjectHeader(sheet);
            if (!header)
                continue;
            const map = this.headerMap(sheet.getRow(header));
            const wbsCol = this.findColumn(map, [/WBS/, /ID TAREFA/]) ?? 1;
            const nameCol = this.findColumn(map, [/TAREFA/, /TASK/, /NOME/]) ?? 2;
            const pctCol = this.findColumn(map, [/%/, /CONCLUI/]);
            const snapshotColumns = [];
            if ((0, bsc_utils_1.toAsciiUpper)(sheet.name) === 'TAB') {
                for (let c = 1; c <= sheet.getRow(header).cellCount; c += 1) {
                    const date = (0, bsc_utils_1.parseDateFlexible)(this.getCellValue(sheet.getRow(header).getCell(c)));
                    if (date)
                        snapshotColumns.push({ col: c, date });
                }
            }
            const defaultSnapshot = snap ?? (0, bsc_utils_1.parseDateFlexible)(this.getCellValue(sheet.getRow(header + 1).getCell(1)));
            if (!defaultSnapshot && snapshotColumns.length === 0) {
                warnings.push({ sheetName: sheet.name, rowIndex: 0, message: 'Snapshot não identificado.' });
                continue;
            }
            const projectIdByDate = new Map();
            const ensureProject = async (date) => {
                const cached = projectIdByDate.get(date);
                if (cached)
                    return cached;
                const id = await this.upsertProject(tx, 'BSC Printbag', date, counters);
                projectIdByDate.set(date, id);
                return id;
            };
            for (let r = header + 1; r <= sheet.rowCount; r += 1) {
                const row = sheet.getRow(r);
                const name = String(this.getCellValue(row.getCell(nameCol)) ?? '').trim();
                if (!name)
                    continue;
                const wbs = String(this.getCellValue(row.getCell(wbsCol)) ?? '').trim() || `ROW-${r}`;
                if (snapshotColumns.length > 0) {
                    for (const sc of snapshotColumns) {
                        const percent = (0, bsc_utils_1.parsePercentNormalized)(this.getCellValue(row.getCell(sc.col)));
                        const pid = await ensureProject(sc.date);
                        const taskId = await this.upsertTask(tx, pid, wbs, name, percent, counters);
                        await this.upsertSnapshot(tx, taskId, sc.date, percent, counters);
                    }
                }
                else if (defaultSnapshot) {
                    const percent = pctCol ? (0, bsc_utils_1.parsePercentNormalized)(this.getCellValue(row.getCell(pctCol))) : null;
                    const pid = await ensureProject(defaultSnapshot);
                    const taskId = await this.upsertTask(tx, pid, wbs, name, percent, counters);
                    await this.upsertSnapshot(tx, taskId, defaultSnapshot, percent, counters);
                }
            }
        }
    }
};
exports.BscImportService = BscImportService;
exports.BscImportService = BscImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BscImportService);
//# sourceMappingURL=bsc-import.service.js.map