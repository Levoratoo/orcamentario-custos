export const DRE_COLLAPSED_ROOT_LABELS = [
  '(+) RECEITA BRUTA',
  '(-) DEDUCOES',
  '(=) RECEITA LIQUIDA',
  '(-) CUSTOS E DESPESAS VARIAVEIS',
  '(-) CUSTOS VARIAVEIS',
  '(-) INSUMOS E SERVICOS DE TERCEIROS',
  '(-) DESPESAS VARIAVEIS',
  '(-) FRETES',
  '(-) COMISSOES E ROYALTIES',
  '(-) OUTRAS DESPESAS DIRETAS',
  '(=) MARGEM DE CONTRIBUICAO',
  '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
  '(-) CUSTOS FIXOS',
  '(-) CUSTOS COM PESSOAL',
  '(-) MANUTENCAO DE MAQUINAS',
  '(-) ENERGIA ELETRICA',
  '(-) CONVENIO - SEJC - DEAP',
  '(-) PRESTACAO DE SERVICOS',
  '(-) OUTROS CUSTOS',
  '(-) DESPESAS FIXAS',
  '(-) DESPESAS COM PESSOAL',
  '(-) DESPESAS COMERCIAIS',
  '(-) DESPESAS COM VIAGENS',
  '(-) SOFTWARES',
  '(-) PRESTACAO DE SERVICOS',
  '(-) LOGISTICA',
  '(-) OUTRAS DESPESAS',
  '(=) EBITDA',
  '(-) DEPRECIACAO',
  '(=) EBIT',
  '(=) RESULTADO FINANCEIRO',
  '(-) DESPESAS FINANCEIRAS',
  '(+) RECEITAS FINANCEIRAS',
  '(=) RESULTADO NAO OPERACIONAL',
  '(+/-) GANHOS E PERDAS DE CAPITAL',
  '(+) OUTRAS RECEITAS',
  'CRITERIO DE RATEIO',
  '(=) LUCRO ANTES DO IRPJ E CSLL',
  '(-) IRPJ E CSLL',
  '(=) LUCRO LIQUIDO',
];

export function normalizeDreLabel(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCollapsedRootRows<T extends { id: string; descricao: string }>(rootRows: T[]) {
  const targetOrder = DRE_COLLAPSED_ROOT_LABELS.map((label) => normalizeDreLabel(label));
  const byLabel = new Map<string, T[]>();
  rootRows.forEach((row) => {
    const key = normalizeDreLabel(String(row.descricao ?? ''));
    const list = byLabel.get(key) ?? [];
    list.push(row);
    byLabel.set(key, list);
  });

  const ordered: T[] = [];
  const cursorByLabel = new Map<string, number>();
  targetOrder.forEach((labelKey) => {
    const rows = byLabel.get(labelKey) ?? [];
    const cursor = cursorByLabel.get(labelKey) ?? 0;
    const row = rows[cursor];
    if (!row) return;
    ordered.push(row);
    cursorByLabel.set(labelKey, cursor + 1);
  });
  return ordered;
}
