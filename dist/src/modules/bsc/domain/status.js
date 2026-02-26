"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStatus = computeStatus;
function computeStatus(target, actual, direction = 'HIGHER_IS_BETTER') {
    if (target === null || actual === null) {
        return { attainment: null, status: 'NO_DATA' };
    }
    if (direction === 'HIGHER_IS_BETTER' && target === 0) {
        return { attainment: null, status: 'NO_DATA' };
    }
    if (direction === 'LOWER_IS_BETTER' && actual === 0) {
        return { attainment: null, status: 'NO_DATA' };
    }
    const attainment = direction === 'LOWER_IS_BETTER' ? target / actual : actual / target;
    if (attainment >= 1)
        return { attainment, status: 'GREEN' };
    if (attainment >= 0.9)
        return { attainment, status: 'YELLOW' };
    return { attainment, status: 'RED' };
}
//# sourceMappingURL=status.js.map