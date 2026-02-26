export const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'] as const;
export type MonthKey = typeof MONTH_KEYS[number];

export const DEFAULT_PAGE_SIZE = 20;
