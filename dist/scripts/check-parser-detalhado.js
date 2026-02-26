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
const budget_2026_proacao_importer_1 = require("../src/imports/budget-2026-proacao.importer");
function normalize(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const root = process.cwd();
const fileName = fs.readdirSync(root).find((name) => normalize(name).includes('detalhado pro acao 2026') && name.endsWith('.xlsx'));
if (!fileName)
    throw new Error('file not found');
const buffer = fs.readFileSync(path.join(root, fileName));
const parsed = (0, budget_2026_proacao_importer_1.parseBudget2026CoordinatorWorkbook)(buffer);
console.log(JSON.stringify({
    fileName,
    rows: parsed.rows.length,
    errors: parsed.errors.slice(0, 10),
    warnings: parsed.warnings.slice(0, 10),
    summary: parsed.summary,
    sample: parsed.sample.slice(0, 3),
}, null, 2));
//# sourceMappingURL=check-parser-detalhado.js.map