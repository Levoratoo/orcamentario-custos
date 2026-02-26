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
exports.importHistoricalPlanning = importHistoricalPlanning;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const xlsx = __importStar(require("xlsx"));
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
function parseAccountCode(label) {
    const match = label.match(/^(\d+(?:\.\d+)*)\s*-\s*(.+)$/);
    return match?.[1] ?? '';
}
function parseAccountName(label) {
    const match = label.match(/^[\d.]+\s*-\s*(.+)$/);
    return (match?.[1] ?? label).trim();
}
function parseDecimal(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    const text = String(value)
        .replace('R$', '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
}
function resolveHistoricalFiles(root) {
    const files = fs.readdirSync(root);
    const targets = [];
    for (const year of [2020, 2021, 2022, 2023]) {
        const found = files.find((name) => {
            const normalized = normalizeKey(name);
            return normalized.includes(`proacao${year}`) || normalized.includes(`proa${year}`);
        });
        if (found) {
            targets.push({ year, file: path.join(root, found) });
        }
    }
    return targets;
}
function parseAccountCatalog(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const entries = [];
    rows.forEach((row, index) => {
        const normalized = {};
        Object.keys(row).forEach((key) => {
            normalized[normalizeKey(key)] = String(row[key] ?? '').trim();
        });
        const proacao = normalized['proacao'];
        const code = normalized['cod'] || normalized['codigo'] || normalized['cod.'];
        const label = normalized['contas'] || normalized['conta'] || normalized['setor'];
        const padrinho = normalized['padrinho'] || normalized['coordenador'] || normalized['responsavel'];
        if (!proacao || !code || !label || !padrinho)
            return;
        entries.push({ proacao, code: String(code), label, padrinho, orderIndex: index });
    });
    return entries;
}
async function ensureCoordinator(prisma, name, passwordHash) {
    const username = slugify(name);
    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { name }] } });
    if (existing) {
        return prisma.user.update({
            where: { id: existing.id },
            data: { name, role: client_1.Role.COORDINATOR, active: true },
        });
    }
    return prisma.user.create({
        data: {
            name,
            username,
            email: `${username}@coordenador.local`,
            role: client_1.Role.COORDINATOR,
            passwordHash,
            mustChangePassword: true,
            active: true,
        },
    });
}
async function importHistoricalPlanning(prisma, rootDir) {
    const catalogFile = path.join(rootDir, 'conta de cada coordenador.xlsx');
    if (!fs.existsSync(catalogFile)) {
        throw new Error(`Catalogo nao encontrado: ${catalogFile}`);
    }
    const passwordHash = await bcrypt.hash('123456', 10);
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (!admin)
        throw new Error('Admin user nao encontrado');
    const catalog = parseAccountCatalog(catalogFile);
    const catalogByCode = new Map();
    catalog.forEach((entry) => catalogByCode.set(entry.code, entry));
    let assignmentsCount = 0;
    let accountCount = 0;
    const proacaoNames = new Set();
    await ensureCoordinator(prisma, 'Importado', passwordHash);
    await prisma.proacao.upsert({
        where: { name: 'Importado' },
        update: {},
        create: { name: 'Importado' },
    });
    for (const entry of catalog) {
        const coordinator = await ensureCoordinator(prisma, entry.padrinho, passwordHash);
        const proacao = await prisma.proacao.upsert({
            where: { name: entry.proacao },
            update: {},
            create: { name: entry.proacao },
        });
        proacaoNames.add(proacao.name);
        const existing = await prisma.planningAccount.findUnique({
            where: {
                proacaoId_code_ownerUserId: {
                    proacaoId: proacao.id,
                    code: String(entry.code),
                    ownerUserId: coordinator.id,
                },
            },
        });
        let accountId;
        if (existing) {
            await prisma.planningAccount.update({
                where: { id: existing.id },
                data: {
                    label: entry.label,
                    name: parseAccountName(entry.label),
                    orderIndex: entry.orderIndex,
                },
            });
            accountId = existing.id;
        }
        else {
            const created = await prisma.planningAccount.create({
                data: {
                    proacaoId: proacao.id,
                    code: String(entry.code),
                    label: entry.label,
                    name: parseAccountName(entry.label),
                    ownerUserId: coordinator.id,
                    orderIndex: entry.orderIndex,
                },
            });
            accountId = created.id;
            accountCount += 1;
        }
        await prisma.userAccountAssignment.upsert({
            where: { userId_accountId: { userId: coordinator.id, accountId } },
            update: {},
            create: { userId: coordinator.id, accountId, createdById: admin.id },
        });
        assignmentsCount += 1;
    }
    const valuesByYear = {};
    const files = resolveHistoricalFiles(rootDir);
    for (const item of files) {
        const year = item.year;
        const workbook = xlsx.readFile(item.file);
        let totalCells = 0;
        const totalsByMonth = {};
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
            if (rows.length === 0)
                continue;
            const header = rows[0].map((value) => String(value ?? ''));
            const headerMap = {};
            header.forEach((value, index) => {
                headerMap[normalizeKey(value)] = index;
            });
            const codeIndex = headerMap['cod'] ?? headerMap['codigo'] ?? -1;
            const labelIndex = headerMap['contacontabil'] ?? 0;
            const monthColumns = header
                .map((value, index) => {
                const text = String(value ?? '');
                if (!text.toLowerCase().includes('previsto'))
                    return null;
                const match = text.match(/(\d{2})\/(\d{4})/);
                if (!match)
                    return null;
                const month = Number(match[1]);
                const colYear = Number(match[2]);
                if (colYear !== year)
                    return null;
                return { index, month };
            })
                .filter(Boolean);
            for (let i = 1; i < rows.length; i += 1) {
                const row = rows[i] ?? [];
                const rawLabel = String(row[labelIndex] ?? '').trim();
                if (!rawLabel)
                    continue;
                const code = codeIndex >= 0 ? String(row[codeIndex] ?? '').trim() : parseAccountCode(rawLabel);
                const accountCode = code || parseAccountCode(rawLabel);
                if (!accountCode)
                    continue;
                const catalogEntry = catalogByCode.get(accountCode);
                const proacaoName = catalogEntry?.proacao ?? 'Importado';
                const padrinhoName = catalogEntry?.padrinho ?? 'Importado';
                const label = catalogEntry?.label ?? rawLabel;
                const orderIndex = catalogEntry?.orderIndex ?? i;
                const coordinator = await ensureCoordinator(prisma, padrinhoName, passwordHash);
                const proacao = await prisma.proacao.upsert({
                    where: { name: proacaoName },
                    update: {},
                    create: { name: proacaoName },
                });
                proacaoNames.add(proacao.name);
                const existing = await prisma.planningAccount.findUnique({
                    where: {
                        proacaoId_code_ownerUserId: {
                            proacaoId: proacao.id,
                            code: accountCode,
                            ownerUserId: coordinator.id,
                        },
                    },
                });
                let accountId;
                if (existing) {
                    await prisma.planningAccount.update({
                        where: { id: existing.id },
                        data: { label, name: parseAccountName(label), orderIndex },
                    });
                    accountId = existing.id;
                }
                else {
                    const created = await prisma.planningAccount.create({
                        data: {
                            proacaoId: proacao.id,
                            code: accountCode,
                            label,
                            name: parseAccountName(label),
                            ownerUserId: coordinator.id,
                            orderIndex,
                        },
                    });
                    accountId = created.id;
                    accountCount += 1;
                }
                await prisma.userAccountAssignment.upsert({
                    where: { userId_accountId: { userId: coordinator.id, accountId } },
                    update: {},
                    create: { userId: coordinator.id, accountId, createdById: admin.id },
                });
                assignmentsCount += 1;
                for (const col of monthColumns) {
                    const value = parseDecimal(row[col.index]);
                    totalsByMonth[col.month] = (totalsByMonth[col.month] ?? 0) + value;
                    totalCells += 1;
                    await prisma.planningValue.upsert({
                        where: { accountId_year_month: { accountId, year, month: col.month } },
                        update: {
                            value,
                            source: 'IMPORT',
                            sourceFile: path.basename(item.file),
                            locked: true,
                            updatedById: admin.id,
                        },
                        create: {
                            accountId,
                            year,
                            month: col.month,
                            value,
                            source: 'IMPORT',
                            sourceFile: path.basename(item.file),
                            locked: true,
                            updatedById: admin.id,
                        },
                    });
                }
            }
        }
        const totalAnnual = Object.values(totalsByMonth).reduce((sum, value) => sum + value, 0);
        valuesByYear[year] = {
            file: path.basename(item.file),
            cells: totalCells,
            totalAnnual,
            totalsByMonth,
        };
    }
    return {
        catalog: {
            proacoes: proacaoNames.size,
            accounts: accountCount,
            assignments: assignmentsCount,
        },
        valuesByYear,
    };
}
//# sourceMappingURL=historical-importer.js.map