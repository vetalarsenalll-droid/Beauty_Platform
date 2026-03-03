const fs=require('fs');
const p='apps/web/app/api/v1/public/ai/chat/route.ts';
let c=fs.readFileSync(p,'utf8');

if(!c.includes('function hasKnownLocationNameInText(')){
  const anchor='function hasKnownServiceNameInText(text: string, services: ServiceLite[]) {';
  const idx=c.indexOf(anchor);
  if(idx<0) throw new Error('anchor service fn not found');
  const endMarker='function looksLikeServiceClaimInReply(text: string) {';
  const endIdx=c.indexOf(endMarker, idx);
  if(endIdx<0) throw new Error('end marker not found');
  const insert=`\nfunction hasKnownLocationNameInText(text: string, locations: LocationLite[]) {\n  const replyNorm = norm(text);\n  return locations.some((l) => {\n    const ln = norm(l.name);\n    const ad = norm(l.address ?? "");\n    return (ln && replyNorm.includes(ln)) || (ad && replyNorm.includes(ad));\n  });\n}\n\n`;
  c = c.slice(0,endIdx) + insert + c.slice(endIdx);
}

if(!c.includes('const consecutiveToxicTurns = countConsecutiveToxicUserTurns(recentMessages);')){
  const anchor='    const consecutiveNonBookingTurns = countConsecutiveNonBookingUserTurns(recentMessages);';
  c=c.replace(anchor, anchor + '\n    const consecutiveToxicTurns = countConsecutiveToxicUserTurns(recentMessages);');
}

fs.writeFileSync(p,c,'utf8');
console.log('OK');
