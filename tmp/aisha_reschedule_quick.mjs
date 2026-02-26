import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const base='http://localhost:3000';
const accountSlug='beauty-salon';
function parseCookies(headers){const raw=headers.get('set-cookie'); if(!raw) return ''; return raw.split(/,(?=\s*\w+=)/g).map(x=>x.split(';')[0]).join('; ');} 
async function chat(cookie,threadId,message){const r=await fetch(`${base}/api/v1/public/ai/chat?account=${accountSlug}`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({message,threadId})});const j=await r.json();return j.data;}
(async()=>{
 const email=`rs_check_${Date.now()}@example.com`;const password='Passw0rd!123';
 const reg=await fetch(`${base}/api/v1/auth/client/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,accountSlug,firstName:'Flow',lastName:'Check'})});
 const cookie=parseCookies(reg.headers);
 const account=await prisma.account.findUnique({where:{slug:accountSlug},select:{id:true}});
 const client=await prisma.client.findFirst({where:{accountId:account.id,email},select:{id:true}});
 const service=await prisma.service.findFirst({where:{accountId:account.id,isActive:true},select:{id:true,baseDurationMin:true,basePrice:true}});
 const specialist=await prisma.specialistProfile.findFirst({where:{accountId:account.id},select:{id:true}});
 const location=await prisma.location.findFirst({where:{accountId:account.id,status:'ACTIVE'},select:{id:true}});
 const src=new Date(Date.now()+35*24*60*60*1000); src.setUTCHours(12,0,0,0);
 const end=new Date(src.getTime()+service.baseDurationMin*60*1000);
 const appt=await prisma.appointment.create({data:{accountId:account.id,locationId:location.id,specialistId:specialist.id,clientId:client.id,startAt:src,endAt:end,status:'NEW',priceTotal:service.basePrice,durationTotalMin:service.baseDurationMin,source:'CHAT_TEST',services:{create:[{serviceId:service.id,price:service.basePrice,durationMin:service.baseDurationMin}]}} ,select:{id:true}});
 let t=0;
 for(const m of [`перенеси #${appt.id} на 2026-04-10 15:00`,`подтверждаю перенос #${appt.id} на 2026-04-10 15:00`,`какая у меня ближайшая запись`]){const o=await chat(cookie,t,m); if(!t)t=o.threadId; console.log('>',m); console.log('<',String(o.reply).replace(/\n/g,' '));}
 const u=await prisma.appointment.findUnique({where:{id:appt.id},select:{status:true,startAt:true}}); console.log('APPT',appt.id,u.status,u.startAt.toISOString());
 await prisma.$disconnect();
})();
