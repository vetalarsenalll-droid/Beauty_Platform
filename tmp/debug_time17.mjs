import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
const base='http://localhost:3000';
async function send(msg,threadId){const r=await fetch(`${base}/api/v1/public/ai/chat?account=beauty-salon`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})}); return (await r.json()).data;}
(async()=>{
 let o=await send('на завтра',0); const t=o.threadId;
 let d=await prisma.aiBookingDraft.findUnique({where:{threadId:t},select:{date:true,time:true,locationId:true,serviceId:true}});
 console.log('after1',d,o.reply.replace(/\n/g,' '));
 o=await send('в 17:00',t);
 d=await prisma.aiBookingDraft.findUnique({where:{threadId:t},select:{date:true,time:true,locationId:true,serviceId:true}});
 const act=await prisma.aiAction.findFirst({where:{threadId:t},orderBy:{id:'desc'},select:{payload:true}});
 console.log('after2',d,o.reply.replace(/\n/g,' '));
 console.log('payload',act?.payload?.intent,act?.payload?.route,act?.payload?.messageForRouting);
 await prisma.$disconnect();
})();
