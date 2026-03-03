const fs=require('fs');
const p='apps/web/app/api/v1/public/ai/chat/route.ts';
let c=fs.readFileSync(p,'utf8');

// 1) Add explicit clarification reply in out-of-scope helper
const marker='  if (/(кто убил кеннед|убил кенеди|убийств.*кеннед)/i.test(messageNorm)) {';
if(!c.includes('в чем смысл') && c.includes(marker)){
  const insert=`  if (/(в\\s+ч[её]м\\s+смысл|смысл\\s+ан[еэ]гдот|объясни\\s+шутк|поясни\\s+шутк)/i.test(messageNorm)) {\n    return "Смысл обычно в игре слов: это лёгкая шутка без скрытого подтекста. Если хотите, расскажу ещё одну покороче.";\n  }\n`;
  c=c.replace(marker, insert+marker);
}

// 2) Make hard return less aggressive (from 3rd to 4th off-topic turn)
c=c.replace('      consecutiveNonBookingTurns >= 3 &&','      consecutiveNonBookingTurns >= 4 &&');

fs.writeFileSync(p,c,'utf8');
console.log('OK');
