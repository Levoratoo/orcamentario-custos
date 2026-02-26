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
exports.parseDreFile = parseDreFile;
const xlsx = __importStar(require("xlsx"));
const sync_1 = require("csv-parse/sync");
const client_1 = require("@prisma/client");
function normalizeCell(value) {
    if (value === null || value === undefined)
        return '';
    return String(value).trim();
}
function inferLevel(label) {
    const match = label.match(/^(\s+)/);
    if (!match)
        return 0;
    return Math.max(0, Math.floor(match[1].length / 2));
}
function parseMonth(label) {
    const parts = label.split('/');
    if (parts.length < 2)
        return null;
    const month = Number(parts[0]);
    if (!Number.isFinite(month))
        return null;
    return month;
}
function parseKind(value) {
    const lower = value.toLowerCase();
    if (lower.includes('real'))
        return client_1.DreMode.REALIZADO;
    return client_1.DreMode.PREVISTO;
}
function buildColumns(header, kindRow) {
    let currentLabel = '';
    return header.map((cell, index) => {
        const label = normalizeCell(cell);
        if (label) {
            currentLabel = label;
        }
        const kind = normalizeCell(kindRow?.[index] ?? '');
        const monthLabel = currentLabel;
        const month = monthLabel === 'Total' ? null : parseMonth(monthLabel);
        return {
            label: monthLabel,
            kind: kind || 'Previsto',
            month,
            mode: parseKind(kind || monthLabel),
        };
    });
}
function parseDreFile(buffer, fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
        const csvText = buffer.toString('utf8');
        const records = (0, sync_1.parse)(csvText, { relax_column_count: true });
        return parseFromRows(records);
    }
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });
    return parseFromRows(rows);
}
function parseFromRows(rows) {
    const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeCell(cell).toLowerCase().includes('conta')));
    if (headerIndex === -1) {
        throw new Error('Cabecalho de contas nao encontrado.');
    }
    const headerRow = rows[headerIndex];
    const kindRow = rows[headerIndex + 1]?.some((cell) => /previsto|realizado/i.test(normalizeCell(cell)))
        ? rows[headerIndex + 1]
        : undefined;
    const dataStart = kindRow ? headerIndex + 2 : headerIndex + 1;
    const columns = buildColumns(headerRow.slice(1), kindRow?.slice(1));
    const parsedRows = [];
    for (let i = dataStart; i < rows.length; i += 1) {
        const row = rows[i];
        const label = normalizeCell(row?.[0]);
        if (!label)
            continue;
        const level = inferLevel(label);
        const values = row.slice(1).map((cell) => {
            const num = Number(String(cell).replace(/\./g, '').replace(',', '.'));
            return Number.isFinite(num) ? num : 0;
        });
        parsedRows.push({ label, level, values });
    }
    return { columns, rows: parsedRows };
}
//# sourceMappingURL=budget-importer.js.map