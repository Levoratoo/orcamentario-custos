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
exports.ImportsService = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
const budget_lines_service_1 = require("../budget-lines/budget-lines.service");
const audit_service_1 = require("../audit/audit.service");
const client_1 = require("@prisma/client");
const constants_1 = require("../common/constants");
const prisma_service_1 = require("../prisma/prisma.service");
const budget_scenario_importer_1 = require("./budget-scenario.importer");
const account_hierarchy_importer_1 = require("./account-hierarchy.importer");
const fs = __importStar(require("fs"));
const bcrypt = __importStar(require("bcrypt"));
const budget_2026_proacao_importer_1 = require("./budget-2026-proacao.importer");
let ImportsService = class ImportsService {
    constructor(budgetLines, audit, prisma) {
        this.budgetLines = budgetLines;
        this.audit = audit;
        this.prisma = prisma;
    }
    async importBudgetLines(input, user) {
        const content = this.resolveContent(input);
        const records = (0, sync_1.parse)(content, { columns: true, skip_empty_lines: true, trim: true });
        if (!records.length) {
            throw new common_1.BadRequestException({ code: 'CSV_EMPTY', message: 'CSV has no rows' });
        }
        const items = records.map((row) => {
            const scenarioId = row.scenarioId || row.scenario || row.ScenarioId;
            if (!scenarioId) {
                throw new common_1.BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
            }
            const monthlyValues = {};
            const monthsMap = {
                Jan: '01', Fev: '02', Mar: '03', Abr: '04', Mai: '05', Jun: '06',
                Jul: '07', Ago: '08', Set: '09', Out: '10', Nov: '11', Dez: '12',
                '01': '01', '02': '02', '03': '03', '04': '04', '05': '05', '06': '06',
                '07': '07', '08': '08', '09': '09', '10': '10', '11': '11', '12': '12',
            };
            Object.entries(monthsMap).forEach(([label, key]) => {
                if (row[label] !== undefined && row[label] !== '') {
                    monthlyValues[key] = String(row[label]);
                }
            });
            for (const key of constants_1.MONTH_KEYS) {
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
                    driverType: row.driverType || row.DriverType || client_1.DriverType.FIXED,
                    assumptions: row.assumptions || row.Assumptions,
                    monthlyValues,
                },
            };
        });
        const scenarioId = items[0].scenarioId;
        const mismatched = items.find((item) => item.scenarioId !== scenarioId);
        if (mismatched) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_MISMATCH', message: 'All rows must share the same scenarioId' });
        }
        const missing = items.find((item) => !item.item.costCenterCode || !item.item.accountCode || !item.item.description);
        if (missing) {
            throw new common_1.BadRequestException({ code: 'CSV_MISSING_FIELDS', message: 'costCenterCode, accountCode and description are required' });
        }
        const dto = {
            scenarioId,
            items: items.map((item) => item.item),
        };
        const results = await this.budgetLines.bulkUpsert(dto, user);
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
            results: results.results.map((result, index) => ({
                line: index + 2,
                ...result,
            })),
        };
    }
    resolveContent(input) {
        if (input.file?.buffer) {
            return input.file.buffer.toString('utf-8');
        }
        if (input.contentBase64) {
            return Buffer.from(input.contentBase64, 'base64').toString('utf-8');
        }
        throw new common_1.BadRequestException({ code: 'CSV_REQUIRED', message: 'File or contentBase64 is required' });
    }
    async previewBudget2026CoordinatorImport(file) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
        }
        const parsed = (0, budget_2026_proacao_importer_1.parseBudget2026CoordinatorWorkbook)(file.buffer);
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
            source: budget_2026_proacao_importer_1.IMPORT_SOURCE_2026,
        };
    }
    async commitBudget2026CoordinatorImport(file, user) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
        }
        const parsed = (0, budget_2026_proacao_importer_1.parseBudget2026CoordinatorWorkbook)(file.buffer);
        const requiredName = 'detalhado pro acao 2026';
        if (!file.originalname.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(requiredName)) {
            parsed.warnings.push({
                rowNumber: 0,
                message: `Arquivo esperado: "Detalhado Pro Acao 2026". Recebido: "${file.originalname}".`,
            });
        }
        if (parsed.errors.length > 0) {
            throw new common_1.BadRequestException({
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
            const coordinatorByName = new Map();
            for (const coordinatorName of coordinatorNames) {
                const coordinator = await this.ensureCoordinatorUser(tx, coordinatorName, passwordHash);
                coordinatorByName.set(coordinatorName, { id: coordinator.id, name: coordinator.name });
            }
            for (const scenarioName of scenarioNames) {
                await this.ensureScenario2026(tx, scenarioName, user?.sub ?? null);
            }
            let createdAccounts = 0;
            const accountSponsorSeen = new Set();
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
                            name: row.detailLabel,
                            category: 'DRE_2026_IMPORT',
                            active: true,
                        },
                    });
                    existingAccountSet.add(detailCode);
                    createdAccounts += 1;
                }
                const coordinator = coordinatorByName.get(row.coordinator);
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
            const entryMap = new Map();
            for (const row of parsed.rows) {
                const coordinator = coordinatorByName.get(row.coordinator);
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
            const existingEntryKeys = new Set(existingEntries.map((entry) => `2026|${entry.month}|${entry.scenario}|${entry.coordinatorId}|${entry.accountPathId}`));
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
                        source: budget_2026_proacao_importer_1.IMPORT_SOURCE_2026,
                        meta: entry.meta,
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
                        source: budget_2026_proacao_importer_1.IMPORT_SOURCE_2026,
                        meta: entry.meta,
                    },
                });
                if (existingEntryKeys.has(key)) {
                    updatedEntries += 1;
                }
                else {
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
                source: budget_2026_proacao_importer_1.IMPORT_SOURCE_2026,
                summary: result,
            },
            actorUserId: user?.sub ?? null,
        });
        return {
            ok: true,
            source: budget_2026_proacao_importer_1.IMPORT_SOURCE_2026,
            fileName: file.originalname,
            warnings: parsed.warnings,
            summary: result,
        };
    }
    buildImportAccountCodes(rows) {
        const codeSet = new Set();
        rows.forEach((row) => {
            codeSet.add(`DRE26:${row.parentPathId ?? row.accountPathId}`);
            codeSet.add(`DRE26:${row.accountPathId}`);
        });
        return Array.from(codeSet);
    }
    normalizeLoginKey(value) {
        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '.')
            .replace(/\.{2,}/g, '.')
            .replace(/^\.+|\.+$/g, '')
            .slice(0, 45);
    }
    async ensureCoordinatorUser(tx, displayName, passwordHash) {
        const normalizedName = displayName.trim();
        const usernameSeed = this.normalizeLoginKey(normalizedName) || 'coordenador';
        const byName = await tx.user.findFirst({
            where: { name: { equals: normalizedName, mode: 'insensitive' } },
        });
        if (byName) {
            return tx.user.update({
                where: { id: byName.id },
                data: { role: client_1.Role.COORDINATOR, active: true },
            });
        }
        const byUsername = await tx.user.findUnique({ where: { username: usernameSeed } });
        if (byUsername) {
            return tx.user.update({
                where: { id: byUsername.id },
                data: { name: normalizedName, role: client_1.Role.COORDINATOR, active: true },
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
                role: client_1.Role.COORDINATOR,
                mustChangePassword: true,
                active: true,
            },
        });
    }
    async ensureScenario2026(tx, scenarioName, createdById) {
        const name = scenarioName.trim();
        if (!name)
            return null;
        const existing = await tx.scenario.findFirst({
            where: { year: 2026, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing)
            return existing;
        let creatorId = createdById;
        if (!creatorId) {
            const fallbackUser = await tx.user.findFirst({ where: { role: client_1.Role.ADMIN }, orderBy: { createdAt: 'asc' } });
            creatorId = fallbackUser?.id ?? null;
        }
        if (!creatorId)
            return null;
        return tx.scenario.create({
            data: {
                name,
                year: 2026,
                createdById: creatorId,
            },
        });
    }
    async importBudgetScenario(files, user, scenarioId) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException({ code: 'FILES_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
        }
        const rows = [];
        let accountTree = null;
        const errors = [];
        const sourceFiles = [];
        files.forEach((file) => {
            const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
            if (!buffer) {
                errors.push(`${file.originalname} :: arquivo nao pode ser lido`);
                return;
            }
            const parsed = (0, budget_scenario_importer_1.parseBudgetScenarioXlsx)(buffer, file.originalname);
            let hasBudgetRows = parsed.rows.length > 0;
            if (!hasBudgetRows) {
                const balanceParsed = (0, budget_scenario_importer_1.parseBalanceSheetXlsx)(buffer, file.originalname);
                if (balanceParsed.rows.length > 0) {
                    rows.push(...balanceParsed.rows);
                    errors.push(...balanceParsed.errors);
                    hasBudgetRows = true;
                }
            }
            if (hasBudgetRows) {
                rows.push(...parsed.rows);
                errors.push(...parsed.errors.filter((msg) => !msg.includes('nenhum dado encontrado')));
            }
            else {
                errors.push(...parsed.errors);
            }
            if (!accountTree) {
                const hierarchy = (0, account_hierarchy_importer_1.parseAccountHierarchyXlsx)(buffer, file.originalname);
                if (hierarchy.tree.length > 0) {
                    accountTree = hierarchy.tree;
                }
                errors.push(...hierarchy.errors);
            }
            sourceFiles.push(file.originalname);
        });
        if (!rows.length) {
            throw new common_1.BadRequestException({ code: 'XLSX_EMPTY', message: 'Nenhuma linha encontrada no XLSX', details: errors });
        }
        const years = Array.from(new Set(rows.map((row) => row.year))).sort();
        const monthKeys = [...constants_1.MONTH_KEYS];
        const aggregation = new Map();
        rows.forEach((row) => {
            const key = `${row.sector}::${row.account}`;
            const entry = aggregation.get(key) ?? {
                sector: row.sector,
                account: row.account,
                monthlyValues: monthKeys.reduce((acc, key) => {
                    acc[key] = 0;
                    return acc;
                }, {}),
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
        const sectorMap = new Map();
        const totalsByMonth = monthKeys.reduce((acc, key) => {
            acc[key] = 0;
            return acc;
        }, {});
        entries.forEach((entry) => {
            const accountPlan = accountMap.get(entry.account);
            const sector = sectorMap.get(entry.sector) ?? {
                code: entry.sector,
                name: costCenterMap.get(entry.sector)?.name ?? null,
                monthlyValues: monthKeys.reduce((acc, key) => {
                    acc[key] = 0;
                    return acc;
                }, {}),
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
                    payload: result,
                    createdById: user.sub ?? null,
                },
            });
        }
        return result;
    }
    async getBudgetScenarioSnapshot(scenarioId) {
        if (!scenarioId) {
            throw new common_1.BadRequestException({ code: 'SCENARIO_REQUIRED', message: 'scenarioId is required' });
        }
        const snapshot = await this.prisma.budgetScenarioSnapshot.findFirst({
            where: { scenarioId },
            orderBy: { createdAt: 'desc' },
        });
        if (!snapshot) {
            throw new common_1.NotFoundException({ code: 'BUDGET_SCENARIO_NOT_FOUND', message: 'Budget scenario not found' });
        }
        return snapshot.payload;
    }
};
exports.ImportsService = ImportsService;
exports.ImportsService = ImportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [budget_lines_service_1.BudgetLinesService,
        audit_service_1.AuditService,
        prisma_service_1.PrismaService])
], ImportsService);
//# sourceMappingURL=imports.service.js.map