"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
(async () => {
    const p = await prisma.proacao.findFirst({ where: { name: 'Importado' }, select: { id: true } });
    if (!p) {
        console.log('IMPORTADO_NOT_FOUND');
        await prisma.$disconnect();
        return;
    }
    await prisma.proacao.delete({ where: { id: p.id } });
    console.log('IMPORTADO_DELETED');
    await prisma.$disconnect();
})();
//# sourceMappingURL=delete-importado-proacao.js.map