const fs = require('fs');
const p = 'apps/web/app/api/v1/public/ai/chat/route.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  '/^(кто|что|почему|зачем|как|сколько|где|когда|какой|какая|какие|какую)\\b/i.test(messageNorm) ||',
  '/^(кто|что|почему|зачем|как|сколько|где|когда|какой|какая|какие|какую|в чем|о чем)\\b/i.test(messageNorm) ||'
);

const from = `    const isChatOnlyGeneralTurn = route === "chat-only" && !hasDraftContext && !isBookingOrAccountCue(t);
    const shouldHardReturnToDomain =
      isChatOnlyGeneralTurn &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !explicitDateTimeQuery &&
      consecutiveNonBookingTurns >= 3;`;

const to = `    const isChatOnlyGeneralTurn = route === "chat-only" && !hasDraftContext && !isBookingOrAccountCue(t);
    const isClarifyingFollowUpTurn =
      isChatOnlyGeneralTurn &&
      /(?:в\s+ч[её]м\b|о\s+ч[её]м\b|что\s+име(?:л|ла)\s+в\s+виду|поясни|объясни|расшифруй)/iu.test(t) &&
      !isBookingOrAccountCue(norm(lastAssistantText));
    const shouldHardReturnToDomain =
      isChatOnlyGeneralTurn &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !explicitDateTimeQuery &&
      consecutiveNonBookingTurns >= 3 &&
      !isClarifyingFollowUpTurn;`;

if (!c.includes(from)) throw new Error('hard-return block not found');
c = c.replace(from, to);

fs.writeFileSync(p, c, 'utf8');
console.log('OK');
