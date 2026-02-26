"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
const planning_service_1 = require("../src/planning/planning.service");
const client_1 = require("@prisma/client");
function getMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
async function run() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const dreService = new dre_service_1.DreService(prisma);
    const planningService = new planning_service_1.PlanningService(prisma);
    const year = 2026;
    const monthFrom = 1;
    const monthTo = 2;
    const moveAmount = 1111.11;
    const admin = await prisma.user.findFirst({ where: { role: client_1.Role.ADMIN, active: true }, select: { id: true, username: true } });
    if (!admin)
        throw new Error('ADMIN n�o encontrado');
    const budget = await prisma.budget.findFirst({ where: { year, kind: 'BUDGET' }, orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
    if (!budget)
        throw new Error(`Budget ${year} n�o encontrado`);
    const candidates = await prisma.planningAccount.findMany({
        where: {
            code: { not: '' },
            values: { some: { year, month: { in: [monthFrom, monthTo] } } },
        },
        select: {
            id: true,
            code: true,
            label: true,
            values: { where: { year, month: { in: [monthFrom, monthTo] } }, select: { month: true, value: true }, orderBy: { month: 'asc' } },
        },
        take: 200,
    });
    let chosen = null;
    const tree0 = await dreService.getTree(budget.id, 'DRE');
    const rows0 = tree0.rows;
    const dreCodes = new Set(rows0.map((r) => String(r.codigo ?? '').trim()).filter(Boolean));
    for (const c of candidates) {
        const base = String(c.code).trim().split('.')[0]?.trim();
        if (!base || !dreCodes.has(base))
            continue;
        const from = Number(c.values.find((v) => v.month === monthFrom)?.value ?? 0);
        const to = Number(c.values.find((v) => v.month === monthTo)?.value ?? 0);
        if (Math.abs(from) > moveAmount + 10 || Math.abs(to) >= 0) {
            chosen = { id: c.id, code: c.code, label: c.label, from, to };
            break;
        }
    }
    if (!chosen)
        throw new Error('Nenhuma conta candidata encontrada para teste');
    const baseCode = chosen.code.split('.')[0];
    const monthKeyFrom = getMonthKey(year, monthFrom);
    const monthKeyTo = getMonthKey(year, monthTo);
    const getBaseRowVals = async () => {
        const t = await dreService.getTree(budget.id, 'DRE');
        const rows = t.rows;
        const row = rows.find((r) => String(r.codigo ?? '').trim() === baseCode);
        if (!row)
            throw new Error(`Linha DRE n�o encontrada para c�digo base ${baseCode}`);
        return {
            from: Number(row.valoresPorMes?.[monthKeyFrom]?.previsto ?? 0),
            to: Number(row.valoresPorMes?.[monthKeyTo]?.previsto ?? 0),
            desc: row.descricao,
        };
    };
    const before = await getBaseRowVals();
    const newFrom = chosen.from - moveAmount;
    const newTo = chosen.to + moveAmount;
    await planningService.updateValue({ sub: admin.id, role: client_1.Role.ADMIN }, { accountId: chosen.id, year, month: monthFrom, value: newFrom });
    await planningService.updateValue({ sub: admin.id, role: client_1.Role.ADMIN }, { accountId: chosen.id, year, month: monthTo, value: newTo });
    const after = await getBaseRowVals();
    await planningService.updateValue({ sub: admin.id, role: client_1.Role.ADMIN }, { accountId: chosen.id, year, month: monthFrom, value: chosen.from });
    await planningService.updateValue({ sub: admin.id, role: client_1.Role.ADMIN }, { accountId: chosen.id, year, month: monthTo, value: chosen.to });
    const restored = await getBaseRowVals();
    const deltaFrom = Number((after.from - before.from).toFixed(2));
    const deltaTo = Number((after.to - before.to).toFixed(2));
    console.log(JSON.stringify({
        admin: admin.username,
        testedAccount: { id: chosen.id, code: chosen.code, label: chosen.label, baseCode },
        moveAmount,
        before,
        after,
        restored,
        observedDelta: { monthFrom: deltaFrom, monthTo: deltaTo },
        expectation: { monthFrom: -moveAmount, monthTo: moveAmount },
        passed: Math.abs(deltaFrom + moveAmount) < 0.02 && Math.abs(deltaTo - moveAmount) < 0.02,
    }, null, 2));
    await prisma.$disconnect();
}
run().catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
});
//# sourceMappingURL=test-admin-move-reflects-dre.js.map