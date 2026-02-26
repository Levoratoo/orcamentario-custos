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
exports.parseBudgetScenarioXlsx = parseBudgetScenarioXlsx;
exports.parseBalanceSheetXlsx = parseBalanceSheetXlsx;
const xlsx = __importStar(require("xlsx"));
const constants_1 = require("../common/constants");
const REQUIRED_HEADERS = ['mes', 'setor', 'conta', 'valormitra'];
function normalizeHeader(value) {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '');
}
function normalizeClassification(value) {
    const raw = String(value ?? '').trim();
    if (!raw)
        return '';
    return raw.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').replace(/\.$/, '');
}
function parseMonth(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const raw = typeof value === 'number' ? String(Math.trunc(value)) : String(value).trim();
    if (!raw) {
        return null;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 6) {
        return null;
    }
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
    }
    return { year, monthKey: String(month).padStart(2, '0') };
}
function parseNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    const normalized = raw.replace(/\s/g, '');
    let next = normalized;
    if (normalized.includes(',') && normalized.includes('.')) {
        next = normalized.replace(/\./g, '').replace(',', '.');
    }
    else if (normalized.includes(',')) {
        next = normalized.replace(',', '.');
    }
    const parsed = Number(next);
    return Number.isFinite(parsed) ? parsed : null;
}
function findHeaderRow(rows) {
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || [];
        const indices = {
            mes: [],
            setor: [],
            conta: [],
            valormitra: [],
        };
        row.forEach((cell, idx) => {
            const normalized = normalizeHeader(cell);
            if (normalized === 'mes')
                indices.mes.push(idx);
            if (normalized === 'setor')
                indices.setor.push(idx);
            if (normalized === 'conta')
                indices.conta.push(idx);
            if (normalized === 'valormitra' || normalized === 'valorparamitra')
                indices.valormitra.push(idx);
        });
        const hasAll = REQUIRED_HEADERS.every((key) => indices[key].length > 0);
        if (!hasAll) {
            continue;
        }
        const mesIndex = indices.mes[0];
        const setorIndex = indices.setor[0];
        const valormitraIndex = indices.valormitra[0];
        const contaIndex = indices.conta.find((idx) => idx > setorIndex) ??
            indices.conta.find((idx) => idx > mesIndex) ??
            indices.conta[indices.conta.length - 1];
        return { rowIndex: i, mesIndex, setorIndex, contaIndex, valormitraIndex };
    }
    return null;
}
function findBalanceHeaderRow(rows) {
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || [];
        let classificationIndex = -1;
        let descriptionIndex = -1;
        let saldoIndex = -1;
        row.forEach((cell, idx) => {
            const normalized = normalizeHeader(cell);
            if (normalized === 'classificacao')
                classificationIndex = idx;
            if (normalized === 'descricao' || normalized === 'descrica')
                descriptionIndex = idx;
            if (normalized === 'saldoatual')
                saldoIndex = idx;
        });
        if (classificationIndex >= 0 && descriptionIndex >= 0 && saldoIndex >= 0) {
            return { rowIndex: i, classificationIndex, descriptionIndex, saldoIndex };
        }
    }
    return null;
}
function parseBudgetScenarioXlsx(buffer, fileName) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const rows = [];
    const errors = [];
    const normalizedSheetName = (name) => name
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const subirSheets = workbook.SheetNames.filter((name) => normalizedSheetName(name).startsWith('subir'));
    const targetSheets = subirSheets.length > 0 ? subirSheets : workbook.SheetNames;
    targetSheets.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return;
        }
        const sheetRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const header = findHeaderRow(sheetRows);
        if (!header) {
            return;
        }
        for (let rowIndex = header.rowIndex + 1; rowIndex < sheetRows.length; rowIndex += 1) {
            const row = sheetRows[rowIndex] || [];
            const mesValue = row[header.mesIndex];
            const setorValue = row[header.setorIndex];
            const contaValue = row[header.contaIndex];
            const valorValue = row[header.valormitraIndex];
            const hasContent = mesValue || setorValue || contaValue || valorValue;
            if (!hasContent) {
                continue;
            }
            const parsedMonth = parseMonth(mesValue);
            if (!parsedMonth) {
                errors.push(`${fileName} :: ${sheetName} :: linha ${rowIndex + 1} sem mes valido`);
                continue;
            }
            const sector = String(setorValue ?? '').trim();
            const account = String(contaValue ?? '').trim();
            const value = parseNumber(valorValue);
            if (!sector || !account || value === null) {
                errors.push(`${fileName} :: ${sheetName} :: linha ${rowIndex + 1} incompleta`);
                continue;
            }
            rows.push({
                year: parsedMonth.year,
                monthKey: parsedMonth.monthKey,
                sector,
                account,
                value,
                sourceSheet: sheetName,
                sourceFile: fileName,
            });
        }
    });
    if (!rows.length) {
        errors.push(`${fileName} :: nenhum dado encontrado com colunas Mes/Setor/Conta/Valormitra`);
    }
    const normalizedRows = rows.map((row) => {
        const normalized = { ...row };
        if (!constants_1.MONTH_KEYS.includes(normalized.monthKey)) {
            normalized.monthKey = '01';
        }
        return normalized;
    });
    return { rows: normalizedRows, errors };
}
function parsePeriodFromSheet(rows) {
    for (const row of rows) {
        const text = row.map((cell) => String(cell ?? '')).join(' ');
        if (!text.toLowerCase().includes('período') && !text.toLowerCase().includes('periodo')) {
            continue;
        }
        const matches = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/g);
        if (!matches || matches.length === 0)
            continue;
        const last = matches[matches.length - 1];
        const [day, month, year] = last.split('/');
        const normalizedYear = year.length === 2 ? Number(`20${year}`) : Number(year);
        const monthNumber = Number(month);
        if (Number.isFinite(normalizedYear) && Number.isFinite(monthNumber)) {
            return { year: normalizedYear, monthKey: String(monthNumber).padStart(2, '0') };
        }
    }
    return null;
}
function parseBalanceSheetXlsx(buffer, fileName) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const rows = [];
    const errors = [];
    workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            return;
        }
        const sheetRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const header = findBalanceHeaderRow(sheetRows);
        if (!header) {
            return;
        }
        const period = parsePeriodFromSheet(sheetRows);
        if (!period) {
            errors.push(`${fileName} :: ${sheetName} :: periodo nao identificado`);
            return;
        }
        for (let rowIndex = header.rowIndex + 1; rowIndex < sheetRows.length; rowIndex += 1) {
            const row = sheetRows[rowIndex] || [];
            const classificationRaw = row[header.classificationIndex];
            const descriptionRaw = row[header.descriptionIndex];
            const saldoRaw = row[header.saldoIndex];
            const classification = normalizeClassification(classificationRaw);
            const description = String(descriptionRaw ?? '').trim();
            const saldo = parseNumber(saldoRaw);
            if (!classification || !description || saldo === null) {
                continue;
            }
            rows.push({
                year: period.year,
                monthKey: period.monthKey,
                sector: 'GERAL',
                account: classification,
                value: saldo,
                sourceSheet: sheetName,
                sourceFile: fileName,
            });
        }
    });
    if (!rows.length) {
        errors.push(`${fileName} :: nenhuma linha com saldo atual encontrada`);
    }
    return { rows, errors };
}
//# sourceMappingURL=budget-scenario.importer.js.map