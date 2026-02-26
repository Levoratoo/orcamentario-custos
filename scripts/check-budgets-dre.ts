import { PrismaService } from '../src/prisma/prisma.service';

(async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  for (const year of [2024, 2025, 2026]) {
    const budgets = await prisma.budget.findMany({
      where: { year },
      select: { id: true, name: true, kind: true, status: true, isActive: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }],
    });

    console.log(`\nYEAR ${year} budgets=${budgets.length}`);

    for (const budget of budgets) {
      const realizedCount = await prisma.dreLine.count({ where: { budgetId: budget.id, mode: 'REALIZADO' } });
      const realizedSum = await prisma.dreLine.aggregate({
        where: { budgetId: budget.id, mode: 'REALIZADO' },
        _sum: { value: true },
      });
      const previstoCount = await prisma.dreLine.count({ where: { budgetId: budget.id, mode: 'PREVISTO' } });
      const previstoSum = await prisma.dreLine.aggregate({
        where: { budgetId: budget.id, mode: 'PREVISTO' },
        _sum: { value: true },
      });

      console.log(
        `${budget.id.slice(0, 8)} | ${budget.kind} | ${budget.status} | active=${budget.isActive} | ${budget.name} | PREV rows=${previstoCount} sum=${Number(previstoSum._sum.value ?? 0)} | REAL rows=${realizedCount} sum=${Number(realizedSum._sum.value ?? 0)}`,
      );
    }
  }

  await prisma.$disconnect();
})();
