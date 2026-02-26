"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePercent = normalizePercent;
const normalize_1 = require("./normalize");
function normalizePercent(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            return null;
        if (value > 1)
            return value / 100;
        return value;
    }
    const raw = String(value).trim();
    if (!raw)
        return null;
    const numeric = (0, normalize_1.parseNumberFlexible)(raw);
    if (numeric === null)
        return null;
    if (raw.includes('%') || numeric > 1)
        return numeric / 100;
    return numeric;
}
//# sourceMappingURL=percent.js.map