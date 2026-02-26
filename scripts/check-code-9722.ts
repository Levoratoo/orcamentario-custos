import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';
(async()=>{
 const prisma=new PrismaService(); await prisma.$connect(); const dre=new DreService(prisma as any);
 const b=await prisma.budget.findFirst({where:{year:2026, kind:'BUDGET' as any}, orderBy:[{isActive:'desc'},{updatedAt:'desc'}]});
 const t=await dre.getTree(b!.id,'DRE'); const rows=t.rows as any[];
 const c=rows.filter(r=>String(r.codigo??'').trim()==='9722');
 console.log(c.map(r=>({id:r.id,desc:r.descricao,nivel:r.nivel,parentId:r.parentId,sort:r.sortOrder}))); 
 await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exitCode=1});
