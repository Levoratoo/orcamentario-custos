const { PrismaClient } = require('@prisma/client');
const { PlanningService } = require('../dist/src/planning/planning.service');
const { DreService } = require('../dist/src/dre/dre.service');

async function directDreRealizedByMonth(prisma, year, codes) {
  const budgets = await prisma.budget.findMany({
    where: { year, status: 'READY', kind: { in: ['ACTUAL', 'BUDGET'] } },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, kind: true, isActive: true, updatedAt: true },
  });
  const prioritized = budgets.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'ACTUAL' ? -1 : 1;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return Number(b.updatedAt) - Number(a.updatedAt);
  });
  for (const budget of prioritized) {
    const grouped = await prisma.dreLine.groupBy({
      by: ['month'],
      where: { budgetId: budget.id, mode: 'REALIZADO', accountCode: { in: codes } },
      _sum: { value: true },
    });
    const series = new Array(12).fill(0);
    grouped.forEach((item) => {
      if (item.month >= 1 && item.month <= 12) series[item.month - 1] = Number(item._sum.value || 0);
    });
    const total = series.reduce((a, b) => a + b, 0);
    if (grouped.length > 0 || Math.abs(total) > 0.01) return series;
  }
  return new Array(12).fill(0);
}

(async () => {
  const prisma = new PrismaClient();
  const dre = new DreService(prisma);
  const planning = new PlanningService(prisma, dre);

  const proacao = await prisma.proacao.findFirst({ orderBy: { name: 'asc' }, include: { accounts: true } });
  const codes = [...new Set((proacao?.accounts || []).map((a) => String(a.code || '').trim()).filter(Boolean).flatMap((c) => {
    const base = c.split('.')[0] ? c.split('.')[0].trim() : '';
    return base && base !== c ? [c, base] : [c];
  }))];

  const summary = await planning.getSummary({ sub: 'admin', role: 'ADMIN' }, proacao.id, 2026);
  const apiPrev = summary.chart.series.realizadoAnoAnt;
  const apiCur = summary.chart.series.realizadoAnoAtual;
  const dbPrev = await directDreRealizedByMonth(prisma, 2025, codes);
  const dbCur = await directDreRealizedByMonth(prisma, 2026, codes);

  const eq = (a, b) => a.every((v, i) => Math.abs(v - (b[i] || 0)) < 0.01);
  console.log({
    proacao: proacao.name,
    prevMatches: eq(apiPrev, dbPrev),
    curMatches: eq(apiCur, dbCur),
    may2025: { api: apiPrev[4], db: dbPrev[4] },
    may2026: { api: apiCur[4], db: dbCur[4] },
  });

  await prisma.$disconnect();
})();
