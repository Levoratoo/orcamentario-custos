import type {
  Account,
  AccountBudgetDetails,
  AccountPlan,
  ApiError,
  Budget,
  BudgetItem,
  BudgetLine,
  BudgetScenarioImportResult,
  CostCenter,
  PlanningAccountRef,
  PlanningGridResponse,
  PlanningProacao,
  PlanningSummaryResponse,
  Role,
  Scenario,
  SponsorAccountRow,
  User,
  UserAssignmentsResponse,
} from '@/lib/types';
import { getDreRaw } from '@/services/dre/get-dre';
import { normalizeDre } from '@/services/dre/normalize-dre';
import type {
  AccountPlanListResponse,
  BscManagementRow,
  DreAuditResponse,
  DreExerciseAccumulatedResponse,
  DreExerciseMonthlyResponse,
  DreExerciseRowResponse,
  DreTreeResponse,
  Paginated,
  PlanningAuditIssue,
  PlanningAuditResponse,
} from '@/services/backend';

const API_LATENCY_MS = 220;
const TOKEN_STORAGE_KEY = 'nexora:demo:token';
const USER_STORAGE_KEY = 'nexora:demo:user';
const LOGGED_OUT_STORAGE_KEY = 'nexora:demo:logged-out';
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MONTHS_2D = MONTHS.map((month) => String(month).padStart(2, '0'));

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type BscDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
type BscStatus = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA' | 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_DADOS';

interface DemoPlanningAccount {
  id: string;
  code: string;
  label: string;
  name: string;
  proacaoId: string;
  ownerUserId: string;
  orderIndex: number;
  valuesByYear: Record<number, Record<number, number>>;
  lockedByYear: Record<number, Record<number, boolean>>;
}

interface DemoBudgetItemRecord extends BudgetItem {
  budgetId: string;
  accountCode: string;
  costCenterId?: string | null;
}

interface DemoSponsorLink {
  id: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string | null;
  sponsorDisplay: string;
}

interface DemoBscIndicator {
  id: string;
  code: string;
  name: string;
  perspective: 'FINANCEIRO' | 'CLIENTE' | 'PROCESSOS' | 'APRENDIZADO_CRESCIMENTO';
  objective: string;
  responsible: string | null;
  dataOwner: string | null;
  process: string | null;
  keywords: string | null;
  level: number | null;
  direction: BscDirection;
  yearTargets: Array<{ year: number; targetValue: number | null; rawValue: string | null }>;
  monthlyByYear: Record<
    number,
    Array<{
      month: number;
      target: number | null;
      actual: number | null;
    }>
  >;
  actionPlans: Array<{
    id: string;
    fact: string;
    cause: string;
    action: string;
    owner: string;
    dueDate: string;
  }>;
}

interface DemoBscProject {
  id: string;
  name: string;
  snapshotDate: string;
  tasks: Array<{
    id: string;
    wbs: string | null;
    name: string;
    percentComplete: number | null;
    assignee: string | null;
    bucket: string | null;
    level: number | null;
    children: any[];
  }>;
}

interface DemoState {
  users: User[];
  scenarios: Scenario[];
  budgets: Budget[];
  accounts: Account[];
  accountPlans: AccountPlan[];
  costCenters: CostCenter[];
  budgetLines: BudgetLine[];
  budgetItems: DemoBudgetItemRecord[];
  sponsorLinks: DemoSponsorLink[];
  planningProacoes: PlanningProacao[];
  planningAccounts: DemoPlanningAccount[];
  userAssignments: Record<string, string[]>;
  closingMonthByYear: Record<number, number>;
  bscIndicators: DemoBscIndicator[];
  bscSnapshots: string[];
  bscProjects: DemoBscProject[];
}

type DemoAuthResponse = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: User | null;
};

const now = () => new Date().toISOString();

const readStorage = (key: string) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
};

const writeStorage = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;
  if (value == null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const wait = async () => new Promise((resolve) => setTimeout(resolve, API_LATENCY_MS));

const toMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

const sumValues = (monthlyValues: Record<number, number>) =>
  MONTHS.reduce((sum, month) => sum + Number(monthlyValues[month] ?? 0), 0);

const normalizeLabel = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const rowComparisonKey = (row: { codigo?: string | null; descricao: string }) =>
  row.codigo?.trim() || normalizeLabel(row.descricao);

const buildToken = (userId: string) => `demo-token:${userId}`;

const parseTokenUserId = (token?: string | null) => {
  if (!token || !token.startsWith('demo-token:')) return null;
  return token.slice('demo-token:'.length);
};

const buildMonthlyValues = (base: number, seasonal = 0.04) => {
  const values: Record<string, string> = {};
  MONTHS_2D.forEach((monthKey, index) => {
    const month = index + 1;
    const factor = 1 + Math.sin((month / 12) * Math.PI * 2) * seasonal;
    values[monthKey] = (base * factor).toFixed(2);
  });
  return values;
};

const buildItemMonthValues = (base: number) => {
  const values: Record<number, number> = {};
  MONTHS.forEach((month) => {
    const factor = 1 + Math.sin((month / 12) * Math.PI * 2) * 0.05;
    values[month] = Number((base * factor).toFixed(2));
  });
  return values;
};

const buildPlanningSeries = (base: number, increment: number) =>
  Object.fromEntries(MONTHS.map((month) => [month, Number((base + month * increment).toFixed(2))]));

const buildMonthlyBscSeries = (baseTarget: number, baseActual: number, targetStep: number, actualStep: number) =>
  MONTHS.map((month) => ({
    month,
    target: Number((baseTarget + month * targetStep).toFixed(2)),
    actual: Number((baseActual + month * actualStep).toFixed(2)),
  }));

const computeBscStatus = (
  direction: BscDirection,
  target: number | null,
  actual: number | null,
): BscStatus => {
  if (target == null || actual == null) return 'SEM_DADOS';
  if (direction === 'HIGHER_IS_BETTER') {
    if (actual >= target) return 'VERDE';
    if (actual >= target * 0.9) return 'AMARELO';
    return 'VERMELHO';
  }
  if (actual <= target) return 'VERDE';
  if (actual <= target * 1.1) return 'AMARELO';
  return 'VERMELHO';
};

const parseJsonBody = (init?: RequestInit) => {
  const body = init?.body;
  if (!body || typeof body !== 'string') return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const toApiError = (code: string, message: string, details?: unknown): ApiError => ({ code, message, details });

const throwApiError = (code: string, message: string, details?: unknown): never => {
  throw toApiError(code, message, details);
};

const paginate = <T>(items: T[], page: number, pageSize: number): Paginated<T> => {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  };
};

const createInitialState = (): DemoState => {
  const createdAt = now();
  const users: User[] = [
    { id: 'user-admin', name: 'Admin Portfolio', username: 'admin', email: 'admin@nexora.local', role: 'ADMIN', mustChangePassword: false, active: true, createdAt, updatedAt: createdAt },
    { id: 'user-controller', name: 'Controller Portfolio', username: 'controller', email: 'controller@nexora.local', role: 'CONTROLLER', mustChangePassword: false, active: true, createdAt, updatedAt: createdAt },
    { id: 'user-coord-ana', name: 'Ana Costa', username: 'ana.costa', email: 'ana.costa@nexora.local', role: 'COORDINATOR', mustChangePassword: false, active: true, createdAt, updatedAt: createdAt },
    { id: 'user-coord-joao', name: 'Joao Lima', username: 'joao.lima', email: 'joao.lima@nexora.local', role: 'COORDINATOR', mustChangePassword: false, active: true, createdAt, updatedAt: createdAt },
  ];

  const scenarios: Scenario[] = [
    { id: 'scenario-2026', name: 'Cenario Base 2026', year: 2026, status: 'APPROVED', createdById: 'user-controller', createdAt, updatedAt: createdAt, submittedAt: createdAt, approvedAt: createdAt, lockedAt: null },
    { id: 'scenario-2025', name: 'Cenario Base 2025', year: 2025, status: 'LOCKED', createdById: 'user-controller', createdAt, updatedAt: createdAt, submittedAt: createdAt, approvedAt: createdAt, lockedAt: createdAt },
  ];

  const budgets: Budget[] = [
    { id: 'budget-2024-orcado', name: 'Orcado 2024', year: 2024, kind: 'BUDGET', status: 'READY', isActive: false, fileName: 'orcado-2024.xlsx', notes: 'Mock portfolio', version: 1, createdAt, updatedAt: createdAt, errorMessage: null },
    { id: 'budget-2024-realizado', name: 'Realizado 2024', year: 2024, kind: 'ACTUAL', status: 'READY', isActive: false, fileName: 'realizado-2024.xlsx', notes: 'Mock portfolio', version: 1, createdAt, updatedAt: createdAt, errorMessage: null },
    { id: 'budget-2025-orcado', name: 'Orcado 2025', year: 2025, kind: 'BUDGET', status: 'READY', isActive: false, fileName: 'orcado-2025.xlsx', notes: 'Mock portfolio', version: 2, createdAt, updatedAt: createdAt, errorMessage: null },
    { id: 'budget-2025-realizado', name: 'Realizado 2025', year: 2025, kind: 'ACTUAL', status: 'READY', isActive: false, fileName: 'realizado-2025.xlsx', notes: 'Mock portfolio', version: 2, createdAt, updatedAt: createdAt, errorMessage: null },
    { id: 'budget-2026-orcado', name: 'Orcado 2026', year: 2026, kind: 'BUDGET', status: 'READY', isActive: true, fileName: 'orcado-2026.xlsx', notes: 'Mock portfolio', version: 3, createdAt, updatedAt: createdAt, errorMessage: null },
    { id: 'budget-2026-realizado', name: 'Realizado 2026', year: 2026, kind: 'ACTUAL', status: 'READY', isActive: false, fileName: 'realizado-2026.xlsx', notes: 'Mock portfolio', version: 3, createdAt, updatedAt: createdAt, errorMessage: null },
  ];

  const accounts: Account[] = [
    { id: 'account-5747', code: '5747', name: 'Impressao Personalizada sob Encomenda', category: 'Receita', active: true, createdAt, updatedAt: createdAt },
    { id: 'account-5782', code: '5782', name: 'Sacolas e outros impressos', category: 'Receita', active: true, createdAt, updatedAt: createdAt },
    { id: 'account-7061', code: '7061', name: 'Sacola Automatica', category: 'Receita', active: true, createdAt, updatedAt: createdAt },
    { id: 'account-8010', code: '8010', name: 'Mao de obra direta', category: 'Custo', active: true, createdAt, updatedAt: createdAt },
    { id: 'account-8500', code: '8500', name: 'Fretes e Logistica', category: 'Despesa', active: true, createdAt, updatedAt: createdAt },
    { id: 'account-9030', code: '9030', name: 'Marketing de Performance', category: 'Despesa', active: true, createdAt, updatedAt: createdAt },
  ];

  const accountPlans: AccountPlan[] = [
    { id: 'plan-1', code: '1', type: 'T', classification: '1', description: 'Receita Bruta', level: 0, parentId: null, isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-11', code: '1.1', type: 'T', classification: '1.1', description: 'Receita sobre servicos', level: 1, parentId: 'plan-1', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-5747', code: '5747', type: 'A', classification: '1.1.5747', description: 'Impressao Personalizada sob Encomenda', level: 2, parentId: 'plan-11', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-5782', code: '5782', type: 'A', classification: '1.1.5782', description: 'Sacolas e outros impressos', level: 2, parentId: 'plan-11', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-2', code: '2', type: 'T', classification: '2', description: 'Custos e Despesas', level: 0, parentId: null, isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-21', code: '2.1', type: 'T', classification: '2.1', description: 'Custos industriais', level: 1, parentId: 'plan-2', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-8010', code: '8010', type: 'A', classification: '2.1.8010', description: 'Mao de obra direta', level: 2, parentId: 'plan-21', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-22', code: '2.2', type: 'T', classification: '2.2', description: 'Despesas operacionais', level: 1, parentId: 'plan-2', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-8500', code: '8500', type: 'A', classification: '2.2.8500', description: 'Fretes e Logistica', level: 2, parentId: 'plan-22', isAtiva: true, createdAt, updatedAt: createdAt },
    { id: 'plan-9030', code: '9030', type: 'A', classification: '2.2.9030', description: 'Marketing de Performance', level: 2, parentId: 'plan-22', isAtiva: true, createdAt, updatedAt: createdAt },
  ];

  const costCenters: CostCenter[] = [
    { id: 'cc-comercial', code: 'CC-COM', name: 'Comercial', active: true, ownerCoordinatorId: 'user-coord-ana', createdAt, updatedAt: createdAt },
    { id: 'cc-operacoes', code: 'CC-OPE', name: 'Operacoes', active: true, ownerCoordinatorId: 'user-coord-joao', createdAt, updatedAt: createdAt },
    { id: 'cc-marketing', code: 'CC-MKT', name: 'Marketing', active: true, ownerCoordinatorId: 'user-coord-ana', createdAt, updatedAt: createdAt },
  ];

  const budgetLines: BudgetLine[] = [
    {
      id: 'line-1',
      scenarioId: 'scenario-2026',
      costCenterId: 'cc-comercial',
      accountId: 'account-5747',
      description: 'Receita sob encomenda - carteira ativa',
      driverType: 'CONSUMPTION',
      driverValue: null,
      assumptions: 'Base historica + crescimento de carteira',
      monthlyValues: buildMonthlyValues(185000),
      currency: 'BRL',
      createdById: 'user-controller',
      updatedById: 'user-controller',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'line-2',
      scenarioId: 'scenario-2026',
      costCenterId: 'cc-operacoes',
      accountId: 'account-8010',
      description: 'Mao de obra direta',
      driverType: 'HEADCOUNT',
      driverValue: { headcount: 42 },
      assumptions: 'Reajuste anual de 7%',
      monthlyValues: buildMonthlyValues(86000, 0.02),
      currency: 'BRL',
      createdById: 'user-controller',
      updatedById: 'user-controller',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'line-3',
      scenarioId: 'scenario-2026',
      costCenterId: 'cc-marketing',
      accountId: 'account-9030',
      description: 'Campanhas digitais',
      driverType: 'OTHER',
      driverValue: null,
      assumptions: 'Plano trimestral',
      monthlyValues: buildMonthlyValues(34000, 0.15),
      currency: 'BRL',
      createdById: 'user-controller',
      updatedById: 'user-controller',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const budgetItems: DemoBudgetItemRecord[] = [
    { id: 'item-1', budgetId: 'budget-2026-orcado', accountCode: '5747', costCenterId: 'cc-comercial', itemName: 'Clientes chave', isActive: true, isReimbursement: false, comment: 'Top 10 contas', monthValues: buildItemMonthValues(92000), total: 0 },
    { id: 'item-2', budgetId: 'budget-2026-orcado', accountCode: '5747', costCenterId: 'cc-comercial', itemName: 'Novos contratos', isActive: true, isReimbursement: false, comment: null, monthValues: buildItemMonthValues(56000), total: 0 },
    { id: 'item-3', budgetId: 'budget-2026-orcado', accountCode: '8500', costCenterId: 'cc-operacoes', itemName: 'Frete rodoviario', isActive: true, isReimbursement: false, comment: null, monthValues: buildItemMonthValues(18000), total: 0 },
    { id: 'item-4', budgetId: 'budget-2026-orcado', accountCode: '9030', costCenterId: 'cc-marketing', itemName: 'Midia paga', isActive: true, isReimbursement: false, comment: 'Canal principal', monthValues: buildItemMonthValues(14000), total: 0 },
  ].map((item) => ({ ...item, total: Number(sumValues(item.monthValues).toFixed(2)) }));

  const sponsorLinks: DemoSponsorLink[] = [
    { id: 'sponsor-1', accountCode: '5747', accountName: 'Impressao Personalizada sob Encomenda', costCenterId: 'cc-comercial', sponsorDisplay: 'Ana Costa' },
    { id: 'sponsor-2', accountCode: '8500', accountName: 'Fretes e Logistica', costCenterId: 'cc-operacoes', sponsorDisplay: 'Joao Lima' },
    { id: 'sponsor-3', accountCode: '9030', accountName: 'Marketing de Performance', costCenterId: 'cc-marketing', sponsorDisplay: 'Ana Costa' },
  ];

  const planningProacoes: PlanningProacao[] = [
    { id: 'pro-comercial', name: 'Comercial' },
    { id: 'pro-operacoes', name: 'Operacoes' },
    { id: 'pro-marketing', name: 'Marketing' },
  ];

  const planningAccounts: DemoPlanningAccount[] = [
    { id: 'pa-1', code: 'PA-COM-001', label: 'Receita carteira ativa', name: 'Receita carteira ativa', proacaoId: 'pro-comercial', ownerUserId: 'user-coord-ana', orderIndex: 1, valuesByYear: { 2025: buildPlanningSeries(98000, 2200), 2026: buildPlanningSeries(112000, 2500) }, lockedByYear: { 2026: Object.fromEntries(MONTHS.map((month) => [month, month <= 2])) } },
    { id: 'pa-2', code: 'PA-COM-002', label: 'Novos contratos', name: 'Novos contratos', proacaoId: 'pro-comercial', ownerUserId: 'user-coord-ana', orderIndex: 2, valuesByYear: { 2025: buildPlanningSeries(42000, 1300), 2026: buildPlanningSeries(53000, 1500) }, lockedByYear: { 2026: Object.fromEntries(MONTHS.map((month) => [month, month <= 2])) } },
    { id: 'pa-3', code: 'PA-OPE-001', label: 'Mao de obra direta', name: 'Mao de obra direta', proacaoId: 'pro-operacoes', ownerUserId: 'user-coord-joao', orderIndex: 1, valuesByYear: { 2025: buildPlanningSeries(70000, 900), 2026: buildPlanningSeries(77000, 1000) }, lockedByYear: { 2026: Object.fromEntries(MONTHS.map((month) => [month, month <= 2])) } },
    { id: 'pa-4', code: 'PA-OPE-002', label: 'Fretes e logistica', name: 'Fretes e logistica', proacaoId: 'pro-operacoes', ownerUserId: 'user-coord-joao', orderIndex: 2, valuesByYear: { 2025: buildPlanningSeries(35000, 500), 2026: buildPlanningSeries(39000, 650) }, lockedByYear: { 2026: Object.fromEntries(MONTHS.map((month) => [month, month <= 2])) } },
    { id: 'pa-5', code: 'PA-MKT-001', label: 'Midia paga', name: 'Midia paga', proacaoId: 'pro-marketing', ownerUserId: 'user-coord-ana', orderIndex: 1, valuesByYear: { 2025: buildPlanningSeries(22000, 400), 2026: buildPlanningSeries(26000, 450) }, lockedByYear: { 2026: Object.fromEntries(MONTHS.map((month) => [month, month <= 2])) } },
  ];

  const userAssignments: Record<string, string[]> = {
    'user-coord-ana': ['pa-1', 'pa-2', 'pa-5'],
    'user-coord-joao': ['pa-3', 'pa-4'],
  };

  const bscIndicators: DemoBscIndicator[] = [
    {
      id: 'bsc-1',
      code: 'FIN-01',
      name: 'Receita Recorrente',
      perspective: 'FINANCEIRO',
      objective: 'Aumentar receita previsivel',
      responsible: 'Ana Costa',
      dataOwner: 'Controller Office',
      process: 'Vendas',
      keywords: 'receita,recorrencia,comercial',
      level: 1,
      direction: 'HIGHER_IS_BETTER',
      yearTargets: [{ year: 2025, targetValue: 92, rawValue: null }, { year: 2026, targetValue: 98, rawValue: null }],
      monthlyByYear: { 2025: buildMonthlyBscSeries(7.5, 7.2, 0.08, 0.07), 2026: buildMonthlyBscSeries(8, 7.9, 0.09, 0.085) },
      actionPlans: [{ id: 'plan-fin-1', fact: 'Oscilacao da carteira em Q1', cause: 'Menor conversao inbound', action: 'Revisar funil e playbook comercial', owner: 'Ana Costa', dueDate: '2026-05-15' }],
    },
    {
      id: 'bsc-2',
      code: 'CLI-01',
      name: 'NPS',
      perspective: 'CLIENTE',
      objective: 'Elevar satisfacao de clientes',
      responsible: 'Joao Lima',
      dataOwner: 'CX Squad',
      process: 'Atendimento',
      keywords: 'nps,satisfacao,cliente',
      level: 1,
      direction: 'HIGHER_IS_BETTER',
      yearTargets: [{ year: 2025, targetValue: 70, rawValue: null }, { year: 2026, targetValue: 74, rawValue: null }],
      monthlyByYear: { 2025: buildMonthlyBscSeries(68, 67, 0.3, 0.28), 2026: buildMonthlyBscSeries(70, 69, 0.33, 0.31) },
      actionPlans: [],
    },
    {
      id: 'bsc-3',
      code: 'PROC-02',
      name: 'Indice de Refugo',
      perspective: 'PROCESSOS',
      objective: 'Reduzir perdas de processo',
      responsible: 'Controller Portfolio',
      dataOwner: 'Qualidade',
      process: 'Qualidade',
      keywords: 'refugo,qualidade,perda',
      level: 2,
      direction: 'LOWER_IS_BETTER',
      yearTargets: [{ year: 2025, targetValue: 3.1, rawValue: null }, { year: 2026, targetValue: 2.8, rawValue: null }],
      monthlyByYear: { 2025: buildMonthlyBscSeries(3.3, 3.7, -0.03, -0.02), 2026: buildMonthlyBscSeries(3.1, 3.4, -0.028, -0.025) },
      actionPlans: [],
    },
    {
      id: 'bsc-4',
      code: 'APR-01',
      name: 'Horas de Treinamento',
      perspective: 'APRENDIZADO_CRESCIMENTO',
      objective: 'Capacitar equipe critica',
      responsible: 'Ana Costa',
      dataOwner: 'RH',
      process: 'Gente e Gestao',
      keywords: 'treinamento,capacitacao,pessoas',
      level: 1,
      direction: 'HIGHER_IS_BETTER',
      yearTargets: [{ year: 2025, targetValue: 320, rawValue: null }, { year: 2026, targetValue: 360, rawValue: null }],
      monthlyByYear: { 2025: buildMonthlyBscSeries(24, 22, 0.9, 0.8), 2026: buildMonthlyBscSeries(26, 24, 1, 0.92) },
      actionPlans: [],
    },
  ];

  const bscSnapshots = ['2026-03-01', '2026-02-01', '2026-01-01'];
  const bscProjects: DemoBscProject[] = [
    {
      id: 'project-1',
      name: 'Programa Comercial 2026',
      snapshotDate: '2026-03-01',
      tasks: [
        {
          id: 'task-1',
          wbs: '1',
          name: 'Reestruturar funil digital',
          percentComplete: 0.64,
          assignee: 'Ana Costa',
          bucket: 'Execucao',
          level: 0,
          children: [
            { id: 'task-1-1', wbs: '1.1', name: 'Landing pages por segmento', percentComplete: 0.8, assignee: 'Ana Costa', bucket: 'Execucao', level: 1, children: [] },
            { id: 'task-1-2', wbs: '1.2', name: 'Automacao de nutricao', percentComplete: 0.5, assignee: 'Joao Lima', bucket: 'Execucao', level: 1, children: [] },
          ],
        },
      ],
    },
    {
      id: 'project-2',
      name: 'Eficiência Operacional 2026',
      snapshotDate: '2026-03-01',
      tasks: [
        {
          id: 'task-2',
          wbs: '1',
          name: 'Plano de reducao de refugo',
          percentComplete: 0.52,
          assignee: 'Joao Lima',
          bucket: 'Execucao',
          level: 0,
          children: [
            { id: 'task-2-1', wbs: '1.1', name: 'Padronizacao de setup', percentComplete: 0.68, assignee: 'Joao Lima', bucket: 'Execucao', level: 1, children: [] },
          ],
        },
      ],
    },
  ];

  return {
    users,
    scenarios,
    budgets,
    accounts,
    accountPlans,
    costCenters,
    budgetLines,
    budgetItems,
    sponsorLinks,
    planningProacoes,
    planningAccounts,
    userAssignments,
    closingMonthByYear: { 2024: 12, 2025: 12, 2026: 8 },
    bscIndicators,
    bscSnapshots,
    bscProjects,
  };
};

const state = createInitialState();
const dreTreeCache = new Map<string, DreTreeResponse>();

const buildSyntheticRealized = (plannedValue: number, rowId: string, month: number, year: number) => {
  if (!Number.isFinite(plannedValue) || Math.abs(plannedValue) < 0.0001) return 0;
  const hash = Array.from(rowId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const seasonal = Math.sin(((month + (hash % 6)) / 12) * Math.PI * 2) * 0.035;
  const profile = ((hash % 11) - 5) * 0.004;
  const yearDrift = (year - 2025) * 0.005;
  const factor = 0.93 + seasonal + profile + yearDrift;
  return Number((plannedValue * factor).toFixed(2));
};

const ensureTotals = () => {
  state.budgetItems = state.budgetItems.map((item) => ({
    ...item,
    total: Number(sumValues(item.monthValues).toFixed(2)),
  }));
};

const getDemoUser = (fallbackRole: Role = 'ADMIN'): User => {
  const user = state.users.find((item) => item.role === fallbackRole && item.active) ?? state.users.find((item) => item.active);
  if (!user) {
    throwApiError('NO_ACTIVE_USER', 'Nenhum usuario ativo no mock.');
  }
  return user!;
};

const resolveUserByToken = (accessToken?: string | null) => {
  const userId = parseTokenUserId(accessToken);
  if (!userId) return null;
  const user = state.users.find((item) => item.id === userId && item.active);
  return user ?? null;
};

const withCurrentUser = (accessToken?: string | null): User => {
  const user = resolveUserByToken(accessToken);
  if (!user) {
    throwApiError('UNAUTHORIZED', 'Sessao expirada no modo demo.');
  }
  return user!;
};

const getDreTreeForYear = (year: number): DreTreeResponse => {
  const closingMonth = state.closingMonthByYear[year] ?? 12;
  const cacheKey = `${year}:${closingMonth}`;
  const cached = dreTreeCache.get(cacheKey);
  if (cached) return deepClone(cached);

  const source = getDreRaw(year) ?? getDreRaw(2026) ?? getDreRaw(2025);
  if (!source) {
    const empty: DreTreeResponse = {
      budgetId: '',
      year,
      months: MONTHS.map((month) => toMonthKey(year, month)),
      rows: [],
      closingMonth,
      mode: 'DRE',
      grandTotals: {
        previstoByMonth: {},
        realizadoByMonth: {},
        projetadoByMonth: {},
        previstoTotal: 0,
        realizadoTotal: 0,
        projetadoTotal: 0,
      },
    };
    dreTreeCache.set(cacheKey, empty);
    return deepClone(empty);
  }

  const sourceYear = source.year;
  const normalized = normalizeDre(source, sourceYear, 'previsto');
  const monthRemap = new Map<string, string>(
    normalized.months.map((monthKey) => [monthKey, `${year}-${monthKey.split('-')[1]}`]),
  );
  const months = normalized.months.map((monthKey) => monthRemap.get(monthKey) ?? monthKey);

  const rows = normalized.rows.map((row) => {
    const values = Object.fromEntries(
      normalized.months.map((sourceMonthKey) => {
        const targetMonthKey = monthRemap.get(sourceMonthKey) ?? sourceMonthKey;
        const month = Number(targetMonthKey.split('-')[1] ?? 0);
        const sourceValue = row.valoresPorMes[sourceMonthKey] ?? { previsto: 0, realizado: 0 };
        const plannedValue = Number(sourceValue.previsto ?? 0);
        const rawRealizedValue = Number(sourceValue.realizado ?? 0);
        const realizedSeed = Math.abs(rawRealizedValue) > 0 ? rawRealizedValue : plannedValue;
        const realizedValue =
          year === 2026 ? buildSyntheticRealized(realizedSeed, row.id, Math.max(1, month), year) : rawRealizedValue;
        const variationValue = Number((plannedValue - realizedValue).toFixed(2));
        return [
          targetMonthKey,
          {
            previsto: plannedValue,
            realizado: realizedValue,
            // Keep "projetado" key in the contract, but carry variation (Orcado - Realizado).
            projetado: variationValue,
          },
        ];
      }),
    );

    return {
      id: row.id,
      codigo: row.codigo ?? null,
      descricao: row.descricao,
      nivel: row.nivel,
      parentId: row.parentId ?? null,
      valoresPorMes: values,
    };
  });

  const rootRows = rows.filter((row) => !row.parentId);
  const previstoByMonth: Record<string, number> = {};
  const realizadoByMonth: Record<string, number> = {};
  const projetadoByMonth: Record<string, number> = {};
  let previstoTotal = 0;
  let realizadoTotal = 0;
  let projetadoTotal = 0;

  months.forEach((monthKey) => {
    const previsto = rootRows.reduce((sum, row) => sum + Number(row.valoresPorMes[monthKey]?.previsto ?? 0), 0);
    const realizado = rootRows.reduce((sum, row) => sum + Number(row.valoresPorMes[monthKey]?.realizado ?? 0), 0);
    const projetado = rootRows.reduce((sum, row) => sum + Number(row.valoresPorMes[monthKey]?.projetado ?? 0), 0);
    previstoByMonth[monthKey] = Number(previsto.toFixed(2));
    realizadoByMonth[monthKey] = Number(realizado.toFixed(2));
    projetadoByMonth[monthKey] = Number(projetado.toFixed(2));
    previstoTotal += previsto;
    realizadoTotal += realizado;
    projetadoTotal += projetado;
  });

  const result: DreTreeResponse = {
    budgetId: '',
    year,
    months,
    rows,
    closingMonth,
    mode: 'DRE',
    grandTotals: {
      previstoByMonth,
      realizadoByMonth,
      projetadoByMonth,
      previstoTotal: Number(previstoTotal.toFixed(2)),
      realizadoTotal: Number(realizadoTotal.toFixed(2)),
      projetadoTotal: Number(projetadoTotal.toFixed(2)),
    },
  };

  dreTreeCache.set(cacheKey, result);
  return deepClone(result);
};

const rebuildDreCache = () => {
  dreTreeCache.clear();
};

const getTreeRowValue = (
  row: DreTreeResponse['rows'][number] | undefined,
  year: number,
  month: number,
  accumulated: boolean,
) => {
  if (!row) return 0;
  if (!accumulated) {
    return Number(row.valoresPorMes[toMonthKey(year, month)]?.realizado ?? 0);
  }
  let total = 0;
  for (let cursor = 1; cursor <= month; cursor += 1) {
    total += Number(row.valoresPorMes[toMonthKey(year, cursor)]?.realizado ?? 0);
  }
  return Number(total.toFixed(2));
};

const buildExerciseRows = (
  year: number,
  compareYear: number,
  cutoffMonth: number,
  accumulated: boolean,
) => {
  const currentRows = getDreTreeForYear(year).rows;
  const previousRows = getDreTreeForYear(compareYear).rows;

  const previousByKey = new Map(previousRows.map((row) => [rowComparisonKey(row), row] as const));
  const usedPrevious = new Set<string>();
  const idCount = new Map<string, number>();
  const currentIdMap = new Map<string, string>();

  const nextUniqueId = (baseId: string) => {
    const count = idCount.get(baseId) ?? 0;
    idCount.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}__${count}`;
  };

  currentRows.forEach((row) => {
    currentIdMap.set(row.id, nextUniqueId(`current:${row.id}`));
  });

  const merged: DreExerciseRowResponse[] = currentRows.map((row) => {
    const key = rowComparisonKey(row);
    const previous = previousByKey.get(key);
    if (previous) usedPrevious.add(key);

    const currentValue = getTreeRowValue(row, year, cutoffMonth, accumulated);
    const previousValue = getTreeRowValue(previous, compareYear, cutoffMonth, accumulated);
    const deltaValue = Number((currentValue - previousValue).toFixed(2));
    const deltaPct = previousValue !== 0 ? deltaValue / previousValue : null;

    return {
      id: currentIdMap.get(row.id)!,
      codigo: row.codigo ?? null,
      descricao: row.descricao,
      nivel: row.nivel,
      parentId: row.parentId ? currentIdMap.get(row.parentId) ?? null : null,
      pathId: row.id,
      parentPathId: row.parentId ?? null,
      previousValue,
      currentValue,
      deltaValue,
      deltaPct: deltaPct == null ? null : Number(deltaPct.toFixed(4)),
    };
  });

  previousRows.forEach((row) => {
    const key = rowComparisonKey(row);
    if (usedPrevious.has(key)) return;
    usedPrevious.add(key);
    const previousValue = getTreeRowValue(row, compareYear, cutoffMonth, accumulated);
    merged.push({
      id: nextUniqueId(`previous-only:${row.id}`),
      codigo: row.codigo ?? null,
      descricao: row.descricao,
      nivel: row.nivel,
      parentId: null,
      pathId: row.id,
      parentPathId: row.parentId ?? null,
      previousValue,
      currentValue: 0,
      deltaValue: Number((-previousValue).toFixed(2)),
      deltaPct: previousValue !== 0 ? -1 : null,
    });
  });

  return merged;
};

const buildBscIndicatorPayload = (indicator: DemoBscIndicator) => {
  const objective = {
    id: `obj-${normalizeLabel(indicator.objective).replace(/\s+/g, '-').toLowerCase()}`,
    name: indicator.objective,
    perspective: {
      id: `perspective-${indicator.perspective.toLowerCase()}`,
      name: indicator.perspective,
    },
  };

  const monthly = Object.entries(indicator.monthlyByYear).flatMap(([yearLabel, values]) => {
    const year = Number(yearLabel);
    return values.map((value) => {
      const variance =
        value.target == null || value.actual == null ? null : Number((value.actual - value.target).toFixed(2));
      return {
        year,
        month: value.month,
        target: value.target,
        actual: value.actual,
        variance,
        status: computeBscStatus(indicator.direction, value.target, value.actual),
      };
    });
  });

  return {
    id: indicator.id,
    code: indicator.code,
    name: indicator.name,
    responsible: indicator.responsible,
    dataOwner: indicator.dataOwner,
    process: indicator.process,
    keywords: indicator.keywords,
    level: indicator.level,
    direction: indicator.direction,
    objective,
    yearTargets: deepClone(indicator.yearTargets),
    monthly,
    actionPlans: deepClone(indicator.actionPlans),
  };
};

const buildBscMonthlyRow = (indicator: DemoBscIndicator, year: number) => {
  const monthlyValues = indicator.monthlyByYear[year] ?? [];
  return monthlyValues.map((monthItem) => {
    const target = monthItem.target;
    const actual = monthItem.actual;
    const variance = target == null || actual == null ? null : Number((actual - target).toFixed(2));
    const attainment = target == null || target === 0 || actual == null ? null : Number((actual / target).toFixed(4));
    const status = computeBscStatus(indicator.direction, target, actual);
    return {
      month: monthItem.month,
      target,
      actual,
      variance,
      attainment,
      status,
    };
  });
};

const buildBscManagementRows = (year: number): BscManagementRow[] => {
  return state.bscIndicators.map((indicator) => ({
    indicatorId: indicator.id,
    code: indicator.code,
    name: indicator.name,
    perspective: indicator.perspective,
    objective: indicator.objective,
    responsible: indicator.responsible,
    dataOwner: indicator.dataOwner,
    level: indicator.level,
    process: indicator.process,
    keywords: indicator.keywords,
    direction: indicator.direction,
    months: buildBscMonthlyRow(indicator, year),
  }));
};

const buildBscManagementSummary = (year: number) => {
  const rows = buildBscManagementRows(year);
  const grouped = new Map<string, { perspective: string; objective: string; verde: number; amarelo: number; vermelho: number; semDados: number }>();
  rows.forEach((row) => {
    const key = `${row.perspective}::${row.objective}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        perspective: row.perspective,
        objective: row.objective,
        verde: 0,
        amarelo: 0,
        vermelho: 0,
        semDados: 0,
      });
    }
    const item = grouped.get(key)!;
    const last = [...row.months].reverse().find((month) => month.target != null || month.actual != null);
    const status = String(last?.status ?? '').toUpperCase();
    if (status === 'GREEN' || status === 'VERDE') item.verde += 1;
    else if (status === 'YELLOW' || status === 'AMARELO') item.amarelo += 1;
    else if (status === 'RED' || status === 'VERMELHO') item.vermelho += 1;
    else item.semDados += 1;
  });
  return {
    year,
    grouped: Array.from(grouped.values()),
  };
};

const findPlanningAccountsForUser = (userId?: string) => {
  if (!userId) return state.planningAccounts;
  const assigned = state.userAssignments[userId] ?? [];
  if (assigned.length > 0) {
    return state.planningAccounts.filter((account) => assigned.includes(account.id));
  }
  return state.planningAccounts.filter((account) => account.ownerUserId === userId);
};

const buildPlanningSummary = (
  accounts: DemoPlanningAccount[],
  year: number,
  proacaoId: string,
): PlanningSummaryResponse => {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const byMonth = MONTHS.map((month) =>
    accounts.reduce((sum, account) => sum + Number(account.valuesByYear[year]?.[month] ?? 0), 0),
  );
  const total = byMonth.reduce((sum, value) => sum + value, 0);
  const previousYear = year - 1;
  const byMonthPrevious = MONTHS.map((month) =>
    accounts.reduce((sum, account) => sum + Number(account.valuesByYear[previousYear]?.[month] ?? 0), 0),
  );

  const orcMaximo = Number((total * 1.08).toFixed(2));
  const orcLancado = Number(total.toFixed(2));

  return {
    year,
    proacaoId,
    kpis: {
      receitaLiquidaProjetada: Number((total * 1.18).toFixed(2)),
      txVerbaAno: orcMaximo > 0 ? Number((orcLancado / orcMaximo).toFixed(4)) : null,
      orcMaximo,
      orcLancado,
      excedeuMaximo: orcLancado > orcMaximo,
    },
    chart: {
      labels,
      series: {
        orcadoAnoAtual: byMonth.map((value) => Number(value.toFixed(2))),
        realizadoAnoAnt: byMonthPrevious.map((value) => Number((value * 0.96).toFixed(2))),
        realizadoAnoAtual: byMonth.map((value) => Number((value * 0.93).toFixed(2))),
        orcadoAnoAnt: byMonthPrevious.map((value) => Number(value.toFixed(2))),
        cenario: byMonth.map((value) => Number((value * 1.04).toFixed(2))),
      },
    },
  };
};

const buildPlanningAudit = (
  accounts: DemoPlanningAccount[],
  year: number,
  proacaoId: string,
  userId?: string,
): PlanningAuditResponse => {
  const issues: PlanningAuditIssue[] = [];
  accounts.forEach((account) => {
    MONTHS.forEach((month) => {
      const planningValue = Number(account.valuesByYear[year]?.[month] ?? 0);
      const dreValue = Number((planningValue * (0.9 + month * 0.004)).toFixed(2));
      const delta = Number((planningValue - dreValue).toFixed(2));
      if (Math.abs(delta) < 800) return;
      issues.push({
        id: `${account.id}-${year}-${month}`,
        type: 'ACCOUNT_MONTH_MISMATCH',
        severity: Math.abs(delta) > 5000 ? 'high' : 'medium',
        message: `Divergencia no mes ${month} para ${account.label}.`,
        accountId: account.id,
        accountCode: account.code,
        accountLabel: account.label,
        month,
        planningValue,
        dreValue,
        delta,
        canEdit: true,
      });
    });
  });

  const limited = issues.slice(0, 40);
  const high = limited.filter((issue) => issue.severity === 'high').length;
  const medium = limited.length - high;
  const editable = limited.filter((issue) => issue.canEdit).length;
  return {
    year,
    proacaoId,
    userId: userId ?? null,
    generatedAt: now(),
    summary: {
      totalIssues: limited.length,
      high,
      medium,
      editable,
    },
    issues: limited,
  };
};

const parsePageParams = (searchParams: URLSearchParams) => {
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
  };
};

const buildAccountPlanTree = (plans: AccountPlan[]) => {
  const byParent = new Map<string | null, AccountPlan[]>();
  plans.forEach((plan) => {
    const key = plan.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(plan);
    byParent.set(key, list);
  });

  const hydrate = (parentId: string | null): AccountPlan[] => {
    const children = (byParent.get(parentId) ?? []).sort((left, right) =>
      left.classification.localeCompare(right.classification, 'pt-BR'),
    );
    return children.map((item) => ({
      ...item,
      children: hydrate(item.id),
    }));
  };

  return hydrate(null);
};

const getBudgetById = (budgetId: string): Budget => {
  const budget = state.budgets.find((item) => item.id === budgetId);
  if (!budget) {
    throwApiError('NOT_FOUND', 'Orcamento nao encontrado.');
  }
  return budget!;
};

const getCostCenterName = (costCenterId?: string | null) =>
  state.costCenters.find((item) => item.id === costCenterId)?.name ?? null;

const getAccountName = (accountCode: string) =>
  state.accountPlans.find((item) => item.code === accountCode)?.description ?? accountCode;

const getAccountDetails = (
  accountCode: string,
  budgetId: string,
  costCenterId: string | null | undefined,
  currentUser: User,
): AccountBudgetDetails => {
  ensureTotals();
  const budget = getBudgetById(budgetId);
  const accountName = getAccountName(accountCode);
  const items = state.budgetItems.filter(
    (item) =>
      item.budgetId === budgetId &&
      item.accountCode === accountCode &&
      (costCenterId == null ? true : item.costCenterId === costCenterId),
  );

  if (items.length === 0) {
    const newItem: DemoBudgetItemRecord = {
      id: `item-${state.budgetItems.length + 1}`,
      budgetId,
      accountCode,
      costCenterId: costCenterId ?? null,
      itemName: 'Novo item',
      isActive: true,
      isReimbursement: false,
      comment: null,
      monthValues: buildItemMonthValues(0),
      total: 0,
    };
    state.budgetItems.push(newItem);
  }

  ensureTotals();
  const freshItems = state.budgetItems.filter(
    (item) =>
      item.budgetId === budgetId &&
      item.accountCode === accountCode &&
      (costCenterId == null ? true : item.costCenterId === costCenterId),
  );

  const scenarioMonthly = MONTHS.map((month) => ({
    month,
    value: Number(
      freshItems.reduce((sum, item) => sum + Number(item.monthValues[month] ?? 0), 0).toFixed(2),
    ),
  }));
  const actualPrevYearMonthly = scenarioMonthly.map((item) => ({
    month: item.month,
    value: Number((item.value * 0.91).toFixed(2)),
  }));
  const varPctMonthly = scenarioMonthly.map((item, index) => {
    const actual = actualPrevYearMonthly[index]?.value ?? 0;
    const pct = actual !== 0 ? ((item.value - actual) / actual) * 100 : null;
    return { month: item.month, value: pct == null ? null : Number(pct.toFixed(2)) };
  });

  const scenarioTotal = Number(scenarioMonthly.reduce((sum, item) => sum + item.value, 0).toFixed(2));
  const actualPrevYearTotal = Number(actualPrevYearMonthly.reduce((sum, item) => sum + item.value, 0).toFixed(2));
  const varPctTotal =
    actualPrevYearTotal !== 0
      ? Number((((scenarioTotal - actualPrevYearTotal) / actualPrevYearTotal) * 100).toFixed(2))
      : null;

  return {
    budget: { id: budget.id, name: budget.name, year: budget.year },
    account: { code: accountCode, name: accountName },
    costCenter: costCenterId ? { id: costCenterId, name: getCostCenterName(costCenterId) ?? costCenterId } : null,
    permission: {
      canEdit: currentUser.role === 'ADMIN' || currentUser.role === 'CONTROLLER' || currentUser.role === 'COORDINATOR',
      isAdmin: currentUser.role === 'ADMIN',
    },
    items: deepClone(freshItems),
    totals: {
      scenarioTotal,
      scenarioMonthly,
      actualPrevYearTotal,
      actualPrevYearMonthly,
      varPctTotal,
      varPctMonthly,
    },
  };
};

const listSponsoredAccounts = (budgetId: string): { budgetId: string; rows: SponsorAccountRow[] } => {
  const rows = state.sponsorLinks.map((link) => {
    const details = getAccountDetails(link.accountCode, budgetId, link.costCenterId ?? null, getDemoUser());
    const filledItemsCount = details.items.filter((item) => item.total > 0).length;
    const itemsCount = details.items.length;
    const scenarioTotal = details.totals.scenarioTotal;
    const actualPrevYearTotal = details.totals.actualPrevYearTotal;
    const varPct =
      actualPrevYearTotal !== 0
        ? Number((((scenarioTotal - actualPrevYearTotal) / actualPrevYearTotal) * 100).toFixed(2))
        : null;

    const status: SponsorAccountRow['status'] =
      filledItemsCount === 0 ? 'PENDING' : filledItemsCount < itemsCount ? 'IN_PROGRESS' : 'DONE';

    return {
      accountCode: link.accountCode,
      accountName: link.accountName,
      costCenterId: link.costCenterId ?? null,
      costCenterName: getCostCenterName(link.costCenterId) ?? undefined,
      sponsor: { userId: null, display: link.sponsorDisplay },
      actualPrevYearTotal,
      scenarioTotal,
      varPct,
      itemsCount,
      filledItemsCount,
      status,
    };
  });

  return { budgetId, rows };
};

const updateBudgetItemRecord = (id: string, updater: (item: DemoBudgetItemRecord) => DemoBudgetItemRecord) => {
  const index = state.budgetItems.findIndex((item) => item.id === id);
  if (index < 0) {
    throwApiError('NOT_FOUND', 'Item orcamentario nao encontrado.');
  }
  state.budgetItems[index] = updater(state.budgetItems[index]);
  ensureTotals();
  return deepClone(state.budgetItems[index]);
};

const updateBscIndicatorMonth = (
  code: string,
  payload: { year: number; month: number; actualValue?: number | null; targetValue?: number | null },
) => {
  const indicator = state.bscIndicators.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!indicator) throwApiError('NOT_FOUND', 'Indicador BSC nao encontrado.');
  const resolvedIndicator = indicator!;
  const rows = resolvedIndicator.monthlyByYear[payload.year] ?? [];
  if (!resolvedIndicator.monthlyByYear[payload.year]) {
    resolvedIndicator.monthlyByYear[payload.year] = rows;
  }
  let monthRow = rows.find((item) => item.month === payload.month);
  if (!monthRow) {
    monthRow = { month: payload.month, target: null, actual: null };
    rows.push(monthRow);
  }
  if (payload.actualValue !== undefined) {
    monthRow.actual = payload.actualValue;
  }
  if (payload.targetValue !== undefined) {
    monthRow.target = payload.targetValue;
  }
  return buildBscIndicatorPayload(resolvedIndicator);
};

const requestHandler = async <T>(
  path: string,
  init: RequestInit | undefined,
  accessToken: string | null | undefined,
): Promise<T> => {
  await wait();

  const url = new URL(path, 'https://portfolio-demo.local');
  const method = String(init?.method ?? 'GET').toUpperCase() as Method;
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const currentUser = withCurrentUser(accessToken);

  if (url.searchParams.get('demoError') === 'true') {
    throwApiError('DEMO_ERROR', 'Falha simulada para teste de estado de erro.');
  }

  if (pathname === '/me' && method === 'GET') {
    return deepClone(currentUser) as T;
  }

  if (pathname === '/me' && method === 'PATCH') {
    const body = parseJsonBody(init) as { name?: string; username?: string } | null;
    const userIndex = state.users.findIndex((item) => item.id === currentUser.id);
    state.users[userIndex] = {
      ...state.users[userIndex],
      name: body?.name?.trim() || state.users[userIndex].name,
      username: body?.username?.trim() || state.users[userIndex].username,
      updatedAt: now(),
    };
    return deepClone(state.users[userIndex]) as T;
  }

  if (pathname === '/me/password' && method === 'PATCH') {
    return undefined as T;
  }

  if (pathname === '/users' && method === 'GET') {
    return deepClone(state.users) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'users' && segments.length === 2 && method === 'GET') {
    const { page, pageSize } = parsePageParams(url.searchParams);
    return paginate(state.users, page, pageSize) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'users' && segments.length === 2 && method === 'POST') {
    const body = parseJsonBody(init) as Partial<User> & { password?: string };
    const newUser: User = {
      id: `user-${state.users.length + 1}`,
      name: body.name?.trim() || 'Novo usuario',
      username: body.username?.trim() || `usuario.${state.users.length + 1}`,
      email: body.email ?? null,
      role: (body.role as Role) ?? 'COORDINATOR',
      active: body.active ?? true,
      mustChangePassword: body.mustChangePassword ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    state.users.push(newUser);
    return deepClone(newUser) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'users' && segments.length === 3 && method === 'PATCH') {
    const userId = segments[2];
    const body = parseJsonBody(init) as Partial<User>;
    const index = state.users.findIndex((item) => item.id === userId);
    if (index < 0) throwApiError('NOT_FOUND', 'Usuario nao encontrado.');
    state.users[index] = {
      ...state.users[index],
      ...body,
      updatedAt: now(),
    };
    return deepClone(state.users[index]) as T;
  }

  if (
    segments[0] === 'admin' &&
    segments[1] === 'users' &&
    segments.length === 4 &&
    segments[3] === 'reset-password' &&
    method === 'POST'
  ) {
    return { ok: true } as T;
  }

  if (
    segments[0] === 'admin' &&
    segments[1] === 'users' &&
    segments.length === 4 &&
    segments[3] === 'accounts' &&
    method === 'GET'
  ) {
    const userId = segments[2];
    const user = state.users.find((item) => item.id === userId);
    if (!user) throwApiError('NOT_FOUND', 'Usuario nao encontrado.');
    const resolvedUser = user!;
    const assignedAccountIds = state.userAssignments[userId] ?? [];
    const accounts: PlanningAccountRef[] = state.planningAccounts.map((account) => ({
      id: account.id,
      code: account.code,
      label: account.label,
      name: account.name,
      proacao: {
        id: account.proacaoId,
        name: state.planningProacoes.find((proacao) => proacao.id === account.proacaoId)?.name ?? account.proacaoId,
      },
    }));
    const response: UserAssignmentsResponse = {
      user: { id: resolvedUser.id, name: resolvedUser.name, username: resolvedUser.username },
      assignedAccountIds,
      accounts,
    };
    return response as T;
  }

  if (
    segments[0] === 'admin' &&
    segments[1] === 'users' &&
    segments.length === 4 &&
    segments[3] === 'accounts' &&
    method === 'POST'
  ) {
    const userId = segments[2];
    const body = parseJsonBody(init) as { accountIds?: string[] } | null;
    state.userAssignments[userId] = Array.from(new Set(body?.accountIds ?? []));
    return { ok: true, assignedCount: state.userAssignments[userId].length } as T;
  }

  if (pathname === '/scenarios' && method === 'GET') {
    return deepClone(state.scenarios) as T;
  }

  if (pathname === '/scenarios' && method === 'POST') {
    const body = parseJsonBody(init) as { name?: string; year?: number } | null;
    const scenario: Scenario = {
      id: `scenario-${state.scenarios.length + 1}`,
      name: body?.name?.trim() || `Cenario ${state.scenarios.length + 1}`,
      year: Number(body?.year ?? new Date().getFullYear()),
      status: 'DRAFT',
      createdById: currentUser.id,
      createdAt: now(),
      updatedAt: now(),
      submittedAt: null,
      approvedAt: null,
      lockedAt: null,
    };
    state.scenarios.unshift(scenario);
    return deepClone(scenario) as T;
  }

  if (pathname === '/accounts' && method === 'GET') {
    return deepClone(state.accounts) as T;
  }

  if (segments[0] === 'accounts' && segments[2] === 'budget-details' && method === 'GET') {
    const accountCode = decodeURIComponent(segments[1] ?? '');
    const budgetId = url.searchParams.get('budgetId');
    if (!budgetId) throwApiError('BAD_REQUEST', 'budgetId e obrigatorio.');
    const resolvedBudgetId = budgetId!;
    const costCenterId = url.searchParams.get('costCenterId');
    const details = getAccountDetails(accountCode, resolvedBudgetId, costCenterId, currentUser);
    return details as T;
  }

  if (pathname === '/contas' && method === 'GET') {
    const tipo = url.searchParams.get('tipo');
    const tree = url.searchParams.get('tree') === 'true';
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();

    const activePlans = state.accountPlans.filter((plan) => plan.isAtiva);
    let filtered = activePlans;
    if (tipo === 'A' || tipo === 'T') {
      filtered = filtered.filter((plan) => plan.type === tipo);
    }
    if (search) {
      filtered = filtered.filter((plan) => {
        const haystack = `${plan.code} ${plan.classification} ${plan.description}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const items = tree ? buildAccountPlanTree(filtered) : filtered;
    const response: AccountPlanListResponse = {
      items: deepClone(items),
      total: filtered.length,
    };
    return response as T;
  }

  if (pathname === '/contas/import' && method === 'POST') {
    return {
      total: 120,
      inserted: 8,
      updated: 112,
      errors: [],
    } as T;
  }

  if (segments[0] === 'contas' && segments.length === 2 && method === 'PUT') {
    const id = segments[1];
    const body = parseJsonBody(init) as Partial<AccountPlan> | null;
    const index = state.accountPlans.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Conta nao encontrada.');
    state.accountPlans[index] = {
      ...state.accountPlans[index],
      ...body,
      updatedAt: now(),
    };
    return deepClone(state.accountPlans[index]) as T;
  }

  if (segments[0] === 'contas' && segments.length === 2 && method === 'DELETE') {
    const id = segments[1];
    const index = state.accountPlans.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Conta nao encontrada.');
    state.accountPlans[index] = {
      ...state.accountPlans[index],
      isAtiva: false,
      updatedAt: now(),
    };
    return deepClone(state.accountPlans[index]) as T;
  }

  if (pathname === '/cost-centers' && method === 'GET') {
    return deepClone(state.costCenters) as T;
  }

  if (pathname === '/cost-centers' && method === 'POST') {
    const body = parseJsonBody(init) as Partial<CostCenter> | null;
    const center: CostCenter = {
      id: `cc-${state.costCenters.length + 1}`,
      code: body?.code?.trim() || `CC-${state.costCenters.length + 1}`,
      name: body?.name?.trim() || 'Novo centro de custo',
      active: body?.active ?? true,
      ownerCoordinatorId: body?.ownerCoordinatorId ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    state.costCenters.push(center);
    return deepClone(center) as T;
  }

  if (segments[0] === 'cost-centers' && segments.length === 2 && method === 'PUT') {
    const id = segments[1];
    const body = parseJsonBody(init) as Partial<CostCenter> | null;
    const index = state.costCenters.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Centro de custo nao encontrado.');
    state.costCenters[index] = {
      ...state.costCenters[index],
      ...body,
      updatedAt: now(),
    };
    return deepClone(state.costCenters[index]) as T;
  }

  if (segments[0] === 'cost-centers' && segments[2] === 'owner' && method === 'PUT') {
    const id = segments[1];
    const body = parseJsonBody(init) as { ownerCoordinatorId?: string | null } | null;
    const index = state.costCenters.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Centro de custo nao encontrado.');
    state.costCenters[index] = {
      ...state.costCenters[index],
      ownerCoordinatorId: body?.ownerCoordinatorId ?? null,
      updatedAt: now(),
    };
    return deepClone(state.costCenters[index]) as T;
  }

  if (pathname === '/budget-lines' && method === 'GET') {
    const scenarioId = url.searchParams.get('scenarioId');
    const costCenterId = url.searchParams.get('costCenterId');
    const accountId = url.searchParams.get('accountId');
    const { page, pageSize } = parsePageParams(url.searchParams);
    let lines = state.budgetLines;
    if (scenarioId) lines = lines.filter((line) => line.scenarioId === scenarioId);
    if (costCenterId) lines = lines.filter((line) => line.costCenterId === costCenterId);
    if (accountId) lines = lines.filter((line) => line.accountId === accountId);
    return paginate(deepClone(lines), page, pageSize) as T;
  }

  if (pathname === '/budget-lines' && method === 'POST') {
    const body = parseJsonBody(init) as Partial<BudgetLine> | null;
    const line: BudgetLine = {
      id: `line-${state.budgetLines.length + 1}`,
      scenarioId: String(body?.scenarioId ?? 'scenario-2026'),
      costCenterId: String(body?.costCenterId ?? state.costCenters[0]?.id ?? ''),
      accountId: String(body?.accountId ?? state.accounts[0]?.id ?? ''),
      description: String(body?.description ?? 'Nova linha orcamentaria'),
      driverType: (body?.driverType as BudgetLine['driverType']) ?? 'OTHER',
      driverValue: body?.driverValue ?? null,
      monthlyValues: (body?.monthlyValues as Record<string, string>) ?? buildMonthlyValues(0),
      currency: 'BRL',
      assumptions: (body?.assumptions as string | null) ?? null,
      createdById: currentUser.id,
      updatedById: currentUser.id,
      createdAt: now(),
      updatedAt: now(),
    };
    state.budgetLines.push(line);
    return deepClone(line) as T;
  }

  if (segments[0] === 'budget-lines' && segments.length === 2 && method === 'PUT') {
    const id = segments[1];
    const body = parseJsonBody(init) as Partial<BudgetLine> | null;
    const index = state.budgetLines.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Linha de orcamento nao encontrada.');
    state.budgetLines[index] = {
      ...state.budgetLines[index],
      ...body,
      updatedById: currentUser.id,
      updatedAt: now(),
    };
    return deepClone(state.budgetLines[index]) as T;
  }

  if (segments[0] === 'budget-lines' && segments.length === 2 && method === 'DELETE') {
    const id = segments[1];
    state.budgetLines = state.budgetLines.filter((item) => item.id !== id);
    return { ok: true } as T;
  }

  if (pathname === '/imports/budget-lines' && method === 'POST') {
    return {
      scenarioId: 'scenario-2026',
      totalRows: 32,
      results: [
        { line: 1, status: 'OK', id: 'line-import-1' },
        { line: 2, status: 'OK', id: 'line-import-2' },
      ],
    } as T;
  }

  if (pathname === '/imports/budget-scenario' && method === 'POST') {
    const scenarioId = url.searchParams.get('scenarioId') ?? 'scenario-2026';
    const lines = state.budgetLines.filter((line) => line.scenarioId === scenarioId);
    const byMonth = Object.fromEntries(
      MONTHS_2D.map((monthKey) => [
        monthKey,
        Number(lines.reduce((sum, line) => sum + Number(line.monthlyValues[monthKey] ?? '0'), 0).toFixed(2)),
      ]),
    );
    const sectors = state.costCenters.map((costCenter) => {
      const sectorLines = lines.filter((line) => line.costCenterId === costCenter.id);
      const monthlyValues = Object.fromEntries(
        MONTHS_2D.map((monthKey) => [
          monthKey,
          Number(
            sectorLines.reduce((sum, line) => sum + Number(line.monthlyValues[monthKey] ?? '0'), 0).toFixed(2),
          ),
        ]),
      );
      return {
        code: costCenter.code,
        name: costCenter.name,
        monthlyValues,
        total: Number(Object.values(monthlyValues).reduce((sum, value) => sum + value, 0).toFixed(2)),
          accounts: state.accounts.map((account) => ({
            classification: account.code,
            description: account.name,
            type: 'A' as const,
            monthlyValues: Object.fromEntries(MONTHS_2D.map((monthKey) => [monthKey, 0])),
            total: 0,
            level: 2,
          })),
      };
    });
    const response: BudgetScenarioImportResult = {
      year: 2026,
      years: [2025, 2026],
      months: MONTHS_2D,
      totals: {
        byMonth,
        total: Number(Object.values(byMonth).reduce((sum, value) => sum + value, 0).toFixed(2)),
      },
      sectors,
      unmatchedAccounts: [],
      unmatchedSectors: [],
      sourceFiles: ['portfolio-demo.xlsx'],
      totalRows: lines.length,
      accountTree: null,
      errors: [],
    };
    return response as T;
  }

  if (pathname === '/imports/budget-scenario/latest' && method === 'GET') {
    return requestHandler<T>(`/imports/budget-scenario?${url.searchParams.toString()}`, { method: 'POST' }, accessToken);
  }

  if (pathname === '/budgets' && method === 'GET') {
    return deepClone(state.budgets) as T;
  }

  if (segments[0] === 'dre' && segments[1] === 'tree' && method === 'GET') {
    const budgetId = url.searchParams.get('budgetId');
    if (!budgetId) throwApiError('BAD_REQUEST', 'budgetId e obrigatorio.');
    const resolvedBudgetId = budgetId!;
    const budget = getBudgetById(resolvedBudgetId);
    const tree = getDreTreeForYear(budget.year);
    tree.budgetId = resolvedBudgetId;
    return tree as T;
  }

  if (segments[0] === 'dre' && segments[1] === 'exercicio-acumulado' && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    const compareYear = year - 1;
    const cutoffMonth = Number(url.searchParams.get('cutoffMonth') ?? state.closingMonthByYear[year] ?? 12) || 12;
    const rows = buildExerciseRows(year, compareYear, cutoffMonth, true);
    const totals = rows
      .filter((row) => row.parentId == null)
      .reduce(
        (acc, row) => {
          acc.previousValue += row.previousValue;
          acc.currentValue += row.currentValue;
          return acc;
        },
        { previousValue: 0, currentValue: 0 },
      );
    const deltaValue = Number((totals.currentValue - totals.previousValue).toFixed(2));
    const response: DreExerciseAccumulatedResponse = {
      year,
      compareYear,
      lastClosedMonth: state.closingMonthByYear[year] ?? cutoffMonth,
      cutoffMonth,
      totals: {
        previousValue: Number(totals.previousValue.toFixed(2)),
        currentValue: Number(totals.currentValue.toFixed(2)),
        deltaValue,
        deltaPct: totals.previousValue !== 0 ? Number((deltaValue / totals.previousValue).toFixed(4)) : null,
      },
      rows,
    };
    return response as T;
  }

  if (segments[0] === 'dre' && segments[1] === 'exercicio-mensal' && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    const compareYear = year - 1;
    const month = Number(url.searchParams.get('month') ?? state.closingMonthByYear[year] ?? 1) || 1;
    const rows = buildExerciseRows(year, compareYear, month, false);
    const totals = rows
      .filter((row) => row.parentId == null)
      .reduce(
        (acc, row) => {
          acc.previousValue += row.previousValue;
          acc.currentValue += row.currentValue;
          return acc;
        },
        { previousValue: 0, currentValue: 0 },
      );
    const deltaValue = Number((totals.currentValue - totals.previousValue).toFixed(2));
    const response: DreExerciseMonthlyResponse = {
      year,
      compareYear,
      lastClosedMonth: state.closingMonthByYear[year] ?? month,
      month,
      totals: {
        previousValue: Number(totals.previousValue.toFixed(2)),
        currentValue: Number(totals.currentValue.toFixed(2)),
        deltaValue,
        deltaPct: totals.previousValue !== 0 ? Number((deltaValue / totals.previousValue).toFixed(4)) : null,
      },
      rows,
    };
    return response as T;
  }

  if (segments[0] === 'dre' && segments[1] === 'audit' && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    const budgetId = url.searchParams.get('budgetId') ?? state.budgets.find((item) => item.year === year && item.kind === 'BUDGET')?.id;
    if (!budgetId) throwApiError('NOT_FOUND', 'Orcamento nao encontrado para auditoria.');
    const resolvedBudgetId = budgetId!;
    const budget = getBudgetById(resolvedBudgetId);
    const tree = getDreTreeForYear(budget.year);
    const month = state.closingMonthByYear[year] ?? 12;
    const monthKey = toMonthKey(year, month);
    const rows = tree.rows.filter((row) => row.nivel <= 2).slice(0, 24);
    const issues = rows
      .map((row, index) => {
        const expected = Number(row.valoresPorMes[monthKey]?.previsto ?? 0);
        const actual = Number(row.valoresPorMes[monthKey]?.realizado ?? 0);
        const delta = Number((actual - expected).toFixed(2));
        if (Math.abs(delta) < 1000) return null;
        return {
          id: `audit-${row.id}-${index}`,
          type: 'MONTH_VALUE_MISMATCH',
          severity: Math.abs(delta) > 120000 ? 'high' : 'medium',
          nodeId: row.id,
          codigo: row.codigo ?? null,
          descricao: row.descricao,
          month,
          expected,
          actual,
          delta,
          message: `Divergencia de valor no mes ${month} para ${row.descricao}.`,
        };
      })
      .filter(Boolean);

    const typedIssues = issues as DreAuditResponse['issues'];
    const byType: Record<string, number> = {};
    typedIssues.forEach((issue) => {
      byType[issue.type] = (byType[issue.type] ?? 0) + 1;
    });
    const high = typedIssues.filter((issue) => issue.severity === 'high').length;
    const response: DreAuditResponse = {
      year,
      budgetId: resolvedBudgetId,
      budgetName: budget.name,
      source: 'portfolio-demo',
      generatedAt: now(),
      summary: {
        totalIssues: typedIssues.length,
        high,
        medium: typedIssues.length - high,
        byType,
      },
      issues: typedIssues,
    };
    return response as T;
  }

  if (pathname === '/closing-month' && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    return { year, closingMonth: state.closingMonthByYear[year] ?? 12 } as T;
  }

  if (pathname === '/closing-month' && method === 'PATCH') {
    const body = parseJsonBody(init) as { year?: number; closingMonth?: number } | null;
    const year = Number(body?.year ?? 2026);
    state.closingMonthByYear[year] = Number(body?.closingMonth ?? 12);
    rebuildDreCache();
    return { ok: true } as T;
  }

  if (segments[0] === 'sponsors' && segments[1] === 'my-accounts' && method === 'GET') {
    const budgetId = url.searchParams.get('budgetId');
    if (!budgetId) throwApiError('BAD_REQUEST', 'budgetId e obrigatorio.');
    return listSponsoredAccounts(budgetId!) as T;
  }

  if (pathname === '/budget-items' && method === 'POST') {
    const body = parseJsonBody(init) as {
      budgetId?: string;
      accountCode?: string;
      costCenterId?: string | null;
      itemName?: string;
    } | null;
    const newItem: DemoBudgetItemRecord = {
      id: `item-${state.budgetItems.length + 1}`,
      budgetId: String(body?.budgetId ?? 'budget-2026-orcado'),
      accountCode: String(body?.accountCode ?? '5747'),
      costCenterId: body?.costCenterId ?? null,
      itemName: body?.itemName?.trim() || 'Novo item',
      isActive: true,
      isReimbursement: false,
      comment: null,
      monthValues: buildItemMonthValues(0),
      total: 0,
    };
    state.budgetItems.push(newItem);
    ensureTotals();
    return deepClone(newItem) as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 2 && method === 'PATCH') {
    const id = segments[1];
    const body = parseJsonBody(init) as Partial<BudgetItem> | null;
    return updateBudgetItemRecord(id, (item) => ({
      ...item,
      ...body,
      monthValues: body?.monthValues ? { ...item.monthValues, ...body.monthValues } : item.monthValues,
    })) as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 2 && method === 'DELETE') {
    const id = segments[1];
    state.budgetItems = state.budgetItems.filter((item) => item.id !== id);
    return { ok: true } as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 3 && segments[2] === 'values' && method === 'PUT') {
    const id = segments[1];
    const body = parseJsonBody(init) as { values?: Array<{ month: number; value: number }> } | null;
    const updates = body?.values ?? [];
    return updateBudgetItemRecord(id, (item) => {
      const nextValues = { ...item.monthValues };
      updates.forEach((entry) => {
        const month = Number(entry.month);
        if (!Number.isFinite(month) || month < 1 || month > 12) return;
        nextValues[month] = Number(entry.value ?? 0);
      });
      return {
        ...item,
        monthValues: nextValues,
      };
    }) as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 3 && segments[2] === 'apply-value' && method === 'POST') {
    const id = segments[1];
    const body = parseJsonBody(init) as { value?: number; months?: 'ALL' | number[]; monthList?: number[] } | null;
    const inputValue = Number(body?.value ?? 0);
    const monthList = Array.isArray(body?.monthList)
      ? body?.monthList
      : Array.isArray(body?.months)
        ? body?.months
        : MONTHS;
    return updateBudgetItemRecord(id, (item) => {
      const nextValues = { ...item.monthValues };
      monthList.forEach((month) => {
        if (month >= 1 && month <= 12) {
          nextValues[month] = inputValue;
        }
      });
      return {
        ...item,
        monthValues: nextValues,
      };
    }) as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 3 && segments[2] === 'copy-from-month' && method === 'POST') {
    const id = segments[1];
    const body = parseJsonBody(init) as { fromMonth?: number; months?: 'ALL' | number[]; monthList?: number[] } | null;
    const fromMonth = Number(body?.fromMonth ?? 1);
    if (!Number.isFinite(fromMonth) || fromMonth < 1 || fromMonth > 12) {
      throwApiError('BAD_REQUEST', 'Mes de origem invalido.');
    }
    const targetMonths = Array.isArray(body?.monthList)
      ? body.monthList
      : Array.isArray(body?.months)
        ? body.months
        : MONTHS;
    return updateBudgetItemRecord(id, (item) => {
      const sourceValue = Number(item.monthValues[fromMonth] ?? 0);
      const nextValues = { ...item.monthValues };
      targetMonths.forEach((month) => {
        if (month >= 1 && month <= 12) {
          nextValues[month] = sourceValue;
        }
      });
      return {
        ...item,
        monthValues: nextValues,
      };
    }) as T;
  }

  if (segments[0] === 'budget-items' && segments.length === 3 && segments[2] === 'distribute-total' && method === 'POST') {
    const id = segments[1];
    const body = parseJsonBody(init) as { annualTotal?: number } | null;
    const annualTotal = Number(body?.annualTotal ?? 0);
    return updateBudgetItemRecord(id, (item) => {
      const base = Number((annualTotal / 12).toFixed(2));
      const nextValues: Record<number, number> = {};
      MONTHS.forEach((month) => {
        nextValues[month] = base;
      });
      const totalAllocated = Number((base * 12).toFixed(2));
      nextValues[12] = Number((nextValues[12] + (annualTotal - totalAllocated)).toFixed(2));
      return {
        ...item,
        monthValues: nextValues,
      };
    }) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'sponsors' && segments.length === 2 && method === 'GET') {
    const query = (url.searchParams.get('query') ?? '').toLowerCase().trim();
    const items = state.sponsorLinks
      .map((link) => ({
        id: link.id,
        accountCode: link.accountCode,
        costCenterId: link.costCenterId ?? null,
        sponsorDisplay: link.sponsorDisplay,
      }))
      .filter((item) => {
        if (!query) return true;
        return (
          item.accountCode.toLowerCase().includes(query) ||
          (item.costCenterId ?? '').toLowerCase().includes(query) ||
          item.sponsorDisplay.toLowerCase().includes(query)
        );
      });
    return deepClone(items) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'sponsors' && segments.length === 2 && method === 'POST') {
    const body = parseJsonBody(init) as Partial<DemoSponsorLink> | null;
    const entry: DemoSponsorLink = {
      id: `sponsor-${state.sponsorLinks.length + 1}`,
      accountCode: String(body?.accountCode ?? state.accounts[0]?.code ?? '5747'),
      accountName: getAccountName(String(body?.accountCode ?? state.accounts[0]?.code ?? '5747')),
      costCenterId: body?.costCenterId ?? null,
      sponsorDisplay: String(body?.sponsorDisplay ?? 'Novo padrinho'),
    };
    state.sponsorLinks.push(entry);
    return deepClone(entry) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'sponsors' && segments.length === 3 && method === 'PATCH') {
    const id = segments[2];
    const body = parseJsonBody(init) as Partial<DemoSponsorLink> | null;
    const index = state.sponsorLinks.findIndex((item) => item.id === id);
    if (index < 0) throwApiError('NOT_FOUND', 'Padrinho nao encontrado.');
    state.sponsorLinks[index] = {
      ...state.sponsorLinks[index],
      ...body,
      accountName: getAccountName(String(body?.accountCode ?? state.sponsorLinks[index].accountCode)),
    };
    return deepClone(state.sponsorLinks[index]) as T;
  }

  if (segments[0] === 'admin' && segments[1] === 'sponsors' && segments.length === 3 && method === 'DELETE') {
    const id = segments[2];
    state.sponsorLinks = state.sponsorLinks.filter((item) => item.id !== id);
    return { ok: true } as T;
  }

  if (
    segments[0] === 'admin' &&
    segments[1] === 'sponsors' &&
    segments.length === 3 &&
    segments[2] === 'import' &&
    method === 'POST'
  ) {
    return {
      ok: true,
      inserted: 4,
      updated: 9,
      errors: [],
    } as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'proacoes' && method === 'GET') {
    const userId = url.searchParams.get('userId') ?? undefined;
    const allowedAccounts = findPlanningAccountsForUser(userId);
    const proacaoIds = new Set(allowedAccounts.map((account) => account.proacaoId));
    const rows = state.planningProacoes.filter((proacao) => proacaoIds.has(proacao.id));
    return deepClone(rows) as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'years' && method === 'GET') {
    const userId = url.searchParams.get('userId') ?? undefined;
    const allowedAccounts = findPlanningAccountsForUser(userId);
    const years = new Set<number>();
    allowedAccounts.forEach((account) => {
      Object.keys(account.valuesByYear).forEach((year) => years.add(Number(year)));
    });
    return Array.from(years).sort((left, right) => right - left) as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'grid' && method === 'GET') {
    const proacaoId = url.searchParams.get('proacaoId');
    const year = Number(url.searchParams.get('year') ?? '2026');
    if (!proacaoId) throwApiError('BAD_REQUEST', 'proacaoId e obrigatorio.');
    const resolvedProacaoId = proacaoId!;
    const userId = url.searchParams.get('userId') ?? undefined;
    const filtered = findPlanningAccountsForUser(userId)
      .filter((account) => resolvedProacaoId === 'all' || account.proacaoId === resolvedProacaoId)
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const response: PlanningGridResponse = {
      proacao:
        resolvedProacaoId === 'all'
          ? { id: 'all', name: 'Todos' }
          : state.planningProacoes.find((item) => item.id === resolvedProacaoId) ?? { id: resolvedProacaoId, name: resolvedProacaoId },
      year,
      accounts: filtered.map((account) => {
        const values = account.valuesByYear[year] ?? {};
        const total = Number(MONTHS.reduce((sum, month) => sum + Number(values[month] ?? 0), 0).toFixed(2));
        return {
          id: account.id,
          code: account.code,
          label: account.label,
          name: account.name,
          ownerUserId: account.ownerUserId,
          orderIndex: account.orderIndex,
          values: deepClone(values),
          lockedByMonth: deepClone(account.lockedByYear[year] ?? {}),
          total,
        };
      }),
      totals: {
        grandTotal: Number(
          filtered
            .reduce((sum, account) => {
              const values = account.valuesByYear[year] ?? {};
              return sum + MONTHS.reduce((partial, month) => partial + Number(values[month] ?? 0), 0);
            }, 0)
            .toFixed(2),
        ),
      },
    };
    return response as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'value' && method === 'PATCH') {
    const body = parseJsonBody(init) as { accountId?: string; year?: number; month?: number; value?: number } | null;
    const accountId = String(body?.accountId ?? '');
    const year = Number(body?.year ?? 2026);
    const month = Number(body?.month ?? 1);
    const value = Number(body?.value ?? 0);
    const account = state.planningAccounts.find((item) => item.id === accountId);
    if (!account) throwApiError('NOT_FOUND', 'Conta de planejamento nao encontrada.');
    const resolvedAccount = account!;
    if (!resolvedAccount.valuesByYear[year]) {
      resolvedAccount.valuesByYear[year] = {};
    }
    resolvedAccount.valuesByYear[year][month] = value;
    return {
      ok: true,
      accountId,
      year,
      month,
      value,
    } as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'finalize' && method === 'POST') {
    const body = parseJsonBody(init) as { proacaoId?: string; year?: number; userId?: string } | null;
    const proacaoId = String(body?.proacaoId ?? 'all');
    const year = Number(body?.year ?? 2026);
    const userId = body?.userId;
    const filtered = findPlanningAccountsForUser(userId).filter(
      (account) => proacaoId === 'all' || account.proacaoId === proacaoId,
    );
    filtered.forEach((account) => {
      if (!account.lockedByYear[year]) {
        account.lockedByYear[year] = {};
      }
      MONTHS.forEach((month) => {
        account.lockedByYear[year][month] = true;
      });
    });
    return { ok: true, lockedAccounts: filtered.length } as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'summary' && method === 'GET') {
    const proacaoId = url.searchParams.get('proacaoId');
    const year = Number(url.searchParams.get('year') ?? '2026');
    if (!proacaoId) throwApiError('BAD_REQUEST', 'proacaoId e obrigatorio.');
    const resolvedProacaoId = proacaoId!;
    const userId = url.searchParams.get('userId') ?? undefined;
    const filtered = findPlanningAccountsForUser(userId).filter(
      (account) => resolvedProacaoId === 'all' || account.proacaoId === resolvedProacaoId,
    );
    return buildPlanningSummary(filtered, year, resolvedProacaoId) as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'audit' && method === 'GET') {
    const proacaoId = url.searchParams.get('proacaoId');
    const year = Number(url.searchParams.get('year') ?? '2026');
    if (!proacaoId) throwApiError('BAD_REQUEST', 'proacaoId e obrigatorio.');
    const resolvedProacaoId = proacaoId!;
    const userId = url.searchParams.get('userId') ?? undefined;
    const filtered = findPlanningAccountsForUser(userId).filter(
      (account) => resolvedProacaoId === 'all' || account.proacaoId === resolvedProacaoId,
    );
    return buildPlanningAudit(filtered, year, resolvedProacaoId, userId) as T;
  }

  if (segments[0] === 'planning' && segments[1] === 'import' && method === 'POST') {
    return {
      ok: true,
      imported: 21,
      warnings: [],
    } as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'map' && method === 'GET') {
    const perspectiveOrder = ['FINANCEIRO', 'CLIENTE', 'PROCESSOS', 'APRENDIZADO_CRESCIMENTO'];
    const grouped = new Map<
      string,
      {
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
    >();

    state.bscIndicators.forEach((indicator) => {
      if (!grouped.has(indicator.perspective)) {
        grouped.set(indicator.perspective, {
          id: `perspective-${indicator.perspective.toLowerCase()}`,
          name: indicator.perspective,
          orderIndex: Math.max(0, perspectiveOrder.indexOf(indicator.perspective)),
          objectives: [],
        });
      }
      const perspective = grouped.get(indicator.perspective)!;
      const objectiveSlug = normalizeLabel(indicator.objective).toLowerCase().replace(/\s+/g, '-');
      let objective = perspective.objectives.find((item) => item.slug === objectiveSlug);
      if (!objective) {
        objective = {
          id: `objective-${objectiveSlug}`,
          name: indicator.objective,
          slug: objectiveSlug,
          indicators: [],
        };
        perspective.objectives.push(objective);
      }
      objective.indicators.push({
        id: indicator.id,
        code: indicator.code,
        name: indicator.name,
        responsible: indicator.responsible,
        dataOwner: indicator.dataOwner,
        process: indicator.process,
        keywords: indicator.keywords,
        level: indicator.level,
        direction: indicator.direction,
        yearTargets: deepClone(indicator.yearTargets),
      });
    });

    return {
      perspectives: Array.from(grouped.values()).sort((left, right) => left.orderIndex - right.orderIndex),
    } as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'indicators' && segments.length === 2 && method === 'GET') {
    const perspective = url.searchParams.get('perspective');
    const objective = url.searchParams.get('objective');
    const responsible = url.searchParams.get('responsible');
    const dataOwner = url.searchParams.get('dataOwner');
    const process = url.searchParams.get('process');
    const level = url.searchParams.get('level');
    const keyword = url.searchParams.get('keyword');
    const search = (url.searchParams.get('search') ?? '').toLowerCase().trim();

    const rows = state.bscIndicators
      .map((indicator) => buildBscIndicatorPayload(indicator))
      .filter((row) => {
        const matchesPerspective = !perspective || row.objective?.perspective?.name === perspective;
        const matchesObjective = !objective || row.objective?.name === objective;
        const matchesResponsible = !responsible || row.responsible === responsible;
        const matchesDataOwner = !dataOwner || row.dataOwner === dataOwner;
        const matchesProcess = !process || row.process === process;
        const matchesLevel = !level || String(row.level ?? '') === level;
        const keywords = String(row.keywords ?? '').toLowerCase();
        const matchesKeyword = !keyword || keywords.split(/[;,/|]/).map((item) => item.trim()).includes(keyword.toLowerCase());
        const haystack = `${row.code} ${row.name} ${row.objective?.name ?? ''}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        return (
          matchesPerspective &&
          matchesObjective &&
          matchesResponsible &&
          matchesDataOwner &&
          matchesProcess &&
          matchesLevel &&
          matchesKeyword &&
          matchesSearch
        );
      });
    return rows as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'indicators' && segments.length === 3 && method === 'GET') {
    const code = decodeURIComponent(segments[2]);
    const indicator = state.bscIndicators.find((item) => item.code.toUpperCase() === code.toUpperCase());
    if (!indicator) throwApiError('NOT_FOUND', 'Indicador nao encontrado.');
    return buildBscIndicatorPayload(indicator!) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'indicators' && segments[3] === 'month-actual' && method === 'PATCH') {
    const code = decodeURIComponent(segments[2]);
    const body = parseJsonBody(init) as { year?: number; month?: number; actualValue?: number | null } | null;
    const year = Number(body?.year ?? 2026);
    const month = Number(body?.month ?? 1);
    return updateBscIndicatorMonth(code, { year, month, actualValue: body?.actualValue ?? null }) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'indicators' && segments[3] === 'month-target' && method === 'PATCH') {
    const code = decodeURIComponent(segments[2]);
    const body = parseJsonBody(init) as { year?: number; month?: number; targetValue?: number | null } | null;
    const year = Number(body?.year ?? 2026);
    const month = Number(body?.month ?? 1);
    return updateBscIndicatorMonth(code, { year, month, targetValue: body?.targetValue ?? null }) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'management' && segments.length === 2 && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    return {
      year,
      rows: buildBscManagementRows(year),
    } as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'management' && segments[2] === 'summary' && method === 'GET') {
    const year = Number(url.searchParams.get('year') ?? '2026');
    return buildBscManagementSummary(year) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'projects' && segments[2] === 'snapshots' && method === 'GET') {
    return deepClone(state.bscSnapshots) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'projects' && segments.length === 2 && method === 'GET') {
    const snapshot = url.searchParams.get('snapshot');
    const rows = state.bscProjects
      .filter((project) => !snapshot || project.snapshotDate === snapshot)
      .map((project) => {
        const countTasks = (nodes: Array<{ children: any[] }>): number =>
          nodes.reduce((sum, node) => sum + 1 + countTasks(node.children ?? []), 0);
        return {
          id: project.id,
          name: project.name,
          snapshotDate: project.snapshotDate,
          _count: { tasks: countTasks(project.tasks) },
        };
      });
    return deepClone(rows) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'projects' && segments[3] === 'tasks' && method === 'GET') {
    const projectId = segments[2];
    const project = state.bscProjects.find((item) => item.id === projectId);
    if (!project) throwApiError('NOT_FOUND', 'Projeto nao encontrado.');
    const resolvedProject = project!;
    return {
      taskTree: deepClone(resolvedProject.tasks),
      name: resolvedProject.name,
    } as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'tasks' && segments[3] === 'snapshots' && method === 'GET') {
    const taskId = segments[2];
    const snapshots = state.bscProjects
      .map((project) => {
        const findTask = (nodes: DemoBscProject['tasks']): DemoBscProject['tasks'][number] | null => {
          for (const node of nodes) {
            if (node.id === taskId) return node;
            const child = findTask(node.children ?? []);
            if (child) return child;
          }
          return null;
        };
        const task = findTask(project.tasks);
        if (!task) return null;
        return {
          snapshotDate: project.snapshotDate,
          percentComplete: task.percentComplete,
        };
      })
      .filter(Boolean);
    return deepClone(snapshots) as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'import' && method === 'POST') {
    return {
      importId: `bsc-import-${Date.now()}`,
      status: 'SUCCESS',
      warningsCount: 0,
      counters: {
        indicators: state.bscIndicators.length,
      },
    } as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'imports' && segments.length === 2 && method === 'GET') {
    return [
      {
        id: 'bsc-import-1',
        status: 'SUCCESS',
        createdAt: now(),
        counters: {
          indicators: state.bscIndicators.length,
        },
      },
    ] as T;
  }

  if (segments[0] === 'bsc' && segments[1] === 'imports' && segments.length === 3 && method === 'GET') {
    return {
      id: segments[2],
      status: 'SUCCESS',
      createdAt: now(),
      counters: {
        indicators: state.bscIndicators.length,
      },
    } as T;
  }

  throw toApiError('NOT_IMPLEMENTED', `Endpoint nao implementado no mock: ${method} ${pathname}`);
};

const toDemoAuthResponse = (user: User): DemoAuthResponse => ({
  accessToken: buildToken(user.id),
  accessTokenExpiresIn: 60 * 60,
  refreshTokenExpiresIn: 60 * 60 * 24 * 30,
  user: deepClone(user),
});

const resolveLoginUser = (identifier: string) => {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;
  return (
    state.users.find((user) => user.active && user.username.toLowerCase() === normalized) ??
    state.users.find((user) => user.active && (user.email ?? '').toLowerCase() === normalized) ??
    state.users.find((user) => user.active && user.name.toLowerCase() === normalized)
  );
};

export const portfolioDemoAuth = {
  async login(identifier: string, password: string): Promise<DemoAuthResponse> {
    await wait();
    const user = resolveLoginUser(identifier);
    if (!user || !password || password.trim().length < 3) {
      throwApiError('AUTH_FAILED', 'Usuario ou senha invalidos no modo portfolio.');
    }
    const resolvedUser = user!;
    const token = buildToken(resolvedUser.id);
    writeStorage(TOKEN_STORAGE_KEY, token);
    writeStorage(USER_STORAGE_KEY, resolvedUser.id);
    writeStorage(LOGGED_OUT_STORAGE_KEY, null);
    return toDemoAuthResponse(resolvedUser);
  },

  async refresh(): Promise<DemoAuthResponse> {
    await wait();
    const token = readStorage(TOKEN_STORAGE_KEY);
    if (!token) {
      throwApiError('NO_REFRESH', 'Nenhuma sessao ativa no modo portfolio.');
    }
    const user = resolveUserByToken(token);
    if (!user) {
      writeStorage(TOKEN_STORAGE_KEY, null);
      writeStorage(USER_STORAGE_KEY, null);
      throwApiError('UNAUTHORIZED', 'Sessao expirada no modo portfolio.');
    }
    const resolvedUser = user!;
    writeStorage(TOKEN_STORAGE_KEY, token);
    writeStorage(USER_STORAGE_KEY, resolvedUser.id);
    return toDemoAuthResponse(resolvedUser);
  },

  async logout(): Promise<void> {
    await wait();
    writeStorage(TOKEN_STORAGE_KEY, null);
    writeStorage(USER_STORAGE_KEY, null);
    writeStorage(LOGGED_OUT_STORAGE_KEY, '1');
  },
};

export const portfolioDemoRequest = async <T>(
  path: string,
  init?: RequestInit,
  accessToken?: string | null,
): Promise<T> => {
  try {
    return await requestHandler<T>(path, init, accessToken);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      throw error as ApiError;
    }
    throw toApiError('DEMO_ERROR', 'Falha inesperada no provider local mock.', error);
  }
};

export const portfolioDemoStaticParams = {
  accountCodes: () =>
    Array.from(
      new Set([
        ...state.sponsorLinks.map((link) => link.accountCode),
        ...state.accountPlans.filter((plan) => plan.type === 'A').map((plan) => plan.code),
      ]),
    ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
  bscIndicatorCodes: () => state.bscIndicators.map((indicator) => indicator.code),
};
