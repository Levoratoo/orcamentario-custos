import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

type Row = { id:string; codigo?:string|null; descricao:string; parentId?:string|null; valoresPorMes: Record<string,{previsto:number;realizado:number;projetado:number}> };

const noAcc = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();

async function run() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const dre = new DreService(prisma as any);
  const budget = await prisma.budget.findFirst({ where:{year:2026, kind:'BUDGET' as any}, orderBy:[{isActive:'desc'},{updatedAt:'desc'}]});
  if (!budget) throw new Error('budget 2026 not found');
  const tree = await dre.getTree(budget.id,'DRE');
  const rows = tree.rows as Row[];

  const softwaresParent = rows.find(r => noAcc(r.descricao).includes('(-) SOFTWARES'));
  if (!softwaresParent) {
    console.log('not found softwares parent');
    console.log(rows.filter(r => noAcc(r.descricao).includes('SOFTWARE')).map(r=>r.descricao).slice(0,20));
    await prisma.$disconnect();
    return;
  }

  const children = rows.filter(r => r.parentId === softwaresParent.id);
  const manut = children.find(r => noAcc(r.descricao).includes('MANUTENCAO DE SOFTWARE'));
  const manutChildren = manut ? rows.filter(r => r.parentId === manut.id) : [];

  const month='2026-01';
  const val=(r:Row|undefined)=>Number(r?.valoresPorMes?.[month]?.previsto ?? 0);
  const sumChildren = children.reduce((a,r)=>a+val(r),0);
  const sumManutChildren = manutChildren.reduce((a,r)=>a+val(r),0);

  console.log(JSON.stringify({
    softwaresParent: { descricao: softwaresParent.descricao, janPrev: val(softwaresParent), children: children.length },
    manutencao: manut ? { descricao: manut.descricao, janPrev: val(manut), children: manutChildren.length } : null,
    checks: {
      parentEqualsChildren: Math.abs(val(softwaresParent)-sumChildren) < 0.01,
      manutEqualsChildren: manut ? Math.abs(val(manut)-sumManutChildren) < 0.01 : null,
    },
    firstChildren: children.slice(0,12).map(r=>({ descricao:r.descricao, janPrev: val(r) })),
    firstManutChildren: manutChildren.slice(0,12).map(r=>({ descricao:r.descricao, janPrev: val(r) })),
  }, null, 2));

  await prisma.$disconnect();
}

run().catch(async e=>{console.error(e); process.exitCode=1;});
