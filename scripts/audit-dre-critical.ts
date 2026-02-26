import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

type DreRow = {
  id: string;
  descricao: string;
  parentId?: string | null;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

const TARGETS = [
  '(+) RECEITA BRUTA',
  '(+) RECEITA SOBRE SERVICOS',
  '(+) RECEITA SOBRE VENDA MERCADO INTERNO',
  '(-) DEDUCOES',
  '(-) CUSTOS E DESPESAS VARIAVEIS',
  '(-) CUSTOS E DESPESAS FIXAS DESEMBOLSAVEIS',
  '(-) SOFTWARES',
  'MANUTENCAO DE SOFTWARE',
  '(=) EBITDA',
  '(=) LUCRO LIQUIDO',
];

const normalize = (value: string) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function findTarget(rows: DreRow[], target: string) {
  const key = normalize(target);
  return rows.find((row) => normalize(row.descricao).includes(key)) ?? null;
}

(async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  const dre = new DreService(prisma as any);

  const years = [2024, 2025, 2026];
  const report: any[] = [];

  for (const year of years) {
    const budget = await prisma.budget.findFirst({
      where: { year, kind: 'BUDGET' as any },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!budget) {
      report.push({ year, error: 'BUDGET_NOT_FOUND' });
      continue;
    }

    const tree = await dre.getTree(budget.id, 'DRE');
    const rows = tree.rows as DreRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));

    const checks = TARGETS.map((target) => {
      const row = findTarget(rows, target);
      if (!row) {
        return { target, found: false };
      }
      const children = rows.filter((item) => item.parentId === row.id);
      const jan = `${year}-01`;
      const janPrev = num(row.valoresPorMes?.[jan]?.previsto);
      const janReal = num(row.valoresPorMes?.[jan]?.realizado);
      const janProj = num(row.valoresPorMes?.[jan]?.projetado);
      const totalPrev = tree.months.reduce((acc: number, m: string) => acc + num(row.valoresPorMes?.[m]?.previsto), 0);

      let parentMatchesChildren = null as null | boolean;
      if (children.length > 0) {
        parentMatchesChildren = tree.months.every((m: string) => {
          const parentPrev = num(row.valoresPorMes?.[m]?.previsto);
          const sumChildrenPrev = children.reduce((acc, child) => acc + num(child.valoresPorMes?.[m]?.previsto), 0);
          return Math.abs(parentPrev - sumChildrenPrev) <= 0.02;
        });
      }

      const parent = row.parentId ? byId.get(row.parentId) : null;

      return {
        target,
        found: true,
        row: row.descricao,
        parent: parent?.descricao ?? null,
        children: children.length,
        janPrev,
        janReal,
        janProj,
        totalPrev,
        parentMatchesChildren,
      };
    });

    report.push({
      year,
      rows: rows.length,
      months: tree.months.length,
      checks,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
