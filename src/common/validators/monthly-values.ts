import { BadRequestException } from '@nestjs/common';
import { MONTH_KEYS } from '../constants';

export type MonthlyValues = Record<string, string>;

export function validateMonthlyValues(values: MonthlyValues, allowNegative: boolean) {
  if (!values || typeof values !== 'object') {
    throw new BadRequestException({
      code: 'MONTHLY_VALUES_INVALID',
      message: 'monthlyValues must be an object with 12 month keys',
    });
  }

  for (const key of MONTH_KEYS) {
    if (!(key in values)) {
      throw new BadRequestException({
        code: 'MONTHLY_VALUES_MISSING',
        message: `monthlyValues missing month ${key}`,
      });
    }
    const raw = values[key];
    if (typeof raw !== 'string') {
      throw new BadRequestException({
        code: 'MONTHLY_VALUES_TYPE',
        message: `monthlyValues.${key} must be a string`,
      });
    }
    if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
      throw new BadRequestException({
        code: 'MONTHLY_VALUES_FORMAT',
        message: `monthlyValues.${key} must be a decimal string with up to 2 decimals`,
      });
    }
    if (!allowNegative && Number(raw) < 0) {
      throw new BadRequestException({
        code: 'MONTHLY_VALUES_NEGATIVE',
        message: `monthlyValues.${key} cannot be negative`,
      });
    }
  }
}
