import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const dre = new DreService(prisma);

  const acc = await dre.getExerciseAccumulated(2025, 1);
  const sample = acc.rows.filter((r) => [
    '(+) RECEITA BRUTA',
    '(+) RECEITA SOBRE SERVIÇOS',
    '(+) RECEITA SOBRE VENDA MERCADO INTERNO',
  ].includes(r.descricao)).map((r) => ({ descricao: r.descricao, atual: r.currentValue, anterior: r.previousValue }));

  console.log({ compareYear: acc.compareYear, totals: acc.totals, sample });
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); process.exitCode = 1; });
