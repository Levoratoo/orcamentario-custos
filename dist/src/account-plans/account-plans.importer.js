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
exports.parseAccountPlanXlsx = parseAccountPlanXlsx;
exports.importAccountPlanRows = importAccountPlanRows;
const XLSX = __importStar(require("xlsx"));
function normalizeValue(value) {
    if (value === null || value === undefined)
        return '';
    return String(value).trim();
}
function parseAccountPlanXlsx(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
    const sheet = workbook.Sheets['Planilha1'] ?? workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i += 1) {
        const value = normalizeValue(rows[i]?.[0]).toLowerCase();
        if (value === 'codigo' || value === 'código') {
            headerRowIndex = i;
            break;
        }
    }
    if (headerRowIndex === -1) {
        return { rows: [], errors: [{ line: 0, message: 'Cabecalho "Codigo" nao encontrado na coluna A.' }], headerRowIndex };
    }
    const dataRows = rows.slice(headerRowIndex + 1);
    const parsed = [];
    const errors = [];
    dataRows.forEach((row, index) => {
        const line = headerRowIndex + 2 + index;
        const code = normalizeValue(row?.[0]);
        const type = normalizeValue(row?.[1]).toUpperCase();
        const classification = normalizeValue(row?.[2]);
        const description = normalizeValue(row?.[3]);
        if (!code && !classification && !description) {
            return;
        }
        if (!code || !classification || !description) {
            errors.push({ line, code, message: 'Linha incompleta. Codigo, classificacao e descricao sao obrigatorios.' });
            return;
        }
        if (type !== 'T' && type !== 'A') {
            errors.push({ line, code, message: 'Tipo invalido. Use T ou A.' });
            return;
        }
        const level = classification.split('.').filter(Boolean).length;
        parsed.push({
            code,
            type: type,
            classification,
            description,
            level,
            line,
        });
    });
    return { rows: parsed, errors, headerRowIndex };
}
async function importAccountPlanRows(prisma, rows, existingErrors = []) {
    let inserted = 0;
    let updated = 0;
    const errors = [...existingErrors];
    for (const row of rows) {
        try {
            const existing = await prisma.accountPlan.findUnique({ where: { code: row.code } });
            if (existing) {
                await prisma.accountPlan.update({
                    where: { id: existing.id },
                    data: {
                        type: row.type,
                        classification: row.classification,
                        description: row.description,
                        level: row.level,
                        isAtiva: true,
                    },
                });
                updated += 1;
            }
            else {
                await prisma.accountPlan.create({
                    data: {
                        code: row.code,
                        type: row.type,
                        classification: row.classification,
                        description: row.description,
                        level: row.level,
                        isAtiva: true,
                    },
                });
                inserted += 1;
            }
        }
        catch (error) {
            errors.push({ line: row.line, code: row.code, message: error.message });
        }
    }
    const classifications = rows.map((row) => row.classification);
    const plans = await prisma.accountPlan.findMany({ where: { classification: { in: classifications } } });
    const planByClassification = new Map(plans.map((plan) => [plan.classification, plan.id]));
    await Promise.all(rows.map(async (row) => {
        const parentClass = row.classification.split('.').slice(0, -1).join('.');
        const parentId = parentClass ? planByClassification.get(parentClass) : null;
        try {
            await prisma.accountPlan.updateMany({
                where: { code: row.code },
                data: { parentId: parentId ?? null },
            });
        }
        catch (error) {
            errors.push({ line: row.line, code: row.code, message: error.message });
        }
    }));
    return {
        total: rows.length,
        inserted,
        updated,
        errors,
    };
}
//# sourceMappingURL=account-plans.importer.js.map