"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logImportInfo = logImportInfo;
exports.pushWarning = pushWarning;
function logImportInfo(section, payload) {
    console.info(`[BSC][${section}]`, payload);
}
function pushWarning(warnings, warning) {
    warnings.push(warning);
}
//# sourceMappingURL=logger.js.map