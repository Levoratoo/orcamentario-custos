export interface ImportWarningLog {
  sheetName: string;
  rowIndex: number;
  message: string;
  type?: string;
}

export function logImportInfo(section: string, payload: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.info(`[BSC][${section}]`, payload);
}

export function pushWarning(
  warnings: ImportWarningLog[],
  warning: ImportWarningLog,
) {
  warnings.push(warning);
}

