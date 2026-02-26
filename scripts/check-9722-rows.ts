import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';

type Row = {id:string; descricao:string; parentId?:string|null; codigo?:string|null; nivel?:number};

(async()=>{
 const prisma=new PrismaService(); await prisma.$connect(); const dre=new DreService(prisma as any);
 const budget=await prisma.budget.findFirst({where:{year:2026, kind:'BUDGET' as any}, orderBy:[{isActive:'desc'},{updatedAt:'desc'}]});
 const tree=await dre.getTree(budget!.id,'DRE'); const rows=tree.rows as Row[];
 const hits=rows.filter(r=>String(r.descricao).trim().startsWith('9722'));
 console.log('hits', hits.length);
 console.log(hits.slice(0,10));
 await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exitCode=1});
