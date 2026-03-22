import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getLocationWorkWindowForDate,
  getAccountSlotStepMinutes,
  resolvePublicAccount,
  toMinutes,
  minutesToTime,
  getNowInTimeZone,
  parsePositiveInt,
  zonedDayRangeUtc,
  toZonedLocalMinutes,
} from "@/lib/public-booking";
import { BOOKING_HOLD_COOKIE, parseHoldProofToken } from "@/lib/public-booking-hold-proof";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 93;

type Window = { start: number; end: number };

function ymdInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // YYYY-MM-DD
}

function parseYmd(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, mo, d };
}

function addDaysYmd(ymd: string, days: number) {
  const p = parseYmd(ymd);
  if (!p) return null;
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0, 0)); // midday safe
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mergeWindows(list: Window[]) {
  const sorted = list
    .filter((w) => w.start < w.end)
    .sort((a, b) => a.start - b.start);

  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (!last || w.start > last.end) out.push({ ...w });
    else last.end = Math.max(last.end, w.end);
  }
  return out;
}

function ceilToStep(mins: number, step: number) {
  return Math.ceil(mins / step) * step;
}

function readCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) return "";
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return "";
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const slotStepMinutes = await getAccountSlotStepMinutes(resolved.account.id);
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);

  const locationId = parsePositiveInt(searchParams.get("locationId"));
  const serviceId = parsePositiveInt(searchParams.get("serviceId"));
  const specialistId = parsePositiveInt(searchParams.get("specialistId")); // optional
  const holdOwnerMarkerRaw = Number(searchParams.get("holdOwnerMarker"));
  const holdOwnerMarker = Number.isInteger(holdOwnerMarkerRaw) ? holdOwnerMarkerRaw : null;
  const holdProofToken = readCookieValue(request, BOOKING_HOLD_COOKIE);
  const holdProofPayload = parseHoldProofToken(holdProofToken);
  const ownProofHoldId =
    holdProofPayload && holdProofPayload.accountId === resolved.account.id
      ? holdProofPayload.holdId
      : null;

  const startYmd = String(searchParams.get("start") ?? "").trim() || nowTz.ymd;

  const daysParam = parsePositiveInt(searchParams.get("days"));
  const days = Math.min(Math.max(daysParam ?? DEFAULT_DAYS, 1), MAX_DAYS);

  if (!locationId || !serviceId) {
    return jsonError("INVALID_REQUEST", "Нужны locationId и serviceId.", null, 400);
  }

  const safeStart = startYmd < nowTz.ymd ? nowTz.ymd : startYmd;
  const endYmd = addDaysYmd(safeStart, days);
  if (!endYmd) {
    return jsonError("INVALID_DATE", "Некорректная дата start.", null, 400);
  }

  const startRange = zonedDayRangeUtc(safeStart, tz);
  const endRange = zonedDayRangeUtc(endYmd, tz);
  if (!startRange || !endRange) {
    return jsonError("INVALID_DATE", "Некорректный диапазон дат.", null, 400);
  }

  const rangeStartUtc = startRange.dayStartUtc;
  const rangeEndUtc = endRange.dayStartUtc;

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: {
      id: true,
      hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
      exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
    },
  });
  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      accountId: resolved.account.id,
      isActive: true,
      locations: { some: { locationId } },
    },
    select: {
      id: true,
      baseDurationMin: true,
      specialists: { select: { specialistId: true, durationOverrideMin: true } },
      levelConfigs: { select: { levelId: true, durationMin: true } },
    },
  });

  if (!service) {
    return jsonError("SERVICE_NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
      services: { some: { serviceId } },
      ...(specialistId ? { id: specialistId } : {}),
    },
    select: {
      id: true,
      levelId: true,
    },
  });

  if (!specialists.length) {
    return jsonOk({ start: safeStart, days: [] });
  }

  const specialistIds = specialists.map((s) => s.id);

  const [scheduleEntries, appointments, blockedSlots, holds] = await Promise.all([
    // ✅ ВАЖНО: ТОЛЬКО график выбранной локации (без locationId:null)
    prisma.scheduleEntry.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        date: { gte: rangeStartUtc, lt: rangeEndUtc },
        locationId,
      },
      include: { breaks: true },
    }),

    prisma.appointment.findMany({
      where: {
        accountId: resolved.account.id,
        locationId,
        specialistId: { in: specialistIds },
        startAt: { lt: rangeEndUtc },
        endAt: { gt: rangeStartUtc },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),

    prisma.blockedSlot.findMany({
      where: {
        accountId: resolved.account.id,
        startAt: { lt: rangeEndUtc },
        endAt: { gt: rangeStartUtc },
        OR: [{ locationId }, { specialistId: { in: specialistIds } }],
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),
    prisma.appointmentHold.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        expiresAt: { gt: new Date() },
        startAt: { lt: rangeEndUtc },
        endAt: { gt: rangeStartUtc },
        ...(holdOwnerMarker != null ? { clientId: { not: holdOwnerMarker } } : {}),
        ...(ownProofHoldId ? { id: { not: ownProofHoldId } } : {}),
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),
  ]);

  // schedule: ключ (specialistId + dayYmd) -> entry (теперь только по locationId)
  const scheduleBySpDay = new Map<string, (typeof scheduleEntries)[number]>();
  for (const entry of scheduleEntries) {
    const ymd = ymdInTz(entry.date, tz);
    const key = `${entry.specialistId}:${ymd}`;
    scheduleBySpDay.set(key, entry);
  }

  // appointments by (spId + ymd) in TZ
  const apptBySpDay = new Map<string, Window[]>();
  for (const appt of appointments) {
    const ymd = ymdInTz(appt.startAt, tz);
    const key = `${appt.specialistId}:${ymd}`;
    const list = apptBySpDay.get(key) ?? [];
    list.push({
      start: toZonedLocalMinutes(appt.startAt, tz),
      end: toZonedLocalMinutes(appt.endAt, tz),
    });
    apptBySpDay.set(key, list);
  }

  // blocked by (spId + ymd) — если specialistId null => location-wide на всех специалистов
  const blockedBySpDay = new Map<string, Window[]>();
  for (const blk of blockedSlots) {
    for (let i = 0; i < days; i++) {
      const ymd = addDaysYmd(safeStart, i);
      if (!ymd) continue;
      if (ymd < nowTz.ymd) continue;

      const dayRange = zonedDayRangeUtc(ymd, tz);
      if (!dayRange) continue;

      const start = Math.max(blk.startAt.getTime(), dayRange.dayStartUtc.getTime());
      const end = Math.min(blk.endAt.getTime(), dayRange.dayEndUtc.getTime());
      if (end <= start) continue;

      const startM = toZonedLocalMinutes(new Date(start), tz);
      const endM = toZonedLocalMinutes(new Date(end), tz);

      if (blk.specialistId) {
        const key = `${blk.specialistId}:${ymd}`;
        const list = blockedBySpDay.get(key) ?? [];
        list.push({ start: startM, end: endM });
        blockedBySpDay.set(key, list);
      } else {
        // location-wide
        for (const sp of specialists) {
          const key = `${sp.id}:${ymd}`;
          const list = blockedBySpDay.get(key) ?? [];
          list.push({ start: startM, end: endM });
          blockedBySpDay.set(key, list);
        }
      }
    }
  }

  for (const hold of holds) {
    for (let i = 0; i < days; i++) {
      const ymd = addDaysYmd(safeStart, i);
      if (!ymd) continue;
      if (ymd < nowTz.ymd) continue;

      const dayRange = zonedDayRangeUtc(ymd, tz);
      if (!dayRange) continue;

      const start = Math.max(hold.startAt.getTime(), dayRange.dayStartUtc.getTime());
      const end = Math.min(hold.endAt.getTime(), dayRange.dayEndUtc.getTime());
      if (end <= start) continue;

      const key = `${hold.specialistId}:${ymd}`;
      const list = blockedBySpDay.get(key) ?? [];
      list.push({
        start: toZonedLocalMinutes(new Date(start), tz),
        end: toZonedLocalMinutes(new Date(end), tz),
      });
      blockedBySpDay.set(key, list);
    }
  }

  // duration per specialist for this service
  const durationBySpecialist = new Map<number, number>();
  for (const sp of specialists) {
    const override =
      service.specialists.find((x) => x.specialistId === sp.id)?.durationOverrideMin ?? null;
    const levelCfg =
      service.levelConfigs.find((x) => x.levelId === sp.levelId)?.durationMin ?? null;
    const dur = override ?? levelCfg ?? service.baseDurationMin;
    if (Number.isFinite(dur) && dur > 0) durationBySpecialist.set(sp.id, dur);
  }

  // day -> minuteStart -> specialistIds
  const dayTimeMap = new Map<string, Map<number, Set<number>>>();

  for (let di = 0; di < days; di++) {
    const ymd = addDaysYmd(safeStart, di);
    if (!ymd) continue;
    if (ymd < nowTz.ymd) continue;
    const locationWindow = getLocationWorkWindowForDate(location, ymd);
    if (locationWindow.isClosed) continue;

    for (const sp of specialists) {
      const durationMin = durationBySpecialist.get(sp.id);
      if (!durationMin) continue;

      const entry = scheduleBySpDay.get(`${sp.id}:${ymd}`);
      if (!entry || entry.type !== "WORKING") continue;

      // доп. защита: entry должен быть именно по этой локации
      if (entry.locationId !== locationId) continue;

      const entryStart = toMinutes(entry.startTime ?? "");
      const entryEnd = toMinutes(entry.endTime ?? "");
      if (entryStart == null || entryEnd == null) continue;
      const effectiveStart = Math.max(entryStart, locationWindow.startMinutes);
      const effectiveEnd = Math.min(entryEnd, locationWindow.endMinutes);
      if (effectiveStart >= effectiveEnd) continue;

      const breaks = entry.breaks
        .map((b) => ({
          start: toMinutes(b.startTime) ?? 0,
          end: toMinutes(b.endTime) ?? 0,
        }))
        .filter((w) => w.start < w.end);

      const appts = apptBySpDay.get(`${sp.id}:${ymd}`) ?? [];
      const blks = blockedBySpDay.get(`${sp.id}:${ymd}`) ?? [];

      const blocked = mergeWindows(
        [...breaks, ...appts, ...blks]
          .map((w) => ({
            start: Math.max(effectiveStart, w.start),
            end: Math.min(effectiveEnd, w.end),
          }))
          .filter((w) => w.start < w.end)
      );

      // free segments
      let cursor = effectiveStart;
      const free: Window[] = [];
      for (const w of blocked) {
        if (w.start > cursor) free.push({ start: cursor, end: w.start });
        cursor = Math.max(cursor, w.end);
      }
      if (cursor < effectiveEnd) free.push({ start: cursor, end: effectiveEnd });

      // generate starts where service fits
      for (const seg of free) {
        let t = ceilToStep(seg.start, slotStepMinutes);
        for (; t + durationMin <= seg.end; t += slotStepMinutes) {
          // запрет прошедшего времени на сегодня
          if (ymd === nowTz.ymd && t <= nowTz.minutes) continue;

          const m = dayTimeMap.get(ymd) ?? new Map<number, Set<number>>();
          const set = m.get(t) ?? new Set<number>();
          set.add(sp.id);
          m.set(t, set);
          dayTimeMap.set(ymd, m);
        }
      }
    }
  }

  const outDays = Array.from(dayTimeMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
    .map(([date, timesMap]) => ({
      date,
      times: Array.from(timesMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([mins, spSet]) => ({
          time: minutesToTime(mins),
          specialistIds: Array.from(spSet).sort((a, b) => a - b),
        })),
    }))
    .filter((d) => d.times.length > 0);

  return jsonOk({
    start: safeStart,
    days: outDays,
  });
}
