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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
const prisma = new client_1.PrismaClient();
function normalizeStrict(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
function normalizeLoose(value) {
    return normalizeStrict(value)
        .replace(/[./,&()-]/g, ' ')
        .replace(/\bMATERIAL\b/g, 'MAT')
        .replace(/\bDE\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function pickSpreadsheetFile(cwd) {
    return (fs
        .readdirSync(cwd)
        .find((name) => /^Detalhado Pro A/i.test(name) && name.toLowerCase().endsWith('.xlsx')) ?? null);
}
async function moveAccount(sourceAccountId, targetAccountId) {
    const sourceValues = await prisma.planningValue.findMany({
        where: { accountId: sourceAccountId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    for (const sourceValue of sourceValues) {
        const existing = await prisma.planningValue.findUnique({
            where: {
                accountId_year_month: {
                    accountId: targetAccountId,
                    year: sourceValue.year,
                    month: sourceValue.month,
                },
            },
        });
        if (!existing) {
            await prisma.planningValue.create({
                data: {
                    accountId: targetAccountId,
                    year: sourceValue.year,
                    month: sourceValue.month,
                    value: sourceValue.value,
                    source: sourceValue.source,
                    sourceFile: sourceValue.sourceFile,
                    locked: sourceValue.locked,
                    updatedById: sourceValue.updatedById,
                },
            });
            continue;
        }
        const existingNum = Number(existing.value ?? 0);
        const sourceNum = Number(sourceValue.value ?? 0);
        const merged = Math.abs(existingNum) > 0.00001 ? existingNum : sourceNum;
        if (Math.abs(existingNum - merged) > 0.00001) {
            await prisma.planningValue.update({
                where: { id: existing.id },
                data: {
                    value: merged,
                    source: sourceValue.source,
                    sourceFile: sourceValue.sourceFile,
                    locked: existing.locked || sourceValue.locked,
                    updatedById: sourceValue.updatedById,
                },
            });
        }
    }
    const sourceAssignments = await prisma.userAccountAssignment.findMany({
        where: { accountId: sourceAccountId },
    });
    for (const assignment of sourceAssignments) {
        const conflict = await prisma.userAccountAssignment.findUnique({
            where: {
                userId_accountId: {
                    userId: assignment.userId,
                    accountId: targetAccountId,
                },
            },
        });
        if (!conflict) {
            await prisma.userAccountAssignment.create({
                data: {
                    userId: assignment.userId,
                    accountId: targetAccountId,
                    createdById: assignment.createdById,
                },
            });
        }
    }
    await prisma.planningValue.deleteMany({ where: { accountId: sourceAccountId } });
    await prisma.userAccountAssignment.deleteMany({ where: { accountId: sourceAccountId } });
    await prisma.planningAccount.delete({ where: { id: sourceAccountId } });
}
async function mergeProacao(sourceId, targetId) {
    if (sourceId === targetId)
        return { movedAccounts: 0, deletedAccounts: 0 };
    const sourceAccounts = await prisma.planningAccount.findMany({
        where: { proacaoId: sourceId },
        select: { id: true, code: true, ownerUserId: true },
    });
    let movedAccounts = 0;
    let deletedAccounts = 0;
    for (const sourceAccount of sourceAccounts) {
        const conflict = await prisma.planningAccount.findFirst({
            where: {
                proacaoId: targetId,
                code: sourceAccount.code,
                ownerUserId: sourceAccount.ownerUserId,
            },
            select: { id: true },
        });
        if (!conflict) {
            await prisma.planningAccount.update({
                where: { id: sourceAccount.id },
                data: { proacaoId: targetId },
            });
            movedAccounts += 1;
            continue;
        }
        await moveAccount(sourceAccount.id, conflict.id);
        deletedAccounts += 1;
    }
    const sourceLimits = await prisma.budgetLimit.findMany({
        where: { proacaoId: sourceId },
        orderBy: [{ updatedAt: 'desc' }],
    });
    for (const sourceLimit of sourceLimits) {
        const existing = await prisma.budgetLimit.findFirst({
            where: {
                year: sourceLimit.year,
                proacaoId: targetId,
                userId: sourceLimit.userId,
            },
        });
        if (!existing) {
            await prisma.budgetLimit.update({
                where: { id: sourceLimit.id },
                data: { proacaoId: targetId },
            });
            continue;
        }
        if (sourceLimit.updatedAt > existing.updatedAt) {
            await prisma.budgetLimit.update({
                where: { id: existing.id },
                data: { maxValue: sourceLimit.maxValue },
            });
        }
        await prisma.budgetLimit.delete({ where: { id: sourceLimit.id } });
    }
    await prisma.proacao.delete({ where: { id: sourceId } });
    return { movedAccounts, deletedAccounts };
}
async function main() {
    const cwd = process.cwd();
    const spreadsheetFile = pickSpreadsheetFile(cwd);
    if (!spreadsheetFile) {
        throw new Error('Arquivo "Detalhado Pro Ação 2026.xlsx" não encontrado');
    }
    const workbook = XLSX.readFile(path.join(cwd, spreadsheetFile));
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const proacaoColumn = columns.find((column) => /cta\s*-\s*pro/i.test(column)) ??
        columns.find((column) => /pro\s*a[cç][aã]o/i.test(column));
    if (!proacaoColumn) {
        throw new Error('Coluna de Pró Ação não encontrada na planilha');
    }
    const canonicalNames = Array.from(new Set(rows.map((row) => String(row[proacaoColumn] ?? '').trim()).filter(Boolean)));
    const canonicalByStrict = new Map(canonicalNames.map((name) => [normalizeStrict(name), name]));
    const canonicalByLoose = new Map(canonicalNames.map((name) => [normalizeLoose(name), name]));
    const aliasToCanonical = new Map([
        [normalizeStrict('Copa/Cozinha/Material de Expediente'), 'Copa/Cozinha/Mat.Expediente'],
        [normalizeStrict('Impostos e Taxas'), 'Impostos/Taxas/Contribuições'],
        [normalizeStrict('Instalações e Prestações de Serviços'), 'Instalações e Prestação de Serviços'],
        [normalizeStrict('Viagem e Comercial'), 'Viagens e Comercial'],
        [normalizeStrict('Penitenciária & Jonas'), 'Penitenciária/Terceiros'],
    ]);
    const proacoes = await prisma.proacao.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { accounts: true } } },
    });
    const targetByCanonical = new Map();
    for (const canonicalName of canonicalNames) {
        const strict = normalizeStrict(canonicalName);
        const candidates = proacoes.filter((item) => {
            const strictName = normalizeStrict(item.name);
            return strictName === strict || normalizeLoose(item.name) === normalizeLoose(canonicalName);
        });
        if (candidates.length === 0)
            continue;
        const best = candidates.sort((a, b) => b._count.accounts - a._count.accounts)[0];
        targetByCanonical.set(canonicalName, { id: best.id, name: best.name });
    }
    const actions = [];
    for (const item of proacoes) {
        const strictName = normalizeStrict(item.name);
        const looseName = normalizeLoose(item.name);
        const canonicalName = canonicalByStrict.get(strictName) ??
            aliasToCanonical.get(strictName) ??
            canonicalByLoose.get(looseName) ??
            null;
        if (!canonicalName)
            continue;
        const target = targetByCanonical.get(canonicalName);
        if (!target)
            continue;
        if (item.id === target.id)
            continue;
        actions.push({
            sourceId: item.id,
            sourceName: item.name,
            targetCanonical: canonicalName,
            targetId: target.id,
            targetName: target.name,
        });
    }
    let totalMoved = 0;
    let totalDeleted = 0;
    for (const action of actions) {
        const result = await mergeProacao(action.sourceId, action.targetId);
        totalMoved += result.movedAccounts;
        totalDeleted += result.deletedAccounts;
        console.log(`MERGED "${action.sourceName}" -> "${action.targetName}" (canonical="${action.targetCanonical}") moved=${result.movedAccounts} merged=${result.deletedAccounts}`);
    }
    console.log(`DONE merges=${actions.length} movedAccounts=${totalMoved} mergedAccounts=${totalDeleted}`);
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=consolidate-proacoes-from-planilha.js.map