export type DreMode = 'previsto' | 'realizado' | 'projetado' | 'dre' | 'ambos';

export type DreTipo = 'receita' | 'custo' | 'outros';

export interface DreMonthValue {
  previsto: number;
  realizado: number;
  projetado?: number;
}

export interface DreRow {
  id: string;
  codigo?: string;
  descricao: string;
  nivel: number;
  parentId?: string | null;
  tipo: DreTipo;
  valoresPorMes: Record<string, DreMonthValue>;
}

export interface DreSummary {
  totalReceitas: number;
  totalCustosDespesas: number;
  totalAnual: number;
  setoresAtivos: number;
  porMes: Record<string, { receitas: number; custosDespesas: number; total: number }>;
}

export interface DreBySector {
  setorId: string;
  setorNome: string;
  contas: DreRow[];
  porMes: Record<string, { receitas: number; custosDespesas: number; total: number }>;
  total: number;
}

export interface DreResult {
  rows: DreRow[];
  summary: DreSummary;
  bySector: DreBySector[];
  months: string[];
}
