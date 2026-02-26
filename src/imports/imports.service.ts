import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { BudgetLinesService } from '../budget-lines/budget-lines.service';
import { AuditService } from '../audit/audit.service';
import { DriverType, Prisma, Role } from '@prisma/client';
import { MONTH_KEYS } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { parseBudgetScenarioXlsx, parseBalanceSheetXlsx } from './budget-scenario.importer';
import { parseAccountHierarchyXlsx, AccountHierarchyNode } from './account-hierarchy.importer';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import {
  Budget2026PreviewResult,
  IMPORT_SOURCE_2026,
  parseBudget2026CoordinatorWorkbook,
} from './budget-2026-proacao.importer';

interface ImportInput {
  file?: Express.Multer.File;
  contentBase64?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly budgetLines: BudgetLinesService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async importBudgetLines(input: ImportInput, user: any) {
    const content = this.resolveContent(input);
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

    if (!records.length) {
      throw new BadRequestException({ code: 'CSV_EMPTY', message: 'CSV has no rows' });
    }

    const items = records.map((row: any) => {
      const scenarioId = row.scenarioId || row.scenario || row.ScenarioId;
      if (!scenarioId) {
        throw new BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
      }

      const monthlyValues: Record<string, string> = {};
      const monthsMap: Record<string, string> = {
        Jan: '01', Fev: '02', Mar: '03', Abr: '04', Mai: '05', Jun: '06',
        Jul: '07', Ago: '08', Set: '09', Out: '10', Nov: '11', Dez: '12',
        '01': '01','02': '02','03': '03','04': '04','05': '05','06': '06',
        '07': '07','08': '08','09': '09','10': '10','11': '11','12': '12',
      };
      Object.entries(monthsMap).forEach(([label, key]) => {
        if (row[label] !== undefined && row[label] !== '') {
          monthlyValues[key] = String(row[label]);
        }
      });
      for (const key of MONTH_KEYS) {
        if (!monthlyValues[key]) {
          monthlyValues[key] = '0.00';
        }
      }

      return {
        scenarioId,
        item: {
          costCenterCode: row.costCenterCode || row.costCenter || row.CostCenterCode,
          accountCode: row.accountCode || row.account || row.AccountCode,
          description: row.description || row.Description,
          driverType: row.driverType || row.DriverType || DriverType.FIXED,
          assumptions: row.assumptions || row.Assumptions,
          monthlyValues,
        },
      };
    });

    const scenarioId = items[0].scenarioId;
    const mismatched = items.find((item) => item.scenarioId !== scenarioId);
    if (mismatched) {
      throw new BadRequestException({ code: 'SCENARIO_MISMATCH', message: 'All rows must share the same scenarioId' });
    }
    const missing = items.find((item) => !item.item.costCenterCode || !item.item.accountCode || !item.item.description);
    if (missing) {
      throw new BadRequestException({ code: 'CSV_MISSING_FIELDS', message: 'costCenterCode, accountCode and description are required' });
    }

    const dto = {
      scenarioId,
      items: items.map((item) => item.item),
    };

    const results = await this.budgetLines.bulkUpsert(dto as any, user);

    await this.audit.log({
      entityType: 'BudgetLineImport',
      entityId: scenarioId,
      action: 'IMPORT',
      before: null,
      after: { totalRows: records.length },
      actorUserId: user.sub,
    });

    return {
      scenarioId,
      totalRows: records.length,
      results: results.results.map((result: any, index: number) => ({
        line: index + 2,
        ...result,
      })),
    };
  }

  private resolveContent(input: ImportInput) {
    if (input.file?.buffer) {
      return input.file.buffer.toString('utf-8');
    }
    if (input.contentBase64) {
      return Buffer.from(input.contentBase64, 'base64').toString('utf-8');
    }
    throw new BadRequestException({ code: 'CSV_REQUIRED', message: 'File or contentBase64 is required' });
  }

  async previewBudget2026CoordinatorImport(file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
    }

    const parsed = parseBudget2026CoordinatorWorkbook(file.buffer);
    const requiredName = 'detalhado pro acao 2026';
    if (!file.originalname.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(requiredName)) {
      parsed.warnings.push({
        rowNumber: 0,
        message: `Arquivo esperado: "Detalhado Pro Acao 2026". Recebido: "${file.originalname}".`,
      });
    }
    const accountCodes = this.buildImportAccountCodes(parsed.rows);
    const existingAccounts = accountCodes.length
      ? await this.prisma.account.findMany({ where: { code: { in: accountCodes } }, select: { code: true } })
      : [];
    const existingSet = new Set(existingAccounts.map((item) => item.code));
    const newAccounts = parsed.newAccounts.filter((account) => {
      const code = `DRE26:${account.pathId}`;
      return !existingSet.has(code);
    });

    return {
      ...parsed,
      summary: {
        ...parsed.summary,
        newParentAccounts: newAccounts.filter((item) => item.level === 0).length,
        newChildAccounts: newAccounts.filter((item) => item.level > 0).length,
      },
      newAccounts,
      fileName: file.originalname,
      source: IMPORT_SOURCE_2026,
    } as Budget2026PreviewResult & { fileName: string; source: string };
  }

  async commitBudget2026CoordinatorImport(file: Express.Multer.File, user: any) {
    if (!file?.buffer) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
    }

    const parsed = parseBudget2026CoordinatorWorkbook(file.buffer);
    const requiredName = 'detalhado pro acao 2026';
    if (!file.originalname.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(requiredName)) {
      parsed.warnings.push({
        rowNumber: 0,
        message: `Arquivo esperado: "Detalhado Pro Acao 2026". Recebido: "${file.originalname}".`,
      });
    }
    if (parsed.errors.length > 0) {
      throw new BadRequestException({
        code: 'IMPORT_VALIDATION_FAILED',
        message: 'Planilha possui erros de validacao. Corrija antes do commit.',
        details: parsed.errors,
      });
    }

    const coordinatorNames = Array.from(new Set(parsed.rows.map((row) => row.coordinator)));
    const scenarioNames = Array.from(new Set(parsed.rows.map((row) => row.scenario)));
    const accountCodes = this.buildImportAccountCodes(parsed.rows);

    const defaultPassword = process.env.DEFAULT_COORDINATOR_PASSWORD || '123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const existingAccounts = accountCodes.length
        ? await tx.account.findMany({ where: { code: { in: accountCodes } }, select: { code: true } })
        : [];
      const existingAccountSet = new Set(existingAccounts.map((item) => item.code));

      const coordinatorByName = new Map<string, { id: string; name: string }>();
      for (const coordinatorName of coordinatorNames) {
        const coordinator = await this.ensureCoordinatorUser(tx, coordinatorName, passwordHash);
        coordinatorByName.set(coordinatorName, { id: coordinator.id, name: coordinator.name });
      }

      for (const scenarioName of scenarioNames) {
        await this.ensureScenario2026(tx, scenarioName, user?.sub ?? null);
      }

      let createdAccounts = 0;
      const accountSponsorSeen = new Set<string>();
      for (const row of parsed.rows) {
        const parentCode = `DRE26:${row.parentPathId ?? row.accountPathId}`;
        if (!existingAccountSet.has(parentCode)) {
          await tx.account.create({
            data: {
              code: parentCode,
              name: row.accountLabel,
              category: 'DRE_2026_IMPORT',
              active: true,
            },
          });
          existingAccountSet.add(parentCode);
          createdAccounts += 1;
        }

        const detailCode = row.detailLabel ? `DRE26:${row.accountPathId}` : null;
        if (detailCode && !existingAccountSet.has(detailCode)) {
          await tx.account.create({
            data: {
              code: detailCode,
              name: row.detailLabel!,
              category: 'DRE_2026_IMPORT',
              active: true,
            },
          });
          existingAccountSet.add(detailCode);
          createdAccounts += 1;
        }

        const coordinator = coordinatorByName.get(row.coordinator)!;
        const sponsorAccountCode = detailCode ?? parentCode;
        const sponsorKey = `${coordinator.id}|${sponsorAccountCode}`;
        if (!accountSponsorSeen.has(sponsorKey)) {
          const existingSponsor = await tx.accountSponsor.findFirst({
            where: {
              sponsorUserId: coordinator.id,
              accountCode: sponsorAccountCode,
              costCenterId: null,
            },
          });
          if (!existingSponsor) {
            await tx.accountSponsor.create({
              data: {
                sponsorUserId: coordinator.id,
                sponsorDisplay: coordinator.name,
                accountCode: sponsorAccountCode,
                costCenterId: null,
              },
            });
          }
          accountSponsorSeen.add(sponsorKey);
        }
      }

      const entryMap = new Map<
        string,
        {
          year: number;
          month: number;
          scenario: string;
          coordinatorId: string;
          coordinatorName: string;
          accountPathId: string;
          accountLabel: string;
          detailLabel: string | null;
          value: number;
          meta: Record<string, unknown>;
        }
      >();

      for (const row of parsed.rows) {
        const coordinator = coordinatorByName.get(row.coordinator)!;
        for (const month of row.months) {
          const uniqueKey = `2026|${month.month}|${row.scenario}|${coordinator.id}|${row.accountPathId}`;
          const current = entryMap.get(uniqueKey);
          if (current) {
            current.value += month.value;
            continue;
          }
          entryMap.set(uniqueKey, {
            year: 2026,
            month: month.month,
            scenario: row.scenario,
            coordinatorId: coordinator.id,
            coordinatorName: coordinator.name,
            accountPathId: row.accountPathId,
            accountLabel: row.accountLabel,
            detailLabel: row.detailLabel,
            value: month.value,
            meta: {
              setor: row.setor,
              ctaProAcao: row.ctaProAcao,
              sourceFile: file.originalname,
            },
          });
        }
      }

      const uniqueEntries = Array.from(entryMap.values());
      const existingEntries = uniqueEntries.length
        ? await tx.importedBudget2026Entry.findMany({
            where: {
              year: 2026,
              OR: uniqueEntries.map((entry) => ({
                month: entry.month,
                scenario: entry.scenario,
                coordinatorId: entry.coordinatorId,
                accountPathId: entry.accountPathId,
              })),
            },
            select: {
              month: true,
              scenario: true,
              coordinatorId: true,
              accountPathId: true,
            },
          })
        : [];

      const existingEntryKeys = new Set(
        existingEntries.map(
          (entry) => `2026|${entry.month}|${entry.scenario}|${entry.coordinatorId}|${entry.accountPathId}`,
        ),
      );

      let createdEntries = 0;
      let updatedEntries = 0;

      for (const entry of uniqueEntries) {
        const key = `2026|${entry.month}|${entry.scenario}|${entry.coordinatorId}|${entry.accountPathId}`;
        await tx.importedBudget2026Entry.upsert({
          where: {
            year_month_scenario_coordinatorId_accountPathId: {
              year: entry.year,
              month: entry.month,
              scenario: entry.scenario,
              coordinatorId: entry.coordinatorId,
              accountPathId: entry.accountPathId,
            },
          },
          update: {
            value: entry.value,
            coordinatorName: entry.coordinatorName,
            accountLabel: entry.accountLabel,
            detailLabel: entry.detailLabel,
            source: IMPORT_SOURCE_2026,
            meta: entry.meta as Prisma.JsonValue,
          },
          create: {
            year: entry.year,
            month: entry.month,
            scenario: entry.scenario,
            coordinatorId: entry.coordinatorId,
            coordinatorName: entry.coordinatorName,
            accountPathId: entry.accountPathId,
            accountLabel: entry.accountLabel,
            detailLabel: entry.detailLabel,
            value: entry.value,
            source: IMPORT_SOURCE_2026,
            meta: entry.meta as Prisma.JsonValue,
          },
        });

        if (existingEntryKeys.has(key)) {
          updatedEntries += 1;
        } else {
          createdEntries += 1;
        }
      }

      return {
        coordinatorsProcessed: coordinatorByName.size,
        scenariosProcessed: scenarioNames.length,
        createdAccounts,
        createdEntries,
        updatedEntries,
        totalEntries: uniqueEntries.length,
      };
    });

    await this.audit.log({
      entityType: 'Budget2026CoordinatorImport',
      entityId: '2026',
      action: 'IMPORT',
      before: null,
      after: {
        fileName: file.originalname,
        source: IMPORT_SOURCE_2026,
        summary: result,
      },
      actorUserId: user?.sub ?? null,
    });

    return {
      ok: true,
      source: IMPORT_SOURCE_2026,
      fileName: file.originalname,
      warnings: parsed.warnings,
      summary: result,
    };
  }

  private buildImportAccountCodes(rows: Array<{ accountPathId: string; parentPathId: string | null }>) {
    const codeSet = new Set<string>();
    rows.forEach((row) => {
      codeSet.add(`DRE26:${row.parentPathId ?? row.accountPathId}`);
      codeSet.add(`DRE26:${row.accountPathId}`);
    });
    return Array.from(codeSet);
  }

  private normalizeLoginKey(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 45);
  }

  private async ensureCoordinatorUser(tx: Prisma.TransactionClient, displayName: string, passwordHash: string) {
    const normalizedName = displayName.trim();
    const usernameSeed = this.normalizeLoginKey(normalizedName) || 'coordenador';

    const byName = await tx.user.findFirst({
      where: { name: { equals: normalizedName, mode: 'insensitive' } },
    });
    if (byName) {
      return tx.user.update({
        where: { id: byName.id },
        data: { role: Role.COORDINATOR, active: true },
      });
    }

    const byUsername = await tx.user.findUnique({ where: { username: usernameSeed } });
    if (byUsername) {
      return tx.user.update({
        where: { id: byUsername.id },
        data: { name: normalizedName, role: Role.COORDINATOR, active: true },
      });
    }

    let username = usernameSeed;
    let counter = 1;
    while (await tx.user.findUnique({ where: { username } })) {
      username = `${usernameSeed}.${counter}`;
      counter += 1;
    }

    return tx.user.create({
      data: {
        name: normalizedName,
        username,
        email: null,
        passwordHash,
        role: Role.COORDINATOR,
        mustChangePassword: true,
        active: true,
      },
    });
  }

  private async ensureScenario2026(tx: Prisma.TransactionClient, scenarioName: string, createdById: string | null) {
    const name = scenarioName.trim();
    if (!name) return null;
    const existing = await tx.scenario.findFirst({
      where: { year: 2026, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;

    let creatorId = createdById;
    if (!creatorId) {
      const fallbackUser = await tx.user.findFirst({ where: { role: Role.ADMIN }, orderBy: { createdAt: 'asc' } });
      creatorId = fallbackUser?.id ?? null;
    }
    if (!creatorId) return null;

    return tx.scenario.create({
      data: {
        name,
        year: 2026,
        createdById: creatorId,
      },
    });
  }

  async importBudgetScenario(files: Express.Multer.File[], user: any, scenarioId?: string) {
    if (!files || files.length === 0) {
      throw new BadRequestException({ code: 'FILES_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
    }

    const rows = [];
    let accountTree: AccountHierarchyNode[] | null = null;
    const errors: string[] = [];
    const sourceFiles: string[] = [];

    files.forEach((file) => {
      const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
      if (!buffer) {
        errors.push(`${file.originalname} :: arquivo nao pode ser lido`);
        return;
      }

      const parsed = parseBudgetScenarioXlsx(buffer, file.originalname);
      let hasBudgetRows = parsed.rows.length > 0;

      if (!hasBudgetRows) {
        const balanceParsed = parseBalanceSheetXlsx(buffer, file.originalname);
        if (balanceParsed.rows.length > 0) {
          rows.push(...balanceParsed.rows);
          errors.push(...balanceParsed.errors);
          hasBudgetRows = true;
        }
      }

      if (hasBudgetRows) {
        rows.push(...parsed.rows);
        errors.push(...parsed.errors.filter((msg) => !msg.includes('nenhum dado encontrado')));
      } else {
        errors.push(...parsed.errors);
      }

      if (!accountTree) {
        const hierarchy = parseAccountHierarchyXlsx(buffer, file.originalname);
        if (hierarchy.tree.length > 0) {
          accountTree = hierarchy.tree;
        }
        errors.push(...hierarchy.errors);
      }

      sourceFiles.push(file.originalname);
    });

    if (!rows.length) {
      throw new BadRequestException({ code: 'XLSX_EMPTY', message: 'Nenhuma linha encontrada no XLSX', details: errors });
    }

    const years = Array.from(new Set(rows.map((row) => row.year))).sort();
    const monthKeys = [...MONTH_KEYS];
    const aggregation = new Map<string, { sector: string; account: string; monthlyValues: Record<string, number> }>();

    rows.forEach((row) => {
      const key = `${row.sector}::${row.account}`;
      const entry = aggregation.get(key) ?? {
        sector: row.sector,
        account: row.account,
        monthlyValues: monthKeys.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {} as Record<string, number>),
      };
      entry.monthlyValues[row.monthKey] = (entry.monthlyValues[row.monthKey] ?? 0) + row.value;
      aggregation.set(key, entry);
    });

    const entries = Array.from(aggregation.values()).map((entry) => ({
      ...entry,
      total: monthKeys.reduce((sum, key) => sum + (entry.monthlyValues[key] ?? 0), 0),
    }));

    const accountClassifications = Array.from(new Set(entries.map((entry) => entry.account)));
    const accountPlans = await this.prisma.accountPlan.findMany({
      where: { classification: { in: accountClassifications } },
    });
    const accountMap = new Map(accountPlans.map((plan) => [plan.classification, plan]));

    const sectorCodes = Array.from(new Set(entries.map((entry) => entry.sector)));
    const costCenters = await this.prisma.costCenter.findMany({
      where: { code: { in: sectorCodes } },
    });
    const costCenterMap = new Map(costCenters.map((center) => [center.code, center]));

    const sectorMap = new Map<string, any>();
    const totalsByMonth = monthKeys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<string, number>);

    entries.forEach((entry) => {
      const accountPlan = accountMap.get(entry.account);
      const sector = sectorMap.get(entry.sector) ?? {
        code: entry.sector,
        name: costCenterMap.get(entry.sector)?.name ?? null,
        monthlyValues: monthKeys.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {} as Record<string, number>),
        total: 0,
        accounts: [],
      };

      monthKeys.forEach((key) => {
        const value = entry.monthlyValues[key] ?? 0;
        sector.monthlyValues[key] += value;
        totalsByMonth[key] += value;
      });

      sector.total += entry.total;
      sector.accounts.push({
        classification: entry.account,
        description: accountPlan?.description ?? null,
        type: accountPlan?.type ?? null,
        monthlyValues: entry.monthlyValues,
        total: entry.total,
      });

      sectorMap.set(entry.sector, sector);
    });

    const total = monthKeys.reduce((sum, key) => sum + (totalsByMonth[key] ?? 0), 0);
    const unmatchedAccounts = accountClassifications.filter((classification) => !accountMap.has(classification));
    const unmatchedSectors = sectorCodes.filter((code) => !costCenterMap.has(code));

    await this.audit.log({
      entityType: 'BudgetScenarioImport',
      entityId: years.join(','),
      action: 'IMPORT',
      before: null,
      after: { totalRows: rows.length, files: sourceFiles },
      actorUserId: user.sub,
    });

    const result = {
      year: years[0] ?? null,
      years,
      months: monthKeys,
      totals: { byMonth: totalsByMonth, total },
      sectors: Array.from(sectorMap.values()).sort((a, b) => a.code.localeCompare(b.code)),
      unmatchedAccounts,
      unmatchedSectors,
      sourceFiles,
      totalRows: rows.length,
      accountTree,
      errors,
    };

    if (scenarioId) {
      await this.prisma.budgetScenarioSnapshot.create({
        data: {
          scenarioId,
          payload: result as unknown as Prisma.JsonValue,
          createdById: user.sub ?? null,
        },
      });
    }

    return result;
  }

  async getBudgetScenarioSnapshot(scenarioId: string) {
    if (!scenarioId) {
      throw new BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
    }
    const snapshot = await this.prisma.budgetScenarioSnapshot.findFirst({
      where: { scenarioId },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) {
      throw new NotFoundException({ code: 'BUDGET_SCENARIO_NOT_FOUND', message: 'Budget scenario not found' });
    }
    return snapshot.payload;
  }
}
