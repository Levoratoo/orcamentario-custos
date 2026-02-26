"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
(async () => {
    const [p, o, i, yt, mt, ma, ap, pr, t, s, imp] = await Promise.all([
        prisma.bscPerspective.count(),
        prisma.bscObjective.count(),
        prisma.bscIndicator.count(),
        prisma.bscIndicatorYearTarget.count(),
        prisma.bscIndicatorMonthTarget.count(),
        prisma.bscIndicatorMonthActual.count(),
        prisma.bscIndicatorActionPlan.count(),
        prisma.bscProject.count(),
        prisma.bscProjectTask.count(),
        prisma.bscTaskSnapshot.count(),
        prisma.bscImport.findMany({ orderBy: { startedAt: 'desc' }, take: 1 }),
    ]);
    console.log(JSON.stringify({ perspectives: p, objectives: o, indicators: i, yearTargets: yt, monthTargets: mt, monthActuals: ma, actionPlans: ap, projects: pr, tasks: t, snapshots: s, lastImport: imp[0]?.status, lastWarnings: Array.isArray(imp[0]?.warnings) ? imp[0]?.warnings.length : 0 }, null, 2));
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-bsc-counts.js.map