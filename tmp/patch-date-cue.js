const fs = require('fs');
const p = 'apps/web/app/api/v1/public/ai/chat/route.ts';
let c = fs.readFileSync(p, 'utf8');

const anchor1 = `    const explicitDateBookingRequest =
      explicitBookingStartByDatePhrase ||
      (explicitCalendarCue && has(messageForRouting, /(запиш\\p{L}*|записа\\p{L}*|оформи\\p{L}*|заброни\\p{L}*|хочу)/iu));`;
const insert1 = `${anchor1}
    const explicitStandaloneDateBookingCue =
      !hasDraftContextEarly &&
      !explicitDateTimeQuery &&
      !has(messageForRouting, /(мои записи|мою запись|статист|профил|кабинет|отмени|перенеси)/i) &&
      (/^\\s*(?:на\\s+)?(?:сегодня|завтра|послезавтра)\\s*$/iu.test(messageForRouting) || explicitDateOnlyInput);`;
if (!c.includes('const explicitStandaloneDateBookingCue')) {
  if (!c.includes(anchor1)) throw new Error('anchor1 not found');
  c = c.replace(anchor1, insert1);
}

const anchor2 = `    if (hasDraftContextEarly && d.locationId && d.serviceId && !d.time && explicitDateOnlyInput) intent = "booking_start";
    if (explicitDateBookingRequest) intent = "booking_start";`;
const insert2 = `${anchor2}
    if (explicitStandaloneDateBookingCue) intent = "booking_start";`;
if (!c.includes('if (explicitStandaloneDateBookingCue) intent = "booking_start";')) {
  if (!c.includes(anchor2)) throw new Error('anchor2 not found');
  c = c.replace(anchor2, insert2);
}

fs.writeFileSync(p, c, 'utf8');
console.log('OK');
