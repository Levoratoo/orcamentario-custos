import { Injectable } from '@nestjs/common';
import { BscImportStatus, BscPerspectiveName, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  getFileHashSha256,
  inferParentWbs,
  inferWbsLevel,
  parseDateFlexible,
  parseIndicatorCodeAndName,
  parseMonthFromLabel,
  parseNumberFlexible,
  parsePercentNormalized,
  parseSnapshotDateFromSheetName,
  resolvePerspective,
  slugify,
  toAsciiUpper,
} from './bsc.utils';

type Tx = Prisma.TransactionClient;

type Warning = { sheetName: string; rowIndex: number; message: string };

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

const initCounters = (): Counters => ({
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
export class BscImportService {
  constructor(private readonly prisma: PrismaService) {}

  async listImports() {
    return this.prisma.bscImport.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
  }

  async getImport(id: string) {
    return this.prisma.bscImport.findUnique({ where: { id } });
  }

  async importExcel(file: Express.Multer.File, userId?: string) {
    const hash = getFileHashSha256(file.buffer);
    const existing = await this.prisma.bscImport.findFirst({
      where: { fileHash: hash, status: BscImportStatus.SUCCESS },
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

    const importJob = await this.prisma.bscImport.create({
      data: { fileName: file.originalname, fileHash: hash, importedById: userId ?? null },
    });

    const warnings: Warning[] = [];
    const counters = initCounters();
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(file.buffer as any);
      await this.prisma.$transaction(
        async (tx) => {
          const indicatorMap = new Map<string, string>();
          await this.importMapa(tx, workbook, warnings, counters, indicatorMap);
          await this.importGestao(tx, workbook, warnings, counters, indicatorMap);
          await this.importIndicatorSheets(tx, workbook, warnings, counters, indicatorMap);
          await this.importProjectLikeSheets(tx, workbook, warnings, counters);
        },
        {
          maxWait: 10000,
          timeout: 120000,
        },
      );

      await this.prisma.bscImport.update({
        where: { id: importJob.id },
        data: {
          status: BscImportStatus.SUCCESS,
          finishedAt: new Date(),
          warnings: warnings as unknown as Prisma.JsonValue,
          counters: counters as unknown as Prisma.JsonValue,
        },
      });
      return { importId: importJob.id, status: BscImportStatus.SUCCESS, warningsCount: warnings.length, counters };
    } catch (error: any) {
      await this.prisma.bscImport.update({
        where: { id: importJob.id },
        data: {
          status: BscImportStatus.ERROR,
          finishedAt: new Date(),
          warnings: warnings as unknown as Prisma.JsonValue,
          counters: counters as unknown as Prisma.JsonValue,
          errorMessage: String(error?.message ?? error),
        },
      });
      throw error;
    }
  }

  private getCellValue(cell: ExcelJS.Cell): unknown {
    const v = cell.value as any;
    if (v == null) return null;
    if (typeof v === 'object' && 'result' in v) return v.result;
    if (typeof v === 'object' && 'text' in v) return v.text;
    if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) return v.richText.map((x: any) => x.text).join('');
    return v;
  }

  private findSheet(workbook: ExcelJS.Workbook, contains: string) {
    const key = toAsciiUpper(contains);
    return workbook.worksheets.find((s) => toAsciiUpper(s.name).includes(key));
  }

  private findHeaderRow(sheet: ExcelJS.Worksheet, required: string[]) {
    const keys = required.map((x) => toAsciiUpper(x));
    for (let i = 1; i <= Math.min(sheet.rowCount, 70); i += 1) {
      const text = Array.from({ length: sheet.getRow(i).cellCount }, (_, idx) => toAsciiUpper(this.getCellValue(sheet.getRow(i).getCell(idx + 1)))).join(' | ');
      if (keys.every((k) => text.includes(k))) return i;
    }
    return null;
  }

  private headerMap(row: ExcelJS.Row) {
    const map = new Map<string, number>();
    for (let c = 1; c <= row.cellCount; c += 1) {
      const value = toAsciiUpper(this.getCellValue(row.getCell(c)));
      if (value) map.set(value, c);
    }
    return map;
  }

  private findColumn(map: Map<string, number>, patterns: RegExp[]) {
    for (const [header, col] of map.entries()) {
      if (patterns.some((r) => r.test(header))) return col;
    }
    return null;
  }

  private async ensurePerspective(tx: Tx, name: BscPerspectiveName) {
    const orderIndex = { FINANCEIRO: 1, CLIENTE: 2, PROCESSOS: 3, APRENDIZADO_CRESCIMENTO: 4 }[name];
    return tx.bscPerspective.upsert({
      where: { name },
      update: { orderIndex },
      create: { name, orderIndex },
      select: { id: true },
    });
  }

  private async ensureObjective(tx: Tx, perspectiveId: string, perspectiveName: BscPerspectiveName, objectiveName: string, counters: Counters) {
    const name = objectiveName.trim() || 'Objetivo sem nome';
    const slug = `${slugify(perspectiveName)}-${slugify(name)}`;
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

  private async ensureIndicator(tx: Tx, code: string, objectiveId: string, data: Partial<{ name: string; responsible: string | null; dataOwner: string | null; level: number | null; process: string | null; needsReview: boolean }>, counters: Counters) {
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

  private async ensurePlaceholderIndicator(tx: Tx, code: string, counters: Counters) {
    const p = await this.ensurePerspective(tx, BscPerspectiveName.PROCESSOS);
    const obj = await this.ensureObjective(tx, p.id, BscPerspectiveName.PROCESSOS, 'Objetivo não mapeado (import)', counters);
    return this.ensureIndicator(tx, code, obj, { name: code, needsReview: true }, counters);
  }

  private async upsertYearTarget(tx: Tx, indicatorId: string, year: number, raw: unknown, counters: Counters) {
    const targetValue = parseNumberFlexible(raw);
    const found = await tx.bscIndicatorYearTarget.findUnique({ where: { indicatorId_year: { indicatorId, year } } });
    if (found) {
      await tx.bscIndicatorYearTarget.update({ where: { id: found.id }, data: { targetValue, rawValue: raw == null ? null : String(raw) } });
      counters.yearTargetsUpdated += 1;
    } else {
      await tx.bscIndicatorYearTarget.create({ data: { indicatorId, year, targetValue, rawValue: raw == null ? null : String(raw) } });
      counters.yearTargetsCreated += 1;
    }
  }

  private async upsertMonthTarget(tx: Tx, indicatorId: string, year: number, month: number, raw: unknown, counters: Counters) {
    const targetValue = parseNumberFlexible(raw);
    const found = await tx.bscIndicatorMonthTarget.findUnique({ where: { indicatorId_year_month: { indicatorId, year, month } } });
    if (found) {
      await tx.bscIndicatorMonthTarget.update({ where: { id: found.id }, data: { targetValue, rawValue: raw == null ? null : String(raw) } });
      counters.monthTargetsUpdated += 1;
    } else {
      await tx.bscIndicatorMonthTarget.create({ data: { indicatorId, year, month, targetValue, rawValue: raw == null ? null : String(raw) } });
      counters.monthTargetsCreated += 1;
    }
  }

  private async upsertMonthActual(tx: Tx, indicatorId: string, year: number, month: number, raw: unknown, counters: Counters) {
    const actualValue = parseNumberFlexible(raw);
    const found = await tx.bscIndicatorMonthActual.findUnique({ where: { indicatorId_year_month: { indicatorId, year, month } } });
    if (found) {
      await tx.bscIndicatorMonthActual.update({ where: { id: found.id }, data: { actualValue, rawValue: raw == null ? null : String(raw) } });
      counters.monthActualsUpdated += 1;
    } else {
      await tx.bscIndicatorMonthActual.create({ data: { indicatorId, year, month, actualValue, rawValue: raw == null ? null : String(raw) } });
      counters.monthActualsCreated += 1;
    }
  }

  private async importMapa(tx: Tx, workbook: ExcelJS.Workbook, warnings: Warning[], counters: Counters, indicatorMap: Map<string, string>) {
    const sheet = this.findSheet(workbook, 'MAPA');
    if (!sheet) return;
    const hr = this.findHeaderRow(sheet, ['PERSPECTIVA', 'OBJETIV']);
    if (!hr) return;
    const map = this.headerMap(sheet.getRow(hr));
    const perspectiveCol = this.findColumn(map, [/PERSPECTIVA/]);
    const objectiveCol = this.findColumn(map, [/OBJETIV/]);
    const indicatorCol = this.findColumn(map, [/INDICADOR/]);
    const codeCol = this.findColumn(map, [/CODIGO/, /C[ÓO]D/]);
    const responsibleCol = this.findColumn(map, [/RESPONS/]);
    const dataOwnerCol = this.findColumn(map, [/ALIMENTADOR/, /DATA OWNER/]);
    const levelCol = this.findColumn(map, [/NIVEL/]);
    const processCol = this.findColumn(map, [/PROCESSO/]);
    const yearCols = new Map<number, number>();
    for (const [header, col] of map.entries()) {
      const y = header.match(/20\d{2}/);
      if (y) yearCols.set(Number(y[0]), col);
    }

    for (let r = hr + 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const perspective = perspectiveCol ? resolvePerspective(this.getCellValue(row.getCell(perspectiveCol))) : null;
      const objectiveName = objectiveCol ? String(this.getCellValue(row.getCell(objectiveCol)) ?? '').trim() : '';
      const codeRaw = codeCol ? this.getCellValue(row.getCell(codeCol)) : null;
      const indicatorRaw = indicatorCol ? this.getCellValue(row.getCell(indicatorCol)) : null;
      const parsed = parseIndicatorCodeAndName(String(codeRaw ?? indicatorRaw ?? ''));
      const code = parsed.code ?? null;
      const name = parsed.name || (indicatorCol ? String(this.getCellValue(row.getCell(indicatorCol)) ?? '').trim() : '');
      if (!perspective && !objectiveName && !code) continue;
      if (!perspective || !code) {
        warnings.push({ sheetName: sheet.name, rowIndex: r, message: 'Linha MAPA ignorada por perspectiva/código inválido.' });
        continue;
      }
      const p = await this.ensurePerspective(tx, perspective);
      const objectiveId = await this.ensureObjective(tx, p.id, perspective, objectiveName, counters);
      const indicatorId = await this.ensureIndicator(
        tx,
        code,
        objectiveId,
        {
          name: name || code,
          responsible: responsibleCol ? String(this.getCellValue(row.getCell(responsibleCol)) ?? '').trim() || null : null,
          dataOwner: dataOwnerCol ? String(this.getCellValue(row.getCell(dataOwnerCol)) ?? '').trim() || null : null,
          level: levelCol ? parseNumberFlexible(this.getCellValue(row.getCell(levelCol))) : null,
          process: processCol ? String(this.getCellValue(row.getCell(processCol)) ?? '').trim() || null : null,
          needsReview: false,
        },
        counters,
      );
      indicatorMap.set(code, indicatorId);
      for (const [year, col] of yearCols.entries()) {
        await this.upsertYearTarget(tx, indicatorId, year, this.getCellValue(row.getCell(col)), counters);
      }
    }
  }

  private async importGestao(tx: Tx, workbook: ExcelJS.Workbook, warnings: Warning[], counters: Counters, indicatorMap: Map<string, string>) {
    const sheet = this.findSheet(workbook, 'GESTAO');
    if (!sheet) return;
    const hr = this.findHeaderRow(sheet, ['JAN', 'FEV']) ?? this.findHeaderRow(sheet, ['MAR', 'ABR']);
    if (!hr) return;
    const map = this.headerMap(sheet.getRow(hr));
    const codeCol = this.findColumn(map, [/CODIGO/, /C[ÓO]D/]);
    const indicatorCol = this.findColumn(map, [/INDICADOR/]);
    const monthCols = new Map<number, number>();
    const actualCols = new Map<number, number>();
    for (const [h, c] of map.entries()) {
      const m = parseMonthFromLabel(h);
      if (!m) continue;
      if (h.includes('REAL')) actualCols.set(m, c);
      else monthCols.set(m, c);
    }
    for (let r = hr + 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const parsed = parseIndicatorCodeAndName(String((codeCol ? this.getCellValue(row.getCell(codeCol)) : null) ?? (indicatorCol ? this.getCellValue(row.getCell(indicatorCol)) : null) ?? ''));
      const code = parsed.code;
      if (!code) continue;
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

  private async importIndicatorSheets(tx: Tx, workbook: ExcelJS.Workbook, warnings: Warning[], counters: Counters, indicatorMap: Map<string, string>) {
    for (const sheet of workbook.worksheets) {
      const codeMatch = sheet.name.trim().match(/^([FCPA]\d+(?:\.\d+)*)/i);
      if (!codeMatch) continue;
      const code = codeMatch[1].toUpperCase();
      let indicatorId = indicatorMap.get(code) ?? null;
      if (!indicatorId) {
        indicatorId = await this.ensurePlaceholderIndicator(tx, code, counters);
        indicatorMap.set(code, indicatorId);
      }
      const monthHeaderRow = this.findHeaderRow(sheet, ['JAN', 'FEV']) ?? this.findHeaderRow(sheet, ['MAR', 'ABR']);
      if (monthHeaderRow) {
        const row = sheet.getRow(monthHeaderRow);
        const monthCols = new Map<number, number>();
        for (let c = 1; c <= row.cellCount; c += 1) {
          const m = parseMonthFromLabel(this.getCellValue(row.getCell(c)));
          if (m) monthCols.set(m, c);
        }
        for (let r = monthHeaderRow + 1; r <= Math.min(sheet.rowCount, monthHeaderRow + 20); r += 1) {
          const lbl = toAsciiUpper(this.getCellValue(sheet.getRow(r).getCell(1)));
          if (!lbl) continue;
          const isMeta = lbl.includes('META');
          const isReal = lbl.includes('REALIZ');
          if (!isMeta && !isReal) continue;
          for (const [m, c] of monthCols.entries()) {
            const raw = this.getCellValue(sheet.getRow(r).getCell(c));
            if (isMeta) await this.upsertMonthTarget(tx, indicatorId, 2025, m, raw, counters);
            if (isReal) await this.upsertMonthActual(tx, indicatorId, 2025, m, raw, counters);
          }
        }
      } else {
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
            if (blanks >= 3) break;
            continue;
          }
          blanks = 0;
          const dueIso = whenCol ? parseDateFlexible(this.getCellValue(sheet.getRow(r).getCell(whenCol))) : null;
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

  private findProjectHeader(sheet: ExcelJS.Worksheet) {
    for (let r = 1; r <= Math.min(sheet.rowCount, 60); r += 1) {
      const text = Array.from({ length: sheet.getRow(r).cellCount }, (_, i) => toAsciiUpper(this.getCellValue(sheet.getRow(r).getCell(i + 1)))).join(' | ');
      if ((text.includes('TAREFA') || text.includes('TASK')) && (text.includes('%') || text.includes('WBS') || text.includes('CONCLUI'))) return r;
    }
    return null;
  }

  private async upsertProject(tx: Tx, name: string, snapshotIso: string, counters: Counters) {
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

  private async upsertTask(tx: Tx, projectId: string, wbs: string, name: string, percent: number | null, counters: Counters) {
    const found = await tx.bscProjectTask.findUnique({ where: { projectId_wbs_name: { projectId, wbs, name } } });
    const data = { assignee: null as string | null, startDate: null as Date | null, endDate: null as Date | null, duration: null as string | null, bucket: null as string | null, percentComplete: percent, parentWbs: inferParentWbs(wbs), level: inferWbsLevel(wbs) };
    if (found) {
      await tx.bscProjectTask.update({ where: { id: found.id }, data });
      counters.tasksUpdated += 1;
      return found.id;
    }
    const created = await tx.bscProjectTask.create({ data: { projectId, wbs, name, ...data }, select: { id: true } });
    counters.tasksCreated += 1;
    return created.id;
  }

  private async upsertSnapshot(tx: Tx, taskId: string, snapshotIso: string, percent: number | null, counters: Counters) {
    const snapshotDate = new Date(`${snapshotIso}T00:00:00.000Z`);
    const found = await tx.bscTaskSnapshot.findUnique({ where: { taskId_snapshotDate: { taskId, snapshotDate } } });
    if (found) {
      await tx.bscTaskSnapshot.update({ where: { id: found.id }, data: { percentComplete: percent } });
      counters.snapshotsUpdated += 1;
    } else {
      await tx.bscTaskSnapshot.create({ data: { taskId, snapshotDate, percentComplete: percent } });
      counters.snapshotsCreated += 1;
    }
  }

  private async importProjectLikeSheets(tx: Tx, workbook: ExcelJS.Workbook, warnings: Warning[], counters: Counters) {
    const sheets = workbook.worksheets.filter((s) => {
      const n = toAsciiUpper(s.name);
      return n.includes('.PROJECT') || n === 'BASE' || n === 'TAB';
    });
    for (const sheet of sheets) {
      const snap = parseSnapshotDateFromSheetName(sheet.name);
      const header = this.findProjectHeader(sheet);
      if (!header) continue;
      const map = this.headerMap(sheet.getRow(header));
      const wbsCol = this.findColumn(map, [/WBS/, /ID TAREFA/]) ?? 1;
      const nameCol = this.findColumn(map, [/TAREFA/, /TASK/, /NOME/]) ?? 2;
      const pctCol = this.findColumn(map, [/%/, /CONCLUI/]);
      const snapshotColumns: Array<{ col: number; date: string }> = [];
      if (toAsciiUpper(sheet.name) === 'TAB') {
        for (let c = 1; c <= sheet.getRow(header).cellCount; c += 1) {
          const date = parseDateFlexible(this.getCellValue(sheet.getRow(header).getCell(c)));
          if (date) snapshotColumns.push({ col: c, date });
        }
      }
      const defaultSnapshot = snap ?? parseDateFlexible(this.getCellValue(sheet.getRow(header + 1).getCell(1)));
      if (!defaultSnapshot && snapshotColumns.length === 0) {
        warnings.push({ sheetName: sheet.name, rowIndex: 0, message: 'Snapshot não identificado.' });
        continue;
      }
      const projectIdByDate = new Map<string, string>();
      const ensureProject = async (date: string) => {
        const cached = projectIdByDate.get(date);
        if (cached) return cached;
        const id = await this.upsertProject(tx, 'BSC Printbag', date, counters);
        projectIdByDate.set(date, id);
        return id;
      };
      for (let r = header + 1; r <= sheet.rowCount; r += 1) {
        const row = sheet.getRow(r);
        const name = String(this.getCellValue(row.getCell(nameCol)) ?? '').trim();
        if (!name) continue;
        const wbs = String(this.getCellValue(row.getCell(wbsCol)) ?? '').trim() || `ROW-${r}`;
        if (snapshotColumns.length > 0) {
          for (const sc of snapshotColumns) {
            const percent = parsePercentNormalized(this.getCellValue(row.getCell(sc.col)));
            const pid = await ensureProject(sc.date);
            const taskId = await this.upsertTask(tx, pid, wbs, name, percent, counters);
            await this.upsertSnapshot(tx, taskId, sc.date, percent, counters);
          }
        } else if (defaultSnapshot) {
          const percent = pctCol ? parsePercentNormalized(this.getCellValue(row.getCell(pctCol))) : null;
          const pid = await ensureProject(defaultSnapshot);
          const taskId = await this.upsertTask(tx, pid, wbs, name, percent, counters);
          await this.upsertSnapshot(tx, taskId, defaultSnapshot, percent, counters);
        }
      }
    }
  }
}
