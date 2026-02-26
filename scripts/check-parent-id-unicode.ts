import { PrismaService } from '../src/prisma/prisma.service';
import { DreService } from '../src/dre/dre.service';
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
(async()=>{
 const prisma=new PrismaService(); await prisma.$connect(); const dre=new DreService(prisma as any);
 const b=await prisma.budget.findFirst({where:{year:2026, kind:'BUDGET' as any}, orderBy:[{isActive:'desc'},{updatedAt:'desc'}]});
 const t=await dre.getTree(b!.id,'DRE'); const rows=t.rows as any[];
 const matches=rows.filter(r=>norm(String(r.id)).includes('CONTRIBUICAO SOCIAL')).slice(0,5);
 console.log(matches.map(r=>({id:r.id,desc:r.descricao,parentId:r.parentId,nivel:r.nivel}))); 
 const p=rows.find(r=>norm(String(r.id))===norm('(-) CONTRIBUIÇÃO SOCIAL-266'));
 console.log('exact-norm',p?.id,p?.descricao);
 const sampleParent=rows.find(r=>String(r.id).includes('planning-2026:9722.metricssup'))?.parentId;
 console.log('sampleParent',sampleParent);
 await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exitCode=1});
