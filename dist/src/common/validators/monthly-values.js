"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMonthlyValues = validateMonthlyValues;
const common_1 = require("@nestjs/common");
const constants_1 = require("../constants");
function validateMonthlyValues(values, allowNegative) {
    if (!values || typeof values !== 'object') {
        throw new common_1.BadRequestException({
            code: 'MONTHLY_VALUES_INVALID',
            message: 'monthlyValues must be an object with 12 month keys',
        });
    }
    for (const key of constants_1.MONTH_KEYS) {
        if (!(key in values)) {
            throw new common_1.BadRequestException({
                code: 'MONTHLY_VALUES_MISSING',
                message: `monthlyValues missing month ${key}`,
            });
        }
        const raw = values[key];
        if (typeof raw !== 'string') {
            throw new common_1.BadRequestException({
                code: 'MONTHLY_VALUES_TYPE',
                message: `monthlyValues.${key} must be a string`,
            });
        }
        if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
            throw new common_1.BadRequestException({
                code: 'MONTHLY_VALUES_FORMAT',
                message: `monthlyValues.${key} must be a decimal string with up to 2 decimals`,
            });
        }
        if (!allowNegative && Number(raw) < 0) {
            throw new common_1.BadRequestException({
                code: 'MONTHLY_VALUES_NEGATIVE',
                message: `monthlyValues.${key} cannot be negative`,
            });
        }
    }
}
//# sourceMappingURL=monthly-values.js.map