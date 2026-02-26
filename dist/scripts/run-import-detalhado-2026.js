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
const planning_importer_1 = require("../src/planning/planning.importer");
function normalize(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
(async () => {
    const prisma = new client_1.PrismaClient();
    await prisma.$connect();
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' } });
    if (!admin)
        throw new Error('Admin user not found');
    const root = process.cwd();
    const fileName = fs.readdirSync(root).find((name) => {
        const n = normalize(name);
        return n.includes('detalhado pro acao 2026') && n.endsWith('.xlsx');
    });
    if (!fileName)
        throw new Error('Detalhado Pro Acao 2026.xlsx not found');
    const buffer = fs.readFileSync(path.join(root, fileName));
    const result = await (0, planning_importer_1.importPlanningXlsx)(prisma, buffer, { createdById: admin.id, defaultPassword: '123456' });
    const totalAccounts2026 = await prisma.planningAccount.count({
        where: { values: { some: { year: 2026 } } },
    });
    const nonZeroValues2026 = await prisma.planningValue.count({
        where: { year: 2026, NOT: { value: 0 } },
    });
    const sample = await prisma.planningAccount.findMany({
        where: { values: { some: { year: 2026 } } },
        select: {
            code: true,
            label: true,
            owner: { select: { name: true } },
            values: { where: { year: 2026, month: { in: [1, 2, 3] } }, orderBy: { month: 'asc' }, select: { month: true, value: true } },
        },
        take: 12,
        orderBy: { orderIndex: 'asc' },
    });
    console.log(JSON.stringify({
        fileName,
        importResult: result,
        totalAccounts2026,
        nonZeroValues2026,
        sample: sample.map((item) => ({
            code: item.code,
            label: item.label,
            owner: item.owner.name,
            months: item.values.map((v) => ({ month: v.month, value: Number(v.value) })),
        })),
    }, null, 2));
    await prisma.$disconnect();
})();
//# sourceMappingURL=run-import-detalhado-2026.js.map