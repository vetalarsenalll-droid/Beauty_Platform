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
    body: JSON.stringify({ email, password, accountSlug, firstName: 'Flow', lastName: 'Cancel' }),
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
    select: { id: true, status: true, startAt: true },
  });
}

async function run(title, cookie, turns) {
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
  // 1) cancel nearest by pronoun + bare confirmation
  {
    const { email, cookie } = await registerClient('c_cancel_nearest');
    const ctx = await setupCtx(email);
    const a = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    a.setUTCHours(12, 0, 0, 0);
    const b = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    b.setUTCHours(12, 0, 0, 0);
    const apptA = await createAppt(ctx, a);
    await createAppt(ctx, b);
    await run('cancel_pronoun_bare_confirm', cookie, [
      'какая у меня ближайшая запись',
      'отмени ее',
      'подтверждаю',
      'какая у меня ближайшая запись',
    ]);
    const row = await prisma.appointment.findUnique({ where: { id: apptA.id }, select: { status: true } });
    console.log('CHECK STATUS nearest:', apptA.id, row?.status);
  }

  // 2) cancel latest keyword
  {
    const { email, cookie } = await registerClient('c_cancel_latest');
    const ctx = await setupCtx(email);
    const a = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    a.setUTCHours(12, 0, 0, 0);
    const appt = await createAppt(ctx, a);
    await run('cancel_latest_keyword', cookie, [
      'отмени последнюю запись',
      `подтверждаю отмену #${appt.id}`,
      'какая у меня ближайшая запись',
    ]);
  }

  // 3) cancel by direct id
  {
    const { email, cookie } = await registerClient('c_cancel_id');
    const ctx = await setupCtx(email);
    const a = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
    a.setUTCHours(12, 0, 0, 0);
    const appt = await createAppt(ctx, a);
    await run('cancel_by_id', cookie, [
      `отмени #${appt.id}`,
      'подтверждаю',
      'какая у меня ближайшая запись',
    ]);
  }

  // 4) cancel blocked by cancellation window
  let oldCancelWindow = null;
  {
    const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
    const settings = await prisma.accountSetting.findUnique({ where: { accountId: account.id }, select: { cancellationWindowHours: true } });
    oldCancelWindow = settings?.cancellationWindowHours ?? null;
    await prisma.accountSetting.upsert({
      where: { accountId: account.id },
      update: { cancellationWindowHours: 1000 },
      create: { accountId: account.id, cancellationWindowHours: 1000 },
    });

    const { email, cookie } = await registerClient('c_cancel_blocked');
    const ctx = await setupCtx(email);
    const a = new Date(Date.now() + 24 * 60 * 60 * 1000);
    a.setUTCHours(14, 0, 0, 0);
    const appt = await createAppt(ctx, a);
    await run('cancel_window_blocked', cookie, [
      'отмени ближайшую',
      `подтверждаю отмену #${appt.id}`,
    ]);
  }

  // restore cancel policy
  if (oldCancelWindow !== null) {
    const account = await prisma.account.findUnique({ where: { slug: accountSlug }, select: { id: true } });
    await prisma.accountSetting.update({ where: { accountId: account.id }, data: { cancellationWindowHours: oldCancelWindow } });
  }

  await prisma.$disconnect();
})();
