import {
  Account,
  AccountPlan,
  Budget,
  BudgetImport,
  BudgetLine,
  BudgetScenarioImportResult,
  AccountBudgetDetails,
  CostCenter,
  SponsorAccountRow,
  Scenario,
  SummaryItem,
  User,
  PlanningGridResponse,
  PlanningProacao,
  UserAssignmentsResponse,
  PlanningSummaryResponse,
} from '@/lib/types';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BudgetLineFilters {
  scenarioId?: string;
  costCenterId?: string;
  accountId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateBudgetLineInput {
  scenarioId: string;
  costCenterId: string;
  accountId: string;
  description: string;
  driverType: BudgetLine['driverType'];
  driverValue?: unknown;
  assumptions?: string;
  monthlyValues: Record<string, string>;
  currency?: string;
}

export interface BulkUpsertInput {
  scenarioId: string;
  items: Array<{
    costCenterCode: string;
    accountCode: string;
    description: string;
    driverType: BudgetLine['driverType'];
    driverValue?: unknown;
    assumptions?: string;
    monthlyValues: Record<string, string>;
  }>;
}

export interface ImportResult {
  scenarioId: string;
  totalRows: number;
  results: Array<{ line: number; status: string; id?: string; error?: string; details?: unknown }>;
}

export interface AccountPlanListResponse {
  items: AccountPlan[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface DreTreeResponse {
  budgetId: string;
  year: number;
  months: string[];
  closingMonth?: number;
  mode?: string;
  grandTotals?: {
    previstoByMonth: Record<string, number>;
    realizadoByMonth: Record<string, number>;
    projetadoByMonth: Record<string, number>;
    previstoTotal: number;
    realizadoTotal: number;
    projetadoTotal: number;
  };
  rows: Array<{
    id: string;
    codigo?: string | null;
    descricao: string;
    nivel: number;
    parentId?: string | null;
    valoresPorMes: Record<string, { previsto: number; realizado: number; projetado?: number }>;
  }>;
}

export interface DreExerciseRowResponse {
  id: string;
  codigo?: string | null;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  pathId?: string | null;
  parentPathId?: string | null;
  previousValue: number;
  currentValue: number;
  deltaValue: number;
  deltaPct: number | null;
}

export interface DreExerciseAccumulatedResponse {
  year: number;
  compareYear: number;
  lastClosedMonth: number;
  cutoffMonth: number;
  totals: {
    previousValue: number;
    currentValue: number;
    deltaValue: number;
    deltaPct: number | null;
  };
  rows: DreExerciseRowResponse[];
}

export interface DreExerciseMonthlyResponse {
  year: number;
  compareYear: number;
  lastClosedMonth: number;
  month: number;
  totals: {
    previousValue: number;
    currentValue: number;
    deltaValue: number;
    deltaPct: number | null;
  };
  rows: DreExerciseRowResponse[];
}

export interface Budget2026ImportPreviewRow {
  rowNumber: number;
  coordinator: string;
  ctaProAcao: string;
  accountLabel: string;
  setor: string;
  detailLabel: string | null;
  scenario: string;
  months: Array<{ month: number; value: number }>;
  totalProvided: number | null;
  accountPathId: string;
  parentPathId: string | null;
}

export interface Budget2026ImportPreviewResponse {
  year: number;
  fileName: string;
  source: string;
  summary: {
    totalRows: number;
    coordinators: number;
    newParentAccounts: number;
    newChildAccounts: number;
    monthlyEntries: number;
  };
  sample: Budget2026ImportPreviewRow[];
  newAccounts: Array<{ pathId: string; parentPathId: string | null; label: string; level: number }>;
  warnings: Array<{ rowNumber: number; message: string }>;
  errors: Array<{ rowNumber: number; message: string }>;
}

export interface Budget2026ImportCommitResponse {
  ok: boolean;
  source: string;
  fileName: string;
  warnings: Array<{ rowNumber: number; message: string }>;
  summary: {
    coordinatorsProcessed: number;
    scenariosProcessed: number;
    createdAccounts: number;
    createdEntries: number;
    updatedEntries: number;
    totalEntries: number;
  };
}

export interface PlanningAuditIssue {
  id: string;
  type: 'ACCOUNT_MONTH_MISMATCH' | 'MISSING_DRE_ROW' | 'PARENT_ROLLUP_MISMATCH';
  severity: 'high' | 'medium';
  message: string;
  accountId?: string;
  accountCode?: string;
  accountLabel?: string;
  month?: number;
  planningValue?: number;
  dreValue?: number;
  delta?: number;
  canEdit: boolean;
}

export interface PlanningAuditResponse {
  year: number;
  proacaoId: string;
  userId: string | null;
  generatedAt: string;
  summary: {
    totalIssues: number;
    high: number;
    medium: number;
    editable: number;
  };
  issues: PlanningAuditIssue[];
}

export interface DreAuditIssue {
  id: string;
  type:
    | 'MISSING_NODE'
    | 'EXTRA_NODE'
    | 'LABEL_MISMATCH'
    | 'CODE_MISMATCH'
    | 'PARENT_MISMATCH'
    | 'LEVEL_MISMATCH'
    | 'SORT_MISMATCH'
    | 'MONTH_VALUE_MISMATCH'
    | 'ROLLUP_MISMATCH';
  severity: 'high' | 'medium';
  nodeId?: string;
  codigo?: string | null;
  descricao?: string;
  month?: number;
  expected?: number | string | null;
  actual?: number | string | null;
  delta?: number;
  message: string;
}

export interface DreAuditResponse {
  year: number;
  budgetId: string;
  budgetName: string;
  source: string;
  generatedAt: string;
  summary: {
    totalIssues: number;
    high: number;
    medium: number;
    byType: Record<string, number>;
  };
  issues: DreAuditIssue[];
}

export interface DreAuditFixResponse {
  year: number;
  budgetId: string;
  updatedRows: number;
  updatedCells: number;
  audit: DreAuditResponse;
}

export interface BscImportResponse {
  importId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'ERROR';
  reused?: boolean;
  warningsCount: number;
  counters: Record<string, number>;
}

export interface BscPerspectiveMap {
  id: string;
  name: 'FINANCEIRO' | 'CLIENTE' | 'PROCESSOS' | 'APRENDIZADO_CRESCIMENTO';
  orderIndex: number;
  objectives: Array<{
    id: string;
    name: string;
    slug: string;
    indicators: Array<{
      id: string;
      code: string;
      name: string;
      responsible: string | null;
      dataOwner: string | null;
      process: string | null;
      keywords: string | null;
      level: number | null;
      direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
      yearTargets: Array<{ year: number; targetValue: number | null; rawValue: string | null }>;
    }>;
  }>;
}

export interface BscManagementRow {
  indicatorId: string;
  code: string;
  name: string;
  perspective: string;
  objective: string;
  responsible: string | null;
  dataOwner: string | null;
  level: number | null;
  process: string | null;
  keywords: string | null;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  months: Array<{
    month: number;
    target: number | null;
    actual: number | null;
    variance: number | null;
    attainment: number | null;
    status: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA' | 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADOS';
  }>;
}

export interface BscProject {
  id: string;
  name: string;
  snapshotDate: string;
  _count?: { tasks: number };
}

export interface BscTaskNode {
  id: string;
  wbs: string | null;
  name: string;
  percentComplete: number | null;
  assignee: string | null;
  bucket: string | null;
  level: number | null;
  children: BscTaskNode[];
}

export const backend = {
  me: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) => apiFetch<User>('/me'),
  updateMe: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: { name?: string; username?: string }) =>
    apiFetch<User>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changeMyPassword: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    data: { currentPassword: string; newPassword: string },
  ) => apiFetch('/me/password', { method: 'PATCH', body: JSON.stringify(data) }),
  listAdminUsers: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, page = 1, pageSize = 20) =>
    apiFetch<Paginated<User>>(`/admin/users?page=${page}&pageSize=${pageSize}`),
  createAdminUser: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: Partial<User> & { password?: string }) =>
    apiFetch<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminUser: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: Partial<User>) =>
    apiFetch<User>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetAdminUserPassword: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, newPassword?: string) =>
    apiFetch(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  getAdminUserAssignments: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<UserAssignmentsResponse>(`/admin/users/${id}/accounts`),
  syncAdminUserAssignments: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, accountIds: string[]) =>
    apiFetch(`/admin/users/${id}/accounts`, { method: 'POST', body: JSON.stringify({ accountIds }) }),
  listScenarios: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) => apiFetch<Scenario[]>('/scenarios'),
  createScenario: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: { name: string; year: number }) =>
    apiFetch<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
  updateScenarioStatus: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, action: string) =>
    apiFetch<Scenario>(`/scenarios/${id}/${action}`, { method: 'POST' }),
  listAccounts: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) => apiFetch<Account[]>('/accounts'),
  createAccount: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: Partial<Account>) =>
    apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  listAccountPlans: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    params: { search?: string; tipo?: string; parentId?: string; nivel?: number; tree?: boolean; page?: number; pageSize?: number },
  ) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.tipo) searchParams.set('tipo', params.tipo);
    if (params.parentId) searchParams.set('parentId', params.parentId);
    if (params.nivel !== undefined) searchParams.set('nivel', String(params.nivel));
    if (params.tree) searchParams.set('tree', 'true');
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    return apiFetch<AccountPlanListResponse>(`/contas?${searchParams.toString()}`);
  },
  importAccountPlans: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ total: number; inserted: number; updated: number; errors: Array<{ line: number; message: string }> }>(
      '/contas/import',
      { method: 'POST', body: formData },
    );
  },
  updateAccountPlan: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: Partial<AccountPlan>) =>
    apiFetch<AccountPlan>(`/contas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivateAccountPlan: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<AccountPlan>(`/contas/${id}`, { method: 'DELETE' }),
  listCostCenters: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) => apiFetch<CostCenter[]>('/cost-centers'),
  createCostCenter: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: Partial<CostCenter>) =>
    apiFetch<CostCenter>('/cost-centers', { method: 'POST', body: JSON.stringify(data) }),
  updateCostCenter: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: Partial<CostCenter>) =>
    apiFetch<CostCenter>(`/cost-centers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setCostCenterOwner: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, ownerCoordinatorId: string | null) =>
    apiFetch<CostCenter>(`/cost-centers/${id}/owner`, { method: 'PUT', body: JSON.stringify({ ownerCoordinatorId }) }),
  listBudgetLines: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, filters: BudgetLineFilters) => {
    const params = new URLSearchParams();
    if (filters.scenarioId) params.set('scenarioId', filters.scenarioId);
    if (filters.costCenterId) params.set('costCenterId', filters.costCenterId);
    if (filters.accountId) params.set('accountId', filters.accountId);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    return apiFetch<Paginated<BudgetLine>>(`/budget-lines?${params.toString()}`);
  },
  createBudgetLine: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: CreateBudgetLineInput) =>
    apiFetch<BudgetLine>('/budget-lines', { method: 'POST', body: JSON.stringify(data) }),
  updateBudgetLine: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: Partial<CreateBudgetLineInput>) =>
    apiFetch<BudgetLine>(`/budget-lines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudgetLine: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<BudgetLine>(`/budget-lines/${id}`, { method: 'DELETE' }),
  bulkUpsert: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: BulkUpsertInput) =>
    apiFetch('/budget-lines/bulk-upsert', { method: 'POST', body: JSON.stringify(data) }),
  summary: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, scenarioId: string, groupBy: string) =>
    apiFetch<{ items: SummaryItem[] }>(`/budget-lines/summary?scenarioId=${scenarioId}&groupBy=${groupBy}`),
  importBudgetLines: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<ImportResult>('/imports/budget-lines', { method: 'POST', body: formData });
  },
  importBudgetScenario: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    files: File[],
    scenarioId?: string,
  ) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (scenarioId) {
      formData.append('scenarioId', scenarioId);
    }
    return apiFetch<BudgetScenarioImportResult>('/imports/budget-scenario', { method: 'POST', body: formData });
  },
  getBudgetScenarioSnapshot: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, scenarioId: string) =>
    apiFetch<BudgetScenarioImportResult>(`/imports/budget-scenario/latest?scenarioId=${scenarioId}`),
  listBudgets: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) => apiFetch<Budget[]>('/budgets'),
  createBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: Partial<Budget>) =>
    apiFetch<Budget>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
  updateBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: Partial<Budget>) =>
    apiFetch<Budget>(`/budgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch(`/budgets/${id}`, { method: 'DELETE' }),
  duplicateBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<Budget>(`/budgets/${id}/duplicate`, { method: 'POST' }),
  setActiveBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch(`/budgets/${id}/set-active`, { method: 'POST' }),
  importBudget: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ ok: boolean; version: number }>(`/budgets/${id}/import`, { method: 'POST', body: formData });
  },
  listBudgetImports: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<BudgetImport[]>(`/budgets/${id}/imports`),
  getDreTree: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    budgetId: string,
    mode?: 'BUDGET' | 'ACTUAL' | 'PROJECTED' | 'DRE',
    actualBudgetId?: string | null,
  ) => {
    const params = new URLSearchParams({ budgetId });
    if (mode) params.set('mode', mode);
    if (actualBudgetId) params.set('actualBudgetId', actualBudgetId);
    return apiFetch<DreTreeResponse>(`/dre/tree?${params.toString()}`);
  },
  getDreExerciseAccumulated: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    year: number,
    cutoffMonth?: number,
  ) => {
    const params = new URLSearchParams({ year: String(year) });
    if (cutoffMonth) params.set('cutoffMonth', String(cutoffMonth));
    return apiFetch<DreExerciseAccumulatedResponse>(`/dre/exercicio-acumulado?${params.toString()}`);
  },
  getDreExerciseMonthly: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    year: number,
    month?: number,
  ) => {
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set('month', String(month));
    return apiFetch<DreExerciseMonthlyResponse>(`/dre/exercicio-mensal?${params.toString()}`);
  },
  getDreAudit: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    year = 2026,
    budgetId?: string,
  ) => {
    const params = new URLSearchParams({ year: String(year) });
    if (budgetId) params.set('budgetId', budgetId);
    return apiFetch<DreAuditResponse>(`/dre/audit?${params.toString()}`);
  },
  autoFixDreAudit: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    payload?: { year?: number; budgetId?: string },
  ) =>
    apiFetch<DreAuditFixResponse>('/dre/audit/fix', {
      method: 'POST',
      body: JSON.stringify(payload ?? { year: 2026 }),
    }),
  previewBudget2026CoordinatorImport: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<Budget2026ImportPreviewResponse>('/imports/budget-2026/preview', {
      method: 'POST',
      body: formData,
    });
  },
  commitBudget2026CoordinatorImport: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<Budget2026ImportCommitResponse>('/imports/budget-2026/commit', {
      method: 'POST',
      body: formData,
    });
  },
  getClosingMonth: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, year: number, kind = 'ACTUAL') =>
    apiFetch<{ year: number; closingMonth: number }>(`/closing-month?year=${year}&kind=${kind}`),
  setClosingMonth: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, year: number, closingMonth: number, kind = 'ACTUAL') =>
    apiFetch(`/closing-month`, { method: 'PATCH', body: JSON.stringify({ year, closingMonth, kind }) }),
  getMySponsoredAccounts: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, budgetId: string) =>
    apiFetch<{ budgetId: string; rows: SponsorAccountRow[] }>(`/sponsors/my-accounts?budgetId=${budgetId}`),
  getAccountBudgetDetails: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    accountCode: string,
    budgetId: string,
    costCenterId?: string | null,
  ) => {
    const params = new URLSearchParams({ budgetId });
    if (costCenterId) params.set('costCenterId', costCenterId);
    return apiFetch<AccountBudgetDetails>(`/accounts/${accountCode}/budget-details?${params.toString()}`);
  },
  createBudgetItem: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: any) =>
    apiFetch('/budget-items', { method: 'POST', body: JSON.stringify(data) }),
  updateBudgetItem: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: any) =>
    apiFetch(`/budget-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBudgetItem: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch(`/budget-items/${id}`, { method: 'DELETE' }),
  updateBudgetItemValues: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    id: string,
    values: Array<{ month: number; value: number }>,
  ) => apiFetch(`/budget-items/${id}/values`, { method: 'PUT', body: JSON.stringify({ values }) }),
  applyBudgetItemValue: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, value: number) =>
    apiFetch(`/budget-items/${id}/apply-value`, { method: 'POST', body: JSON.stringify({ value, months: 'ALL' }) }),
  copyBudgetItemMonth: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    id: string,
    fromMonth: number,
    toMonths?: number[],
  ) =>
    apiFetch(`/budget-items/${id}/copy-from-month`, {
      method: 'POST',
      body: JSON.stringify({ fromMonth, months: toMonths ? undefined : 'ALL', monthList: toMonths }),
    }),
  distributeBudgetItemTotal: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    id: string,
    annualTotal: number,
  ) => apiFetch(`/budget-items/${id}/distribute-total`, { method: 'POST', body: JSON.stringify({ annualTotal, strategy: 'EQUAL' }) }),
  listAdminSponsors: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, query?: string) =>
    apiFetch(`/admin/sponsors${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  createAdminSponsor: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, data: any) =>
    apiFetch('/admin/sponsors', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminSponsor: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string, data: any) =>
    apiFetch(`/admin/sponsors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAdminSponsor: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch(`/admin/sponsors/${id}`, { method: 'DELETE' }),
  importAdminSponsors: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/admin/sponsors/import', { method: 'POST', body: formData });
  },
  listPlanningProacoes: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, userId?: string) => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    return apiFetch<PlanningProacao[]>(`/planning/proacoes${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getPlanningGrid: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    proacaoId: string,
    year: number,
    userId?: string,
  ) => {
    const params = new URLSearchParams({ proacaoId, year: String(year) });
    if (userId) params.set('userId', userId);
    return apiFetch<PlanningGridResponse>(`/planning/grid?${params.toString()}`);
  },
  listPlanningYears: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, userId?: string) => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    return apiFetch<number[]>(`/planning/years${params.toString() ? `?${params.toString()}` : ''}`);
  },
  updatePlanningValue: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    data: { accountId: string; year: number; month: number; value: number },
  ) => apiFetch('/planning/value', { method: 'PATCH', body: JSON.stringify(data) }),
  finalizePlanning: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    data: { proacaoId: string; year: number; userId?: string },
  ) => apiFetch('/planning/finalize', { method: 'POST', body: JSON.stringify(data) }),
  getPlanningSummary: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    proacaoId: string,
    year: number,
    userId?: string,
  ) => {
    const params = new URLSearchParams({ proacaoId, year: String(year) });
    if (userId) params.set('userId', userId);
    return apiFetch<PlanningSummaryResponse>(`/planning/summary?${params.toString()}`);
  },
  getPlanningAudit: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    proacaoId: string,
    year: number,
    userId?: string,
  ) => {
    const params = new URLSearchParams({ proacaoId, year: String(year) });
    if (userId) params.set('userId', userId);
    return apiFetch<PlanningAuditResponse>(`/planning/audit?${params.toString()}`);
  },
  importPlanningXlsx: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/planning/import', { method: 'POST', body: formData });
  },
  importBscXlsx: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<BscImportResponse>('/bsc/import?force=1', { method: 'POST', body: formData });
  },
  listBscImports: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) =>
    apiFetch<any[]>('/bsc/imports'),
  getBscImport: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, id: string) =>
    apiFetch<any>(`/bsc/imports/${id}`),
  getBscMap: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) =>
    apiFetch<{ perspectives: BscPerspectiveMap[] }>('/bsc/map'),
  getBscIndicators: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    params?: {
      perspective?: string;
      objective?: string;
      responsible?: string;
      dataOwner?: string;
      process?: string;
      level?: number;
      keyword?: string;
      search?: string;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.perspective) query.set('perspective', params.perspective);
    if (params?.objective) query.set('objective', params.objective);
    if (params?.responsible) query.set('responsible', params.responsible);
    if (params?.dataOwner) query.set('dataOwner', params.dataOwner);
    if (params?.process) query.set('process', params.process);
    if (params?.level != null) query.set('level', String(params.level));
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.search) query.set('search', params.search);
    return apiFetch<any[]>(`/bsc/indicators${query.toString() ? `?${query.toString()}` : ''}`);
  },
  getBscIndicator: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, code: string) =>
    apiFetch<any>(`/bsc/indicators/${encodeURIComponent(code)}`),
  setBscIndicatorMonthActual: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    code: string,
    payload: { year: number; month: number; actualValue: number | null },
  ) =>
    apiFetch<any>(`/bsc/indicators/${encodeURIComponent(code)}/month-actual`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  setBscIndicatorMonthTarget: (
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>,
    code: string,
    payload: { year: number; month: number; targetValue: number | null },
  ) =>
    apiFetch<any>(`/bsc/indicators/${encodeURIComponent(code)}/month-target`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getBscManagement: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, year = 2025) =>
    apiFetch<{ year: number; rows: BscManagementRow[] }>(`/bsc/management?year=${year}`),
  getBscManagementSummary: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, year = 2025) =>
    apiFetch<any>(`/bsc/management/summary?year=${year}`),
  getBscProjectSnapshots: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) =>
    apiFetch<string[]>('/bsc/projects/snapshots'),
  getBscProjects: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, snapshot?: string) =>
    apiFetch<BscProject[]>(`/bsc/projects${snapshot ? `?snapshot=${encodeURIComponent(snapshot)}` : ''}`),
  getBscProjectTasks: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, projectId: string) =>
    apiFetch<{ taskTree: BscTaskNode[]; name: string }>(`/bsc/projects/${projectId}/tasks`),
  getBscTaskSnapshots: (apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>, taskId: string) =>
    apiFetch<Array<{ snapshotDate: string; percentComplete: number | null }>>(`/bsc/tasks/${taskId}/snapshots`),
};
