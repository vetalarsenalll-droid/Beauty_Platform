import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const baseUrl = args.get("base") ?? process.env.AISHA_LIVE_BASE_URL ?? "http://localhost:3000";
const accountSlug = args.get("account") ?? process.env.AISHA_LIVE_ACCOUNT ?? "severnaya-orhideya";
const publicPath = args.get("path") ?? process.env.AISHA_LIVE_PUBLIC_PATH ?? "/severnaya-orhideya_2/booking";
const todayYmd = args.get("today") ?? process.env.AISHA_LIVE_TODAY ?? new Date().toISOString().slice(0, 10);

const checks = [];
const cleanup = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function api(path, opts = {}) {
  const response = await fetch(`${baseUrl}${path}`, opts);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    status: response.status,
    json,
    text,
    setCookie: response.headers.get("set-cookie") ?? "",
  };
}

async function chat(message) {
  const clientRequestId = `live-e2e-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return api(`/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": clientRequestId,
    },
    body: JSON.stringify({
      message,
      clientRequestId,
      clientTodayYmd: todayYmd,
      clientTimeZone: "Europe/Moscow",
    }),
  });
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=\s*[^;,]+=)/)
    .map((item) => item.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function findBookableSlot(account, bootstrap) {
  const locations = bootstrap.locations ?? [];
  const services = (bootstrap.services ?? []).filter((service) => service.bookingType !== "GROUP");
  for (const service of services.slice(0, 20)) {
    for (const locationId of service.locationIds ?? []) {
      if (!locations.some((location) => location.id === locationId)) continue;
      for (let offset = 1; offset <= 21; offset += 1) {
        const date = addDaysYmd(todayYmd, offset);
        const slots = await api(
          `/api/v1/public/booking/slots?account=${encodeURIComponent(account.slug)}&locationId=${locationId}&serviceIds=${service.id}&date=${date}`,
        );
        const firstSlot = slots.json?.data?.slots?.[0];
        if (slots.status === 200 && firstSlot?.time && firstSlot?.specialistId) {
          return {
            locationId,
            serviceId: service.id,
            date,
            time: firstSlot.time,
            specialistId: firstSlot.specialistId,
          };
        }
      }
    }
  }
  return null;
}

async function cleanupAppointment(appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clientId: true },
  });
  await prisma.$transaction([
    prisma.legalAcceptance.deleteMany({ where: { appointmentId } }),
    prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId } }),
    prisma.appointmentService.deleteMany({ where: { appointmentId } }),
    prisma.onlineBookingSession.deleteMany({ where: { appointmentId } }),
    prisma.appointment.deleteMany({ where: { id: appointmentId } }),
  ]);
  if (appointment?.clientId) {
    const remaining = await prisma.appointment.count({ where: { clientId: appointment.clientId } });
    if (remaining === 0) {
      await prisma.client.deleteMany({
        where: { id: appointment.clientId, phone: { startsWith: "+7999000" } },
      });
    }
  }
}

async function runBookingE2e(account, bootstrap) {
  const slot = await findBookableSlot(account, bootstrap);
  check("booking e2e found an available public slot", Boolean(slot), "No free slot found in next 21 days");
  if (!slot) return;

  const hold = await api(`/api/v1/public/booking/holds?account=${encodeURIComponent(account.slug)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      locationId: slot.locationId,
      serviceIds: [slot.serviceId],
      specialistId: slot.specialistId,
      date: slot.date,
      time: slot.time,
    }),
  });
  const holdId = hold.json?.data?.holdId;
  const cookieHeader = cookieHeaderFromSetCookie(hold.setCookie);
  check("booking e2e creates a hold", hold.status === 200 && Number.isInteger(holdId) && cookieHeader, JSON.stringify(hold.json ?? hold.text));
  if (!holdId || !cookieHeader) return;

  const requiredVersionIds = (bootstrap.legalDocuments ?? [])
    .filter((doc) => doc.isRequired && Number.isInteger(doc.versionId))
    .map((doc) => doc.versionId);
  const requestId = `live-e2e-booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clientEmail = `aisha-e2e-${Date.now()}@example.test`;
  const appointmentBody = {
    locationId: slot.locationId,
    serviceIds: [slot.serviceId],
    specialistId: slot.specialistId,
    date: slot.date,
    time: slot.time,
    holdId,
    clientName: "Aisha E2E",
    clientPhone: "+79990000001",
    clientEmail,
    legalVersionIds: requiredVersionIds,
    comment: "temporary live E2E appointment",
  };
  const appointment = await api(`/api/v1/public/booking/appointments?account=${encodeURIComponent(account.slug)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify(appointmentBody),
  });
  const appointmentId = appointment.json?.data?.appointmentId;
  check(
    "booking e2e creates an appointment",
    appointment.status === 200 && Number.isInteger(appointmentId),
    JSON.stringify(appointment.json ?? appointment.text),
  );
  if (!appointmentId) return;
  cleanup.push(() => cleanupAppointment(appointmentId));

  const replay = await api(`/api/v1/public/booking/appointments?account=${encodeURIComponent(account.slug)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify(appointmentBody),
  });
  check("booking e2e replays duplicate appointment request", replay.status === 200 && replay.json?.data?.appointmentId === appointmentId);
}

async function createHiddenSpecialistFixture(account, bootstrap) {
  const location = bootstrap.locations?.[0];
  const sourceService = (bootstrap.services ?? []).find((service) => service.locationIds?.includes(location?.id));
  if (!location || !sourceService) return null;
  const marker = `aisha-hidden-e2e-${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      email: `${marker}@example.test`,
      status: "ACTIVE",
      type: "STAFF",
      profile: { create: { firstName: "Hidden", lastName: "E2E" } },
    },
    select: { id: true },
  });
  const specialist = await prisma.specialistProfile.create({
    data: {
      accountId: account.id,
      userId: user.id,
      isPublic: false,
      bio: "Temporary hidden E2E specialist",
    },
    select: { id: true },
  });
  const groupService = await prisma.service.create({
    data: {
      accountId: account.id,
      name: `${marker}-group`,
      description: "Temporary hidden E2E group service",
      baseDurationMin: 45,
      basePrice: 1000,
      isActive: true,
      bookingType: "GROUP",
      groupCapacityDefault: 4,
    },
    select: { id: true },
  });
  const date = addDaysYmd(todayYmd, 10);
  const startAt = new Date(`${date}T07:00:00.000Z`);
  const endAt = new Date(`${date}T08:00:00.000Z`);

  await prisma.$transaction([
    prisma.specialistLocation.create({ data: { specialistId: specialist.id, locationId: location.id } }),
    prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: sourceService.id } }),
    prisma.serviceLocation.create({ data: { serviceId: groupService.id, locationId: location.id } }),
    prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: groupService.id } }),
    prisma.scheduleEntry.create({
      data: {
        accountId: account.id,
        locationId: location.id,
        specialistId: specialist.id,
        date: new Date(`${date}T00:00:00.000Z`),
        type: "WORKING",
        startTime: "10:00",
        endTime: "20:00",
      },
    }),
    prisma.groupSession.create({
      data: {
        accountId: account.id,
        locationId: location.id,
        specialistId: specialist.id,
        serviceId: groupService.id,
        startAt,
        endAt,
        capacity: 4,
        bookedCount: 0,
        status: "NEW",
        source: "aisha-live-e2e",
      },
    }),
  ]);

  cleanup.push(async () => {
    await prisma.groupSession.deleteMany({ where: { specialistId: specialist.id } });
    await prisma.scheduleEntry.deleteMany({ where: { specialistId: specialist.id } });
    await prisma.specialistService.deleteMany({ where: { specialistId: specialist.id } });
    await prisma.serviceLocation.deleteMany({ where: { serviceId: groupService.id } });
    await prisma.service.deleteMany({ where: { id: groupService.id } });
    await prisma.specialistLocation.deleteMany({ where: { specialistId: specialist.id } });
    await prisma.specialistProfile.deleteMany({ where: { id: specialist.id } });
    await prisma.userProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  return {
    locationId: location.id,
    serviceId: sourceService.id,
    groupServiceId: groupService.id,
    specialistId: specialist.id,
    date,
  };
}

async function runHiddenSpecialistE2e(account, bootstrap) {
  const fixture = await createHiddenSpecialistFixture(account, bootstrap);
  check("hidden specialist fixture created", Boolean(fixture));
  if (!fixture) return;
  const [bootstrapAgain, locSpecs, slots, calendar, groupSessions, groupAvailability] = await Promise.all([
    api(`/api/v1/public/booking/bootstrap?account=${encodeURIComponent(account.slug)}`),
    api(`/api/v1/public/booking/locations/${fixture.locationId}/specialists?account=${encodeURIComponent(account.slug)}&serviceIds=${fixture.serviceId}`),
    api(`/api/v1/public/booking/slots?account=${encodeURIComponent(account.slug)}&locationId=${fixture.locationId}&serviceIds=${fixture.serviceId}&date=${fixture.date}&specialistId=${fixture.specialistId}`),
    api(`/api/v1/public/booking/availability/calendar?account=${encodeURIComponent(account.slug)}&locationId=${fixture.locationId}&serviceIds=${fixture.serviceId}&from=${fixture.date}&days=3&specialistId=${fixture.specialistId}`),
    api(`/api/v1/public/booking/group-sessions?account=${encodeURIComponent(account.slug)}&locationId=${fixture.locationId}&date=${fixture.date}&specialistId=${fixture.specialistId}`),
    api(`/api/v1/public/booking/group-sessions/availability?account=${encodeURIComponent(account.slug)}&locationId=${fixture.locationId}&serviceId=${fixture.groupServiceId}&start=${fixture.date}&days=3&specialistId=${fixture.specialistId}`),
  ]);
  const bootstrapIds = bootstrapAgain.json?.data?.specialists?.map((item) => item.id) ?? [];
  const locSpecIds = locSpecs.json?.data?.specialists?.map((item) => item.id) ?? [];
  const calendarText = JSON.stringify(calendar.json?.data ?? {});
  check("hidden specialist absent from bootstrap", bootstrapAgain.status === 200 && !bootstrapIds.includes(fixture.specialistId));
  check("hidden specialist absent from location specialists", locSpecs.status === 200 && !locSpecIds.includes(fixture.specialistId));
  check("hidden specialist has no public slots", slots.status === 200 && (slots.json?.data?.slots?.length ?? 0) === 0);
  check("hidden specialist absent from calendar availability", calendar.status === 200 && !calendarText.includes(`:${fixture.specialistId}`) && !calendarText.includes(`\"${fixture.specialistId}\"`));
  check("hidden specialist absent from group sessions", groupSessions.status === 200 && (groupSessions.json?.data?.sessions?.length ?? 0) === 0);
  check("hidden specialist absent from group availability", groupAvailability.status === 200 && (groupAvailability.json?.data?.days?.length ?? 0) === 0, JSON.stringify(groupAvailability.json?.data ?? groupAvailability.text));
}

async function runChatFailureAndSecurityE2e() {
  const dateReply = await chat("какое сегодня число и время");
  check("chat date/time route returns without generic CTA", dateReply.status === 200 && dateReply.json?.data?.ui == null);

  const priceReply = await chat("сколько стоит маникюр");
  const priceDraft = priceReply.json?.data?.draft ?? {};
  check(
    "chat-only price does not mutate draft identifiers",
    priceReply.status === 200 && priceDraft.locationId == null && priceDraft.serviceId == null && priceDraft.specialistId == null,
  );

  const myBookings = await chat("покажи мои записи");
  check(
    "anonymous client-actions prompts login without PII",
    myBookings.status === 200 && myBookings.json?.data?.ui?.kind === "quick_replies" && JSON.stringify(myBookings.json?.data?.ui).includes("/c/login"),
  );

  const cancel = await chat("подтверждаю отмену #123");
  check("cancel without signed pending action is refused", cancel.status === 200 && /Сначала|выберите|действие|кнопк/i.test(cancel.json?.data?.reply ?? ""));
}

async function runBrowserE2e() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const pageErrors = [];
      const hydrationErrors = [];
      const page = await browser.newPage({ viewport });
      page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && /hydrated|hydration|server rendered HTML/i.test(message.text())) {
          hydrationErrors.push(message.text());
        }
      });
      await page.goto(`${baseUrl}${publicPath}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await page.locator('button[aria-label="Открыть AI-ассистента"]').click();
      await page.getByText("AI-ассистент записи").waitFor({ timeout: 15000 });
      const input = page.getByPlaceholder("Введите сообщение");
      await input.waitFor({ timeout: 10000 });
      const inputBox = await input.boundingBox();
      check(`${viewport.name} widget input enabled`, await input.isEnabled());
      check(
        `${viewport.name} widget input fits viewport`,
        Boolean(inputBox) &&
          inputBox.x >= 0 &&
          inputBox.y >= 0 &&
          inputBox.x + inputBox.width <= viewport.width + 2 &&
          inputBox.y + inputBox.height <= viewport.height + 2,
        JSON.stringify(inputBox),
      );
      await input.fill("привет");
      await input.press("Enter");
      await page.waitForTimeout(5000);
      check(`${viewport.name} widget keeps POST reply in history`, (await page.getByText(/Привет|Здравствуйте|настроение/i).count()) > 0);
      check(`${viewport.name} widget renders backend quick replies`, (await page.locator("button", { hasText: /Записаться|Показать|Мои записи/ }).count()) > 0);
      await page.getByText("Новый диалог").click({ force: true });
      await page.waitForTimeout(1800);
      check(`${viewport.name} widget new dialog resets state`, (await input.isEnabled()) && (await page.getByText(/Здравствуйте|Ассистент/i).count()) > 0);
      check(`${viewport.name} widget has no page errors`, pageErrors.length === 0, pageErrors.join("\n"));
      check(`${viewport.name} widget has no hydration errors`, hydrationErrors.length === 0, hydrationErrors.join("\n").slice(0, 500));
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const bootstrapResponse = await api(`/api/v1/public/booking/bootstrap?account=${encodeURIComponent(accountSlug)}`);
    const bootstrap = bootstrapResponse.json?.data;
    check("live bootstrap returns public catalog", bootstrapResponse.status === 200 && bootstrap?.account && bootstrap?.locations?.length && bootstrap?.services?.length && bootstrap?.specialists?.length);
    if (!bootstrap?.account) return;

    await runChatFailureAndSecurityE2e();
    await runBookingE2e(bootstrap.account, bootstrap);
    await runHiddenSpecialistE2e(bootstrap.account, bootstrap);
    await runBrowserE2e();
  } catch (error) {
    check("live E2E runner crashed", false, error.stack || String(error));
  } finally {
    for (const fn of cleanup.reverse()) {
      try {
        await fn();
      } catch (error) {
        check("live E2E cleanup failed", false, error.stack || String(error));
      }
    }
    await prisma.$disconnect();
  }

  for (const item of checks) {
    console.log(`[${item.ok ? "ok" : "FAIL"}] ${item.name}${!item.ok && item.detail ? ` - ${item.detail}` : ""}`);
  }
  const failed = checks.filter((item) => !item.ok);
  if (failed.length) {
    console.error(`[aisha-live-e2e] ${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(`[aisha-live-e2e] passed ${checks.length} checks.`);
}

await main();
