"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferWbsLevel = inferWbsLevel;
exports.inferParentWbs = inferParentWbs;
function inferWbsLevel(wbs) {
    if (!wbs)
        return null;
    const normalized = String(wbs).trim();
    if (!normalized)
        return null;
    return normalized.split('.').length;
}
function inferParentWbs(wbs) {
    if (!wbs)
        return null;
    const parts = String(wbs).trim().split('.');
    if (parts.length <= 1)
        return null;
    return parts.slice(0, -1).join('.');
}
//# sourceMappingURL=wbs.js.map