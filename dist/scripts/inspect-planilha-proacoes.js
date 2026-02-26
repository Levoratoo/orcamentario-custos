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
const XLSX = __importStar(require("xlsx"));
const cwd = process.cwd();
const fileName = fs
    .readdirSync(cwd)
    .find((name) => /^Detalhado Pro A/i.test(name) && name.toLowerCase().endsWith('.xlsx')) ??
    'Detalhado Pro Acao 2026.xlsx';
const workbook = XLSX.readFile(path.join(cwd, fileName));
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
const columns = rows.length ? Object.keys(rows[0]) : [];
console.log('FILE', fileName);
console.log('SHEET', workbook.SheetNames[0]);
console.log('COLUMNS', columns.join(' | '));
const targetColumn = columns.find((column) => /cta\s*-\s*pro/i.test(column)) ??
    columns.find((column) => /pro\s*a[cç][aã]o/i.test(column)) ??
    columns.find((column) => /pro/i.test(column));
console.log('TARGET_COLUMN', targetColumn ?? '(not found)');
if (targetColumn) {
    const values = Array.from(new Set(rows
        .map((row) => String(row[targetColumn] ?? '').trim())
        .filter((value) => value.length > 0))).sort((left, right) => left.localeCompare(right, 'pt-BR'));
    console.log('UNIQUE_VALUES', values.length);
    values.forEach((value) => console.log(value));
}
//# sourceMappingURL=inspect-planilha-proacoes.js.map