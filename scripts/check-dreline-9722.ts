import { PrismaService } from '../src/prisma/prisma.service';
(async()=>{
 const prisma=new PrismaService(); await prisma.$connect();
 const b=await prisma.budget.findFirst({where:{year:2026, kind:'BUDGET' as any}, orderBy:[{isActive:'desc'},{updatedAt:'desc'}]});
 const lines=await prisma.dreLine.findMany({where:{budgetId:b!.id, accountCode:'9722'}, select:{nodeKey:true, accountName:true, parentKey:true, level:true, sortOrder:true}, orderBy:{sortOrder:'asc'}});
 console.log(lines.slice(0,20));
 console.log('count', lines.length);
 await prisma.$disconnect();
})().catch(e=>{console.error(e);process.exitCode=1});
