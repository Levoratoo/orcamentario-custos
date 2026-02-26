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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_1 = require("@prisma/client");
const budget_2026_proacao_importer_1 = require("../src/imports/budget-2026-proacao.importer");
const planning_service_1 = require("../src/planning/planning.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
function normalize(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function slugify(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s.]/g, '')
        .trim()
        .replace(/\s+/g, '.');
}
function parseAccountName(label) {
    const match = label.match(/^[\d.]+\s*-\s*(.+)$/);
    return (match?.[1] ?? label).trim();
}
function parseAccountCodeAndName(label) {
    const cleaned = String(label ?? '').trim().replace(/\s+/g, ' ');
    const match = cleaned.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
    if (match) {
        return { code: match[1], name: match[2].trim(), label: cleaned };
    }
    const fallback = parseAccountName(cleaned);
    return {
        code: `DET.${slugify(fallback).replace(/\./g, '').slice(0, 24) || 'SEMCOD'}`,
        name: fallback,
        label: cleaned || fallback,
    };
}
(async () => {
    const prisma = new client_1.PrismaClient();
    await prisma.$connect();
    const root = process.cwd();
    const fileName = fs.readdirSync(root).find((n) => normalize(n).includes('detalhado pro acao 2026') && n.endsWith('.xlsx'));
    if (!fileName)
        throw new Error('Detalhado Pro A��o 2026.xlsx not found');
    const parsed = (0, budget_2026_proacao_importer_1.parseBudget2026CoordinatorWorkbook)(fs.readFileSync(path.join(root, fileName)));
    if (parsed.errors.length)
        throw new Error(`Parser errors: ${JSON.stringify(parsed.errors.slice(0, 5))}`);
    const expected = new Map();
    parsed.rows.forEach((row, idx) => {
        const coordinator = String(row.coordinator ?? '').trim();
        const proacao = String(row.ctaProAcao ?? row.setor ?? '').trim();
        if (!coordinator || !proacao || !row.accountLabel)
            return;
        const parsedAccount = parseAccountCodeAndName(row.accountLabel);
        const detail = String(row.detailLabel ?? '').trim();
        const code = detail
            ? `${parsedAccount.code}.${slugify(detail).replace(/\./g, '').slice(0, 10)}`
            : parsedAccount.code;
        const name = detail || parsedAccount.name;
        const label = detail ? `${parsedAccount.label} - ${detail}` : parsedAccount.label;
        const key = `${normalize(coordinator)}|${proacao}|${code}`;
        const bucket = expected.get(key) ?? {
            coordinator,
            proacao,
            code,
            name,
            label,
            orderIndex: idx,
            months: {},
        };
        row.months.forEach((m) => {
            bucket.months[m.month] = (bucket.months[m.month] ?? 0) + Number(m.value ?? 0);
        });
        expected.set(key, bucket);
    });
    const coordinators = await prisma.user.findMany({ where: { role: 'COORDINATOR', active: true }, select: { id: true, name: true } });
    const userByNorm = new Map(coordinators.map((u) => [normalize(u.name), u]));
    const missingUsers = new Set();
    for (const bucket of expected.values()) {
        if (!userByNorm.has(normalize(bucket.coordinator)))
            missingUsers.add(bucket.coordinator);
    }
    const expectedByUser = new Map();
    for (const bucket of expected.values()) {
        const user = userByNorm.get(normalize(bucket.coordinator));
        if (!user)
            continue;
        const key = `${bucket.proacao}|${bucket.code}`;
        const map = expectedByUser.get(user.id) ?? new Map();
        map.set(key, bucket);
        expectedByUser.set(user.id, map);
    }
    let removedExtraAccounts = 0;
    let removedExtraValues = 0;
    let valueFixes = 0;
    for (const [userId, expectedMap] of expectedByUser.entries()) {
        const actualAccounts = await prisma.planningAccount.findMany({
            where: { ownerUserId: userId, values: { some: { year: 2026 } } },
            include: {
                proacao: { select: { name: true } },
                values: { where: { year: 2026 }, select: { month: true, value: true } },
                assignments: true,
            },
        });
        for (const account of actualAccounts) {
            const actualKey = `${account.proacao.name}|${account.code}`;
            const expectedBucket = expectedMap.get(actualKey);
            if (!expectedBucket) {
                const delValues = await prisma.planningValue.deleteMany({ where: { accountId: account.id, year: 2026 } });
                removedExtraValues += delValues.count;
                const leftValues = await prisma.planningValue.count({ where: { accountId: account.id } });
                if (leftValues === 0) {
                    await prisma.userAccountAssignment.deleteMany({ where: { accountId: account.id } });
                    await prisma.planningAccount.delete({ where: { id: account.id } });
                    removedExtraAccounts += 1;
                }
                continue;
            }
            for (let month = 1; month <= 12; month += 1) {
                const expectedValue = expectedBucket.months[month] ?? 0;
                const current = account.values.find((v) => v.month === month);
                const currentValue = current ? Number(current.value) : 0;
                if (Math.abs(expectedValue - currentValue) > 0.0001) {
                    await prisma.planningValue.upsert({
                        where: { accountId_year_month: { accountId: account.id, year: 2026, month } },
                        update: {
                            value: expectedValue,
                            source: 'IMPORT_XLSX_PRO_ACAO_2026',
                            sourceFile: 'Detalhado Pro A��o 2026.xlsx',
                            locked: false,
                            updatedById: userId,
                        },
                        create: {
                            accountId: account.id,
                            year: 2026,
                            month,
                            value: expectedValue,
                            source: 'IMPORT_XLSX_PRO_ACAO_2026',
                            sourceFile: 'Detalhado Pro A��o 2026.xlsx',
                            locked: false,
                            updatedById: userId,
                        },
                    });
                    valueFixes += 1;
                }
            }
        }
    }
    let mismatchAccounts = 0;
    let mismatchValues = 0;
    for (const [userId, expectedMap] of expectedByUser.entries()) {
        const actualAccounts = await prisma.planningAccount.findMany({
            where: { ownerUserId: userId, values: { some: { year: 2026 } } },
            include: {
                proacao: { select: { name: true } },
                values: { where: { year: 2026 }, select: { month: true, value: true } },
            },
        });
        const actualKeySet = new Set(actualAccounts.map((a) => `${a.proacao.name}|${a.code}`));
        for (const key of expectedMap.keys()) {
            if (!actualKeySet.has(key))
                mismatchAccounts += 1;
        }
        actualAccounts.forEach((acc) => {
            const key = `${acc.proacao.name}|${acc.code}`;
            const exp = expectedMap.get(key);
            if (!exp) {
                mismatchAccounts += 1;
                return;
            }
            for (let month = 1; month <= 12; month += 1) {
                const expectedValue = exp.months[month] ?? 0;
                const got = Number(acc.values.find((v) => v.month === month)?.value ?? 0);
                if (Math.abs(expectedValue - got) > 0.0001)
                    mismatchValues += 1;
            }
        });
    }
    const prismaService = new prisma_service_1.PrismaService();
    await prismaService.$connect();
    const planningService = new planning_service_1.PlanningService(prismaService);
    let visibilityLeaks = 0;
    for (const user of coordinators) {
        const proacoes = await planningService.listProacoes({ sub: user.id, role: 'COORDINATOR' });
        for (const p of proacoes) {
            const grid = await planningService.getGrid({ sub: user.id, role: 'COORDINATOR' }, p.id, 2026);
            if (grid.accounts.some((a) => a.ownerUserId !== user.id)) {
                visibilityLeaks += 1;
            }
        }
    }
    console.log(JSON.stringify({
        fileName,
        parsedRows: parsed.rows.length,
        expectedBuckets: expected.size,
        coordinatorsInSheet: Array.from(new Set(parsed.rows.map((r) => r.coordinator))).length,
        missingUsers: Array.from(missingUsers),
        sync: {
            removedExtraAccounts,
            removedExtraValues,
            valueFixes,
        },
        validation: {
            mismatchAccounts,
            mismatchValues,
            visibilityLeaks,
        },
    }, null, 2));
    await prismaService.$disconnect();
    await prisma.$disconnect();
})();
//# sourceMappingURL=validate-coordinator-ownership-2026.js.map