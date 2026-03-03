const fs=require('fs');
const p='apps/web/app/api/v1/public/ai/chat/route.ts';
let c=fs.readFileSync(p,'utf8');

if(!c.includes('function countConsecutiveToxicUserTurns(')){
  c=c.replace(
`function countConsecutiveNonBookingUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const messageNorm = norm(m.content ?? "");
    if (isLikelyNonBookingTurn(messageNorm)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}
`,
`function countConsecutiveNonBookingUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const messageNorm = norm(m.content ?? "");
    if (isLikelyNonBookingTurn(messageNorm)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function countConsecutiveToxicUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const t = norm(m.content ?? "");
    if (/(сучк|сука|туп|идиот|дебил|нахер|нахуй|говно|херня)/i.test(t)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function buildToxicReply(level: number) {
  if (level >= 3) return "Остановлю разговор в таком тоне. Если захотите, вернемся к записи или вашим визитам.";
  if (level === 2) return "Понимаю эмоции, но давайте без оскорблений. Могу помочь по записи и услугам.";
  return "Понимаю, что вы раздражены. Давайте общаться уважительно, и я помогу по делу.";
}
`);
}

if(!c.includes('function hasKnownLocationNameInText(')){
  c=c.replace(
`function hasKnownServiceNameInText(text: string, services: ServiceLite[]) {
  const replyNorm = norm(text);
  return services.some((s) => {
    const serviceNorm = norm(s.name);
    if (!serviceNorm) return false;
    if (replyNorm.includes(serviceNorm)) return true;
    const tokens = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
    return tokens.some((t) => replyNorm.includes(t));
  });
}
`,
`function hasKnownServiceNameInText(text: string, services: ServiceLite[]) {
  const replyNorm = norm(text);
  return services.some((s) => {
    const serviceNorm = norm(s.name);
    if (!serviceNorm) return false;
    if (replyNorm.includes(serviceNorm)) return true;
    const tokens = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
    return tokens.some((t) => replyNorm.includes(t));
  });
}

function hasKnownLocationNameInText(text: string, locations: LocationLite[]) {
  const replyNorm = norm(text);
  return locations.some((l) => {
    const ln = norm(l.name);
    const ad = norm(l.address ?? "");
    return (ln && replyNorm.includes(ln)) || (ad && replyNorm.includes(ad));
  });
}
`);
}

if(!c.includes('options.push({ label: "Мои записи", value: "какие у меня записи" });\n  } else {')){
  c=c.replace(
'    options.push({ label: `Показать специалистов на ${dateLabel}`, value: `какие специалисты доступны на ${dateLabel}` });',
'    options.push({ label: `Показать специалистов на ${dateLabel}`, value: `какие специалисты доступны на ${dateLabel}` });\n    options.push({ label: "Мои записи", value: "какие у меня записи" });'
  );
}

if(!c.includes('const consecutiveToxicTurns = countConsecutiveToxicUserTurns(recentMessages);')){
  c=c.replace(
`    const consecutiveNonBookingTurns = countConsecutiveNonBookingUserTurns(recentMessages);
    const hasBookingVerbCue = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|хочу|сделать|оформи\p{L}*|заброни\p{L}*|бронь)/iu);`,
`    const consecutiveNonBookingTurns = countConsecutiveNonBookingUserTurns(recentMessages);
    const consecutiveToxicTurns = countConsecutiveToxicUserTurns(recentMessages);
    const hasBookingVerbCue = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|хочу|сделать|оформи\p{L}*|заброни\p{L}*|бронь)/iu);`
  );
}

c=c.replace(
`      } else if (intent === "abuse_or_toxic") {
        reply = "Давайте общаться уважительно. Я помогу с записью и вопросами по услугам.";`,
`      } else if (intent === "abuse_or_toxic") {
        reply = buildToxicReply(consecutiveToxicTurns);
        if (consecutiveToxicTurns >= 2) {
          nextUi = buildChatOnlyActionUi();
        }`
);

if(!c.includes('const looksLikeLocationClaimInReply = /(?:адрес|филиал|локац|находим|находится|находитесь)/i.test(norm(reply));')){
  c=c.replace(
`    reply = sanitizeAssistantReplyText(reply);
    if (route === "chat-only" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {`,
`    reply = sanitizeAssistantReplyText(reply);
    const looksLikeLocationClaimInReply = /(?:адрес|филиал|локац|находим|находится|находитесь)/i.test(norm(reply));
    if (route === "chat-only" && !explicitDateTimeQuery && looksLikeLocationClaimInReply && locations.length > 0 && !hasKnownLocationNameInText(reply, locations)) {
      reply = "По локациям покажу только актуальные данные аккаунта. Выберите филиал кнопкой ниже.";
      nextUi = { kind: "quick_replies", options: locations.map((x) => ({ label: x.name, value: x.name })) };
    }
    if (route === "chat-only" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {`
  );
}

fs.writeFileSync(p,c,'utf8');
console.log('OK');
