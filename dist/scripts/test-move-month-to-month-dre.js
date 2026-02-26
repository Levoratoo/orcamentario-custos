"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dre_service_1 = require("../src/dre/dre.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
const planning_service_1 = require("../src/planning/planning.service");
(async () => {
    const prisma = new client_1.PrismaClient();
    await prisma.$connect();
    const prismaService = new prisma_service_1.PrismaService();
    await prismaService.$connect();
    const budget = await prisma.budget.findFirst({ where: { year: 2026, kind: 'BUDGET', status: 'READY' }, orderBy: { updatedAt: 'desc' } });
    if (!budget)
        throw new Error('budget 2026 not found');
    const sample = await prisma.planningAccount.findFirst({
        where: { code: { startsWith: '6221' }, values: { some: { year: 2026 } } },
        include: { owner: { select: { id: true, name: true } }, values: { where: { year: 2026, month: { in: [1, 2] } }, orderBy: { month: 'asc' } } },
    });
    if (!sample)
        throw new Error('sample account not found');
    const owner = sample.owner;
    const m1Before = Number(sample.values.find(v => v.month === 1)?.value ?? 0);
    const m2Before = Number(sample.values.find(v => v.month === 2)?.value ?? 0);
    const dreService = new dre_service_1.DreService(prismaService);
    const planningService = new planning_service_1.PlanningService(prismaService);
    const readDre6221 = async () => {
        const tree = await dreService.getTree(budget.id, 'DRE');
        const row = tree.rows.find((r) => String(r.codigo ?? '') === '6221');
        return {
            jan: Number(row?.valoresPorMes?.['2026-01']?.previsto ?? 0),
            fev: Number(row?.valoresPorMes?.['2026-02']?.previsto ?? 0),
        };
    };
    const dreBefore = await readDre6221();
    await planningService.updateValue({ sub: owner.id, role: 'COORDINATOR' }, {
        accountId: sample.id,
        year: 2026,
        month: 1,
        value: m1Before - 1000,
    });
    await planningService.updateValue({ sub: owner.id, role: 'COORDINATOR' }, {
        accountId: sample.id,
        year: 2026,
        month: 2,
        value: m2Before + 1000,
    });
    const dreAfter = await readDre6221();
    await planningService.updateValue({ sub: owner.id, role: 'COORDINATOR' }, {
        accountId: sample.id,
        year: 2026,
        month: 1,
        value: m1Before,
    });
    await planningService.updateValue({ sub: owner.id, role: 'COORDINATOR' }, {
        accountId: sample.id,
        year: 2026,
        month: 2,
        value: m2Before,
    });
    const dreRestored = await readDre6221();
    console.log(JSON.stringify({
        account: { id: sample.id, code: sample.code, owner: owner.name },
        planningBefore: { jan: m1Before, fev: m2Before },
        dreBefore,
        dreAfter,
        dreDelta: { jan: dreAfter.jan - dreBefore.jan, fev: dreAfter.fev - dreBefore.fev },
        dreRestored,
        restoredOk: Math.abs(dreRestored.jan - dreBefore.jan) < 0.0001 && Math.abs(dreRestored.fev - dreBefore.fev) < 0.0001,
    }, null, 2));
    await prismaService.$disconnect();
    await prisma.$disconnect();
})();
//# sourceMappingURL=test-move-month-to-month-dre.js.map