import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

type DreRow = {
  id: string;
  descricao: string;
  codigo?: string | null;
  parentId?: string | null;
  valoresPorMes: Record<string, { previsto: number; realizado: number; projetado: number }>;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCsvCell = (value: unknown) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const dreService = new DreService(prisma as any);

  const years = [2024, 2025, 2026];
  const lines = [
    [
      'year',
      'month',
      'parent_id',
      'parent_codigo',
      'parent_descricao',
      'children_count',
      'parent_previsto',
      'children_previsto_sum',
      'delta_previsto',
      'status',
    ].join(','),
  ];

  for (const year of years) {
    const budget = await prisma.budget.findFirst({
      where: { year, kind: 'BUDGET' as any },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!budget) continue;
    const tree = await dreService.getTree(budget.id, 'DRE');
    const rows = tree.rows as DreRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));

    const parents = rows.filter((row) => rows.some((child) => child.parentId === row.id));
    for (const parent of parents) {
      const children = rows.filter((row) => row.parentId === parent.id);
      if (children.length === 0) continue;

      for (const monthKey of tree.months) {
        const parentPrev = toNumber(parent.valoresPorMes?.[monthKey]?.previsto);
        const sumChildrenPrev = children.reduce(
          (sum, child) => sum + toNumber(child.valoresPorMes?.[monthKey]?.previsto),
          0,
        );
        const delta = parentPrev - sumChildrenPrev;
        const status = Math.abs(delta) <= 0.02 ? 'OK' : 'MISMATCH';
        lines.push(
          [
            year,
            monthKey,
            parent.id,
            parent.codigo ?? '',
            parent.descricao,
            children.length,
            parentPrev.toFixed(2),
            sumChildrenPrev.toFixed(2),
            delta.toFixed(2),
            status,
          ]
            .map(toCsvCell)
            .join(','),
        );
      }

      if (parent.parentId && !byId.has(parent.parentId)) {
        lines.push(
          [
            year,
            'ALL',
            parent.id,
            parent.codigo ?? '',
            parent.descricao,
            children.length,
            '',
            '',
            '',
            'MISSING_PARENT_REFERENCE',
          ]
            .map(toCsvCell)
            .join(','),
        );
      }
    }
  }

  const reportsDir = path.resolve(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const reportPath = path.join(reportsDir, `dre-consistency-${stamp}.csv`);
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf-8');
  console.log(`Report generated: ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
