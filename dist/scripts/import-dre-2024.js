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
const prisma_service_1 = require("../src/prisma/prisma.service");
const budgets_service_1 = require("../src/budgets/budgets.service");
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const service = new budgets_service_1.BudgetsService(prisma);
    const filePath = path.resolve(process.cwd(), 'dre 2024 1.xlsx');
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }
    let budget = await prisma.budget.findFirst({
        where: { year: 2024, kind: client_1.BudgetKind.BUDGET },
        orderBy: { updatedAt: 'desc' },
    });
    if (!budget) {
        budget = await prisma.budget.create({
            data: {
                name: 'DRE 2024 1',
                year: 2024,
                kind: client_1.BudgetKind.BUDGET,
                status: 'DRAFT',
                isActive: false,
            },
        });
        console.log(`Budget criado: ${budget.id} (${budget.name})`);
    }
    else {
        console.log(`Usando budget existente: ${budget.id} (${budget.name})`);
    }
    const buffer = fs.readFileSync(filePath);
    const result = await service.importFile(budget.id, {
        originalname: path.basename(filePath),
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
        size: buffer.length,
    });
    const updatedBudget = await prisma.budget.findUnique({ where: { id: budget.id } });
    const linesCount = await prisma.dreLine.count({ where: { budgetId: budget.id } });
    console.log('Import concluido:', result);
    console.log('Budget status:', updatedBudget?.status, 'version:', updatedBudget?.version, 'year:', updatedBudget?.year);
    console.log('Linhas DRE:', linesCount);
    await prisma.$disconnect();
}
main().catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=import-dre-2024.js.map