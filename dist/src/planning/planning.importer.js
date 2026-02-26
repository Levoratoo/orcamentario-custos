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
exports.importPlanningXlsx = importPlanningXlsx;
const xlsx = __importStar(require("xlsx"));
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const budget_2026_proacao_importer_1 = require("../imports/budget-2026-proacao.importer");
function normalizeKey(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}
function slugify(value) {
    return value
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
async function upsertCoordinator(prisma, sponsor, passwordHash) {
    const username = slugify(sponsor);
    if (!username)
        return null;
    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { name: sponsor }] },
    });
    return existingUser
        ? prisma.user.update({
            where: { id: existingUser.id },
            data: { name: sponsor, role: client_1.Role.COORDINATOR, active: true },
        })
        : prisma.user.create({
            data: {
                name: sponsor,
                username,
                email: `${username}@coordenador.local`,
                passwordHash,
                role: client_1.Role.COORDINATOR,
                mustChangePassword: true,
                active: true,
            },
        });
}
async function importDetailedProAcao2026(prisma, buffer, options) {
    const parsed = (0, budget_2026_proacao_importer_1.parseBudget2026CoordinatorWorkbook)(buffer);
    if (parsed.rows.length === 0) {
        return null;
    }
    const password = options.defaultPassword ?? '123456';
    const passwordHash = await bcrypt.hash(password, 10);
    const createdById = options.createdById;
    if (!createdById) {
        throw new Error('createdById is required for planning import');
    }
    const buckets = new Map();
    let skipped = 0;
    parsed.rows.forEach((row, idx) => {
        const coordinator = String(row.coordinator ?? '').trim();
        const proacao = String(row.ctaProAcao ?? row.setor ?? '').trim();
        if (!coordinator || !proacao || !row.accountLabel) {
            skipped += 1;
            return;
        }
        const parsedAccount = parseAccountCodeAndName(row.accountLabel);
        const detail = String(row.detailLabel ?? '').trim();
        const code = detail
            ? `${parsedAccount.code}.${slugify(detail).replace(/\./g, '').slice(0, 10)}`
            : parsedAccount.code;
        const name = detail || parsedAccount.name;
        const label = detail ? `${parsedAccount.label} - ${detail}` : parsedAccount.label;
        const key = `${coordinator}|${proacao}|${code}`;
        const bucket = buckets.get(key) ?? {
            coordinator,
            proacao,
            code,
            name,
            label,
            orderIndex: idx,
            monthValues: {},
        };
        row.months.forEach((entry) => {
            if (!entry?.month || entry.month < 1 || entry.month > 12)
                return;
            bucket.monthValues[entry.month] = (bucket.monthValues[entry.month] ?? 0) + Number(entry.value ?? 0);
        });
        buckets.set(key, bucket);
    });
    let inserted = 0;
    let updated = 0;
    let valuesUpserted = 0;
    for (const item of buckets.values()) {
        const user = await upsertCoordinator(prisma, item.coordinator, passwordHash);
        if (!user) {
            skipped += 1;
            continue;
        }
        const proacaoEntity = await prisma.proacao.upsert({
            where: { name: item.proacao },
            update: {},
            create: { name: item.proacao },
        });
        const existingAccount = await prisma.planningAccount.findUnique({
            where: {
                proacaoId_code_ownerUserId: {
                    proacaoId: proacaoEntity.id,
                    code: item.code,
                    ownerUserId: user.id,
                },
            },
        });
        const account = existingAccount
            ? await prisma.planningAccount.update({
                where: { id: existingAccount.id },
                data: {
                    label: item.label,
                    name: item.name,
                    orderIndex: item.orderIndex,
                },
            })
            : await prisma.planningAccount.create({
                data: {
                    proacaoId: proacaoEntity.id,
                    code: item.code,
                    label: item.label,
                    name: item.name,
                    ownerUserId: user.id,
                    orderIndex: item.orderIndex,
                },
            });
        if (existingAccount) {
            updated += 1;
        }
        else {
            inserted += 1;
        }
        await prisma.userAccountAssignment.upsert({
            where: { userId_accountId: { userId: user.id, accountId: account.id } },
            update: {},
            create: {
                userId: user.id,
                accountId: account.id,
                createdById,
            },
        });
        for (let month = 1; month <= 12; month += 1) {
            await prisma.planningValue.upsert({
                where: {
                    accountId_year_month: {
                        accountId: account.id,
                        year: 2026,
                        month,
                    },
                },
                update: {
                    value: item.monthValues[month] ?? 0,
                    source: 'IMPORT_XLSX_PRO_ACAO_2026',
                    sourceFile: 'Detalhado Pro Ação 2026.xlsx',
                    locked: false,
                    updatedById: createdById,
                },
                create: {
                    accountId: account.id,
                    year: 2026,
                    month,
                    value: item.monthValues[month] ?? 0,
                    source: 'IMPORT_XLSX_PRO_ACAO_2026',
                    sourceFile: 'Detalhado Pro Ação 2026.xlsx',
                    locked: false,
                    updatedById: createdById,
                },
            });
            valuesUpserted += 1;
        }
    }
    return { inserted, updated, skipped, valuesUpserted };
}
async function importLegacyPlanningFormat(prisma, buffer, options) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return { inserted: 0, updated: 0, skipped: 0 };
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const password = options.defaultPassword ?? '123456';
    const passwordHash = await bcrypt.hash(password, 10);
    const createdById = options.createdById;
    if (!createdById) {
        throw new Error('createdById is required for planning import');
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (let index = 0; index < rawRows.length; index += 1) {
        const row = rawRows[index];
        const normalized = {};
        Object.keys(row).forEach((key) => {
            normalized[normalizeKey(key)] = String(row[key] ?? '').trim();
        });
        const proacao = normalized.proacao;
        const code = normalized.cod || normalized.codigo || normalized['cod.'];
        const label = normalized.contas || normalized.conta || normalized.setor;
        const sponsor = normalized.padrinho || normalized.coordenador || normalized.responsavel;
        if (!proacao || !code || !label || !sponsor) {
            skipped += 1;
            continue;
        }
        const user = await upsertCoordinator(prisma, sponsor, passwordHash);
        if (!user) {
            skipped += 1;
            continue;
        }
        const proacaoEntity = await prisma.proacao.upsert({
            where: { name: proacao },
            update: {},
            create: { name: proacao },
        });
        const name = parseAccountName(label);
        const existing = await prisma.planningAccount.findUnique({
            where: {
                proacaoId_code_ownerUserId: {
                    proacaoId: proacaoEntity.id,
                    code: String(code),
                    ownerUserId: user.id,
                },
            },
        });
        let accountId;
        if (existing) {
            await prisma.planningAccount.update({
                where: { id: existing.id },
                data: {
                    label,
                    name,
                    orderIndex: index,
                },
            });
            accountId = existing.id;
            updated += 1;
        }
        else {
            const created = await prisma.planningAccount.create({
                data: {
                    proacaoId: proacaoEntity.id,
                    code: String(code),
                    label,
                    name,
                    ownerUserId: user.id,
                    orderIndex: index,
                },
            });
            accountId = created.id;
            inserted += 1;
        }
        await prisma.userAccountAssignment.upsert({
            where: {
                userId_accountId: { userId: user.id, accountId },
            },
            update: {},
            create: {
                userId: user.id,
                accountId,
                createdById,
            },
        });
    }
    return { inserted, updated, skipped };
}
async function importPlanningXlsx(prisma, buffer, options = { createdById: '' }) {
    const proAcaoResult = await importDetailedProAcao2026(prisma, buffer, options);
    if (proAcaoResult) {
        return proAcaoResult;
    }
    return importLegacyPlanningFormat(prisma, buffer, options);
}
//# sourceMappingURL=planning.importer.js.map