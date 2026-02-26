import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
const base='http://localhost:3000'; const accountSlug='beauty-salon';
const ck=(h)=>{const r=h.get('set-cookie'); if(!r) return ''; return r.split(/,(?=\s*\w+=)/g).map(x=>x.split(';')[0]).join('; ')};
async function chat(cookie,threadId,message){const r=await fetch(`${base}/api/v1/public/ai/chat?account=${accountSlug}`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({message,threadId})});return (await r.json()).data;}
(async()=>{
 const email=`autocase_${Date.now()}@example.com`; const password='Passw0rd!123';
 const reg=await fetch(`${base}/api/v1/auth/client/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,accountSlug,firstName:'Case',lastName:'Tester'})});
 const cookie=ck(reg.headers);
 const account=await prisma.account.findUnique({where:{slug:accountSlug},select:{id:true}});
 const client=await prisma.client.findFirst({where:{accountId:account.id,email},select:{id:true}});
 const service=await prisma.service.findFirst({where:{accountId:account.id,isActive:true},select:{id:true,baseDurationMin:true,basePrice:true}});
 const specialist=await prisma.specialistProfile.findFirst({where:{accountId:account.id},select:{id:true}});
 const location=await prisma.location.findFirst({where:{accountId:account.id,status:'ACTIVE'},select:{id:true}});
 const startAt=new Date(Date.now()+40*24*60*60*1000); startAt.setUTCHours(13,0,0,0); const endAt=new Date(startAt.getTime()+service.baseDurationMin*60000);
 const ap=await prisma.appointment.create({data:{accountId:account.id,locationId:location.id,specialistId:specialist.id,clientId:client.id,startAt,endAt,status:'NEW',priceTotal:service.basePrice,durationTotalMin:service.baseDurationMin,source:'CHAT_TEST',services:{create:[{serviceId:service.id,price:service.basePrice,durationMin:service.baseDurationMin}]}}});
 let threadId=0;
 for (const t of ['какая у меня ближайшая запись','можешь отменить ее?','подтверждаю']){const o=await chat(cookie,threadId,t); if(!threadId) threadId=o.threadId; console.log('>',t); console.log('<',String(o.reply).replace(/\n/g,' '));}
 const u=await prisma.appointment.findUnique({where:{id:ap.id},select:{status:true}}); console.log('STATUS=',u.status);
 await prisma.$disconnect();
})();
