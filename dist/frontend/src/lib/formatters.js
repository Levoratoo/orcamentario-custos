"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthKeys = void 0;
exports.formatCurrencyBRL = formatCurrencyBRL;
exports.parseDecimal = parseDecimal;
exports.sumMonthlyValues = sumMonthlyValues;
exports.normalizeMonthly = normalizeMonthly;
exports.monthKeys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
function formatCurrencyBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function parseDecimal(value) {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}
function sumMonthlyValues(values) {
    return exports.monthKeys.reduce((sum, key) => sum + parseDecimal(values[key] ?? '0'), 0);
}
function normalizeMonthly(values) {
    const next = {};
    exports.monthKeys.forEach((key) => {
        next[key] = values?.[key] ?? '0.00';
    });
    return next;
}
//# sourceMappingURL=formatters.js.map