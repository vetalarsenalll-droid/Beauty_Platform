import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const base = 'http://localhost:3000';
const accountSlug = 'beauty-salon';
function parseCookies(headers){ const raw=headers.get('set-cookie'); if(!raw) return ''; return raw.split(/,(?=\s*\w+=)/g).map(x=>x.split(';')[0]).join('; ');} 
async function chat(cookie, threadId, message){
  const res = await fetch(`${base}/api/v1/public/ai/chat?account=${accountSlug}`, {method:'POST', headers:{'content-type':'application/json', cookie}, body: JSON.stringify({message, threadId})});
  const json = await res.json();
  return json.data;
}
(async ()=>{
  const email = `diag_${Date.now()}@example.com`;
  const password='Passw0rd!123';
  const regRes=await fetch(`${base}/api/v1/auth/client/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,accountSlug,firstName:'Diag',lastName:'User'})});
  const cookie = parseCookies(regRes.headers);
  const account = await prisma.account.findUnique({ where:{slug: accountSlug}, select:{id:true} });
  const client = await prisma.client.findFirst({ where:{accountId: account.id, email}, select:{id:true} });
  const service = await prisma.service.findFirst({ where:{accountId: account.id, isActive:true}, select:{id:true,baseDurationMin:true,basePrice:true} });
  const specialist = await prisma.specialistProfile.findFirst({ where:{accountId: account.id}, select:{id:true} });
  const location = await prisma.location.findFirst({ where:{accountId: account.id, status:'ACTIVE'}, select:{id:true} });
  const startAt = new Date(Date.now() + 40*24*60*60*1000); startAt.setUTCHours(12,0,0,0); const endAt = new Date(startAt.getTime()+service.baseDurationMin*60000);
  await prisma.appointment.create({ data:{accountId:account.id,locationId:location.id,specialistId:specialist.id,clientId:client.id,startAt,endAt,status:'NEW',priceTotal:service.basePrice,durationTotalMin:service.baseDurationMin,source:'CHAT_TEST',services:{create:[{serviceId:service.id,price:service.basePrice,durationMin:service.baseDurationMin}]}}});

  let threadId = 0;
  for (const t of ['какая у меня ближайшая запись','отмени ее','подтверждаю отмену']) {
    const out = await chat(cookie, threadId, t);
    if(!threadId) threadId = out.threadId;
    const act = await prisma.aiAction.findFirst({ where:{threadId}, orderBy:{id:'desc'}, select:{payload:true} });
    const p = act?.payload || {};
    console.log('> ',t);
    console.log('< ',out.reply.replace(/\n/g,' '));
    console.log('intent=', p.intent, ' route=', p.route, ' nlu=', p.nluIntent, ' mapped=', p.mappedNluIntent);
  }
  await prisma.$disconnect();
})();
