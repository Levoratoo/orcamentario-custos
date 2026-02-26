export type Role = 'ADMIN' | 'CONTROLLER' | 'COORDINATOR';
export type BudgetKind = 'BUDGET' | 'ACTUAL';
export type BudgetStatus = 'DRAFT' | 'READY' | 'PROCESSING' | 'ERROR' | 'ARCHIVED';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  role: Role;
  mustChangePassword?: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Scenario {
  id: string;
  name: string;
  year: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED';
  createdById: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  lockedAt?: string | null;
}

export interface Budget {
  id: string;
  name: string;
  year: number;
  kind: BudgetKind;
  status: BudgetStatus;
  isActive: boolean;
  fileName?: string | null;
  notes?: string | null;
  version: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetImport {
  id: string;
  budgetId: string;
  version: number;
  fileName: string;
  status: BudgetStatus;
  errorMessage?: string | null;
  uploadedAt: string;
}

export interface SponsorAccountRow {
  accountCode: string;
  accountName: string;
  costCenterId?: string | null;
  costCenterName?: string | null;
  sponsor: { userId?: string | null; display: string };
  actualPrevYearTotal: number;
  scenarioTotal: number;
  varPct: number | null;
  itemsCount: number;
  filledItemsCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
}

export interface BudgetItem {
  id: string;
  itemName: string;
  isActive: boolean;
  isReimbursement: boolean;
  comment?: string | null;
  monthValues: Record<number, number>;
  total: number;
}

export interface AccountBudgetDetails {
  budget: { id: string; name: string; year: number };
  account: { code: string; name: string };
  costCenter?: { id: string; name: string } | null;
  permission: { canEdit: boolean; isAdmin: boolean };
  items: BudgetItem[];
  totals: {
    scenarioTotal: number;
    scenarioMonthly: Array<{ month: number; value: number }>;
    actualPrevYearTotal: number;
    actualPrevYearMonthly: Array<{ month: number; value: number }>;
    varPctTotal: number | null;
    varPctMonthly: Array<{ month: number; value: number | null }>;
  };
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  active: boolean;
  ownerCoordinatorId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPlan {
  id: string;
  code: string;
  type: 'T' | 'A';
  classification: string;
  description: string;
  level: number;
  parentId?: string | null;
  isAtiva: boolean;
  createdAt: string;
  updatedAt: string;
  children?: AccountPlan[];
}

export type DriverType = 'FIXED' | 'HEADCOUNT' | 'PERCENT_PAYROLL' | 'CONTRACT' | 'CONSUMPTION' | 'OTHER';

export interface BudgetLine {
  id: string;
  scenarioId: string;
  costCenterId: string;
  accountId: string;
  description: string;
  driverType: DriverType;
  driverValue?: unknown;
  monthlyValues: Record<string, string>;
  currency: string;
  assumptions?: string | null;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryItem {
  groupId: string;
  groupCode: string;
  groupName: string;
  monthlyValues: Record<string, string>;
  total: string;
}

export interface BudgetScenarioAccount {
  classification: string;
  description?: string | null;
  type?: 'T' | 'A' | null;
  monthlyValues: Record<string, number>;
  total: number;
  level?: number;
  isGroup?: boolean;
}

export interface BudgetScenarioSector {
  code: string;
  name?: string | null;
  monthlyValues: Record<string, number>;
  total: number;
  accounts: BudgetScenarioAccount[];
}

export interface BudgetScenarioImportResult {
  year?: number | null;
  years?: number[];
  months: string[];
  totals: {
    byMonth: Record<string, number>;
    total: number;
  };
  sectors: BudgetScenarioSector[];
  unmatchedAccounts: string[];
  unmatchedSectors: string[];
  sourceFiles: string[];
  totalRows: number;
  accountTree?: AccountHierarchyNode[] | null;
  errors: string[];
}

export interface AccountHierarchyNode {
  classification: string;
  description: string;
  level: number;
  children: AccountHierarchyNode[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PlanningProacao {
  id: string;
  name: string;
}

export interface PlanningAccountRow {
  id: string;
  code: string;
  label: string;
  name: string;
  ownerUserId: string;
  orderIndex: number;
  values: Record<number, number>;
  lockedByMonth?: Record<number, boolean>;
  total: number;
}

export interface PlanningGridResponse {
  proacao: PlanningProacao;
  year: number;
  accounts: PlanningAccountRow[];
  totals: { grandTotal: number };
}

export interface PlanningSummaryResponse {
  year: number;
  proacaoId: string;
  kpis: {
    receitaLiquidaProjetada: number;
    txVerbaAno: number | null;
    orcMaximo: number;
    orcLancado: number;
    excedeuMaximo: boolean;
  };
  chart: {
    labels: string[];
    series: {
      orcadoAnoAtual: number[];
      realizadoAnoAnt: number[];
      realizadoAnoAtual: number[];
      orcadoAnoAnt: number[];
      cenario: number[];
    };
  };
}

export interface PlanningAccountRef {
  id: string;
  code: string;
  label: string;
  name: string;
  proacao: { id: string; name: string };
}

export interface UserAssignmentsResponse {
  user: { id: string; name: string; username: string };
  assignedAccountIds: string[];
  accounts: PlanningAccountRef[];
}
