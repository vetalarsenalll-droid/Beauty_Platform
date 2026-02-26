import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const norm=(v)=>v.toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}\s:.+\-/]/gu,' ').replace(/\s+/g,' ').trim();
const msg='хочу на педикюр';
const services=await prisma.service.findMany({where:{accountId:3,isActive:true},select:{id:true,name:true}});
const found=services.find((x)=>/pedicure|педик/.test(norm(x.name)));
console.log('found',found);
console.log('msg pedik',/педик/.test(norm(msg)));
await prisma.$disconnect();
