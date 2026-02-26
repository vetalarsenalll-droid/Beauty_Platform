import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
const base='http://localhost:3000';
async function send(msg){const r=await fetch(`${base}/api/v1/public/ai/chat?account=beauty-salon`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg})});return (await r.json()).data;}
(async()=>{
 const out=await send('привет, запиши меня на завтра');
 const threadId=out.threadId;
 const draft=await prisma.aiBookingDraft.findUnique({where:{threadId},select:{date:true,time:true,locationId:true,serviceId:true,status:true}});
 const action=await prisma.aiAction.findFirst({where:{threadId},orderBy:{id:'desc'},select:{payload:true}});
 console.log('reply=',out.reply);
 console.log('draft=',draft);
 console.log('intent=',action?.payload?.intent,'route=',action?.payload?.route,'nlu=',action?.payload?.nluIntent,'msgForRouting=',action?.payload?.messageForRouting);
 await prisma.$disconnect();
})();
