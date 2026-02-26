"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const planning_service_1 = require("../src/planning/planning.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
const dre_service_1 = require("../src/dre/dre.service");
(async () => {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const svc = new planning_service_1.PlanningService(prisma, new dre_service_1.DreService(prisma));
    const out = await svc.listProacoes({ sub: 'admin', role: 'ADMIN' });
    const filtered = out.filter((item) => String(item.name).toLowerCase().includes('comunica'));
    console.log(JSON.stringify(filtered, null, 2));
    await prisma.$disconnect();
})();
//# sourceMappingURL=check-proacoes.js.map