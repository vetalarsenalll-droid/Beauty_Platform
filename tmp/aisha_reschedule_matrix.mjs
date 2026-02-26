import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://localhost:3000';
const accountSlug = 'beauty-salon';

function parseCookies(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(/,(?=\s*\w+=)/g).map((x) => x.split(';')[0]).join('; ');
}

async function chat(cookie, threadId, message) {
  const res = await fetch(`${base}/api/v1/public/ai/chat?account=${accountSlug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ message, threadId }),
  });
  const json = await res.json();
  return json.data;
}

async function registerClient(tag) {
  const email = `${tag}_${Date.now()}@example.com`;
  const password = 'Passw0rd!123';
  const regRes = await fetch(`${base}/api/v1/auth/client/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, accountSlug, firstName: 'Flow', lastName: 'Tester' }),
  });
  const cookie = parseCookies(regRes.headers);
  return { email, cookie };
}

async function setupCtx(email) {
  const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
  const client = await prisma.client.findFirst({ where: { accountId: account.id, email }, select: { id: true } });
  const service = await prisma.service.findFirst({ where: { accountId: account.id, isActive: true }, select: { id: true, baseDurationMin: true, basePrice: true } });
  const specialist = await prisma.specialistProfile.findFirst({ where: { accountId: account.id }, select: { id: true } });
  const location = await prisma.location.findFirst({ where: { accountId: account.id, status: 'ACTIVE' }, select: { id: true } });
  return { account, client, service, specialist, location };
}

async function createAppt(ctx, startAt) {
  const endAt = new Date(startAt.getTime() + ctx.service.baseDurationMin * 60 * 1000);
  return prisma.appointment.create({
    data: {
      accountId: ctx.account.id,
      locationId: ctx.location.id,
      specialistId: ctx.specialist.id,
      clientId: ctx.client.id,
      startAt,
      endAt,
      status: 'NEW',
      priceTotal: ctx.service.basePrice,
      durationTotalMin: ctx.service.baseDurationMin,
      source: 'CHAT_TEST',
      services: { create: [{ serviceId: ctx.service.id, price: ctx.service.basePrice, durationMin: ctx.service.baseDurationMin }] },
    },
    select: { id: true, startAt: true },
  });
}

async function runScenario(title, cookie, turns) {
  let threadId = 0;
  console.log(`\n=== ${title} ===`);
  for (const t of turns) {
    const out = await chat(cookie, threadId, t);
    if (!threadId) threadId = out.threadId;
    console.log('>', t);
    console.log('<', String(out.reply).replace(/\n/g, ' '));
  }
}

(async () => {
  // scenario 1: reschedule without time
  {
    const { email, cookie } = await registerClient('rs_no_time');
    const ctx = await setupCtx(email);
    const st = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    st.setUTCHours(12, 0, 0, 0);
    await createAppt(ctx, st);
    await runScenario('reschedule_without_time', cookie, [
      'какая у меня ближайшая запись',
      'перенеси ее на 10 апреля',
    ]);
  }

  // scenario 2: blocked by reschedule window
  let oldWindow = null;
  {
    const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
    const settings = await prisma.accountSetting.findUnique({ where: { accountId: account.id }, select: { rescheduleWindowHours: true } });
    oldWindow = settings?.rescheduleWindowHours ?? null;
    await prisma.accountSetting.upsert({
      where: { accountId: account.id },
      update: { rescheduleWindowHours: 1000 },
      create: { accountId: account.id, rescheduleWindowHours: 1000 },
    });

    const { email, cookie } = await registerClient('rs_blocked');
    const ctx = await setupCtx(email);
    const st = new Date(Date.now() + 24 * 60 * 60 * 1000);
    st.setUTCHours(15, 0, 0, 0);
    const appt = await createAppt(ctx, st);
    await runScenario('reschedule_window_blocked', cookie, [
      'перенеси ближайшую запись на 2026-04-10 15:00',
      `подтверждаю перенос #${appt.id} на 2026-04-10 15:00`,
    ]);
  }

  // scenario 3: slot busy
  {
    const { email, cookie } = await registerClient('rs_busy');
    const ctx = await setupCtx(email);

    // target booking to move
    const src = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    src.setUTCHours(12, 0, 0, 0);
    const appt = await createAppt(ctx, src);

    // conflicting booking at target 2026-04-10 15:00 local => 12:00Z for UTC+3 demo data
    const conflictStart = new Date(Date.UTC(2026, 3, 10, 12, 0, 0));
    await createAppt(ctx, conflictStart);

    await runScenario('reschedule_slot_busy', cookie, [
      `перенеси #${appt.id} на 2026-04-10 15:00`,
      `подтверждаю перенос #${appt.id} на 2026-04-10 15:00`,
    ]);
  }

  // scenario 4: multiple upcoming; nearest/latest phrase
  {
    const { email, cookie } = await registerClient('rs_multi');
    const ctx = await setupCtx(email);

    const a = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    a.setUTCHours(12, 0, 0, 0);
    const b = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    b.setUTCHours(12, 0, 0, 0);
    const apptA = await createAppt(ctx, a);
    await createAppt(ctx, b);

    await runScenario('reschedule_nearest_of_multiple', cookie, [
      'перенеси ближайшую на 2026-04-12 15:00',
      `подтверждаю перенос #${apptA.id} на 2026-04-12 15:00`,
      'какая у меня ближайшая запись',
    ]);
  }

  // restore policy
  if (oldWindow !== null) {
    const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
    await prisma.accountSetting.update({ where: { accountId: account.id }, data: { rescheduleWindowHours: oldWindow } });
  }

  await prisma.$disconnect();
})();
