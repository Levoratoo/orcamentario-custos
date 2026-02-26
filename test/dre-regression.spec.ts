import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

type DreRow = {
  id: string;
  descricao: string;
  parentId?: string | null;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

const CRITICAL_LABELS = [
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

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

describe('DRE regression by year', () => {
  let prisma: PrismaService;
  let dreService: DreService;

  beforeAll(async () => {
    jest.setTimeout(120_000);
    prisma = new PrismaService();
    await prisma.$connect();
    dreService = new DreService(prisma as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps 10 critical accounts and parent totals consistent in 2024/2025/2026', async () => {
    for (const year of [2024, 2025, 2026]) {
      const budget = await prisma.budget.findFirst({
        where: { year, kind: 'BUDGET' as any },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      });
      expect(budget).toBeTruthy();
      const tree = await dreService.getTree(budget!.id, 'DRE');
      const rows = tree.rows as DreRow[];

      for (const label of CRITICAL_LABELS) {
        const match = rows.find((row) => normalize(row.descricao).includes(normalize(label)));
        expect(match).toBeTruthy();
      }

      const byId = new Map(rows.map((row) => [row.id, row]));
      const parents = rows.filter((row) => rows.some((child) => child.parentId === row.id));

      for (const parent of parents) {
        const children = rows.filter((row) => row.parentId === parent.id);
        const monthMismatch = tree.months.some((monthKey) => {
          const parentPrev = toNumber(parent.valoresPorMes?.[monthKey]?.previsto);
          const childrenPrev = children.reduce(
            (sum, child) => sum + toNumber(child.valoresPorMes?.[monthKey]?.previsto),
            0,
          );
          return Math.abs(parentPrev - childrenPrev) > 0.02;
        });
        expect(monthMismatch).toBe(false);

        if (parent.parentId) {
          expect(byId.has(parent.parentId)).toBe(true);
        }
      }
    }
  });
});
