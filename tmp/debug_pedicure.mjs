import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
const base='http://localhost:3000';
async function send(msg,threadId){const r=await fetch(`${base}/api/v1/public/ai/chat?account=beauty-salon`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,threadId})}); return (await r.json()).data;}
(async()=>{
 const out=await send('хочу на педикюр',0);
 const threadId=out.threadId;
 const draft=await prisma.aiBookingDraft.findUnique({where:{threadId},select:{locationId:true,serviceId:true,date:true,time:true,status:true}});
 const act=await prisma.aiAction.findFirst({where:{threadId},orderBy:{id:'desc'},select:{payload:true}});
 console.log('reply=',out.reply.replace(/\n/g,' '));
 console.log('draft=',draft);
 console.log('payload=',act?.payload);
 await prisma.$disconnect();
})();
