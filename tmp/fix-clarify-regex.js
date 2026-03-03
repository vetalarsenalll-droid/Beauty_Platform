const fs = require('fs');
const p = 'apps/web/app/api/v1/public/ai/chat/route.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /const isClarifyingFollowUpTurn =[\s\S]*?!isBookingOrAccountCue\(norm\(lastAssistantText\)\);/,
`const isClarifyingFollowUpTurn =
      isChatOnlyGeneralTurn &&
      /(?:в\s+ч[её]м\b|о\s+ч[её]м\b|что\s+име(?:л|ла)\s+в\s+виду|поясни|объясни|расшифруй)/iu.test(t) &&
      !isBookingOrAccountCue(norm(lastAssistantText));`
);

fs.writeFileSync(p, c, 'utf8');
console.log('OK');
