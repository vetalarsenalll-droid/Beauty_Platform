import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getAccountSlotStepMinutes,
  resolvePublicAccount,
  toMinutes,
  minutesToTime,
  toZonedLocalMinutes,
  zonedDayRangeUtc,
  parsePositiveInt,
  getNowInTimeZone,
} from "@/lib/public-booking";

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

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

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const slotStepMinutes = await getAccountSlotStepMinutes(resolved.account.id);
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);
  const locationId = parsePositiveInt(searchParams.get("locationId"));
  const dateValue = String(searchParams.get("date") ?? "").trim();
  const excludeAppointmentId = parsePositiveInt(searchParams.get("excludeAppointmentId"));

  if (!locationId || !dateValue) {
    return jsonError("INVALID_REQUEST", "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹.", null, 400);
  }

  // past date => РїСѓСЃС‚Рѕ
  if (dateValue < nowTz.ymd) return jsonOk({ date: dateValue, times: [] });

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) return jsonError("INVALID_DATE", "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РґР°С‚Р°.", null, 400);
  const { dayStartUtc, dayEndUtc } = range;

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!location) return jsonError("LOCATION_NOT_FOUND", "Р›РѕРєР°С†РёСЏ РЅРµ РЅР°Р№РґРµРЅР°.", null, 404);

  // СЃРїРµС†РёР°Р»РёСЃС‚С‹ Р»РѕРєР°С†РёРё + РёС… СѓСЃР»СѓРіРё
  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
    },
    select: {
      id: true,
      levelId: true,
      services: { select: { serviceId: true } },
    },
  });

  if (!specialists.length) return jsonOk({ date: dateValue, times: [] });

  const specialistIds = specialists.map((s) => s.id);

  const allServiceIds = Array.from(
    new Set(specialists.flatMap((s) => s.services.map((x) => x.serviceId)))
  );

  if (!allServiceIds.length) return jsonOk({ date: dateValue, times: [] });

  // СѓСЃР»СѓРіРё (РґР»СЏ СЂР°СЃС‡С‘С‚Р° РґР»РёС‚РµР»СЊРЅРѕСЃС‚РµР№)
  const services = await prisma.service.findMany({
    where: {
      accountId: resolved.account.id,
      isActive: true,
      id: { in: allServiceIds },
      locations: { some: { locationId } },
    },
    select: {
      id: true,
      baseDurationMin: true,
      specialists: { select: { specialistId: true, durationOverrideMin: true } },
      levelConfigs: { select: { levelId: true, durationMin: true } },
    },
  });

  const serviceById = new Map<number, (typeof services)[number]>();
  for (const s of services) serviceById.set(s.id, s);

  // РіСЂР°С„РёРє + Р·Р°РїРёСЃРё + Р±Р»РѕРєРёСЂРѕРІРєРё
  const [scheduleEntries, appointments, blockedSlots, holds] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        date: { gte: dayStartUtc, lt: dayEndUtc },
        locationId,
      },
      include: { breaks: true },
    }),
    prisma.appointment.findMany({
      where: {
        accountId: resolved.account.id,
        locationId,
        specialistId: { in: specialistIds },
        startAt: { gte: dayStartUtc, lt: dayEndUtc },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),
    prisma.blockedSlot.findMany({
      where: {
        accountId: resolved.account.id,
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
        OR: [{ locationId }, { specialistId: { in: specialistIds } }],
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),
    prisma.appointmentHold.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        expiresAt: { gt: new Date() },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),
  ]);

  // РіСЂР°С„РёРє locationId > null
  const scheduleBySpecialist = new Map<number, (typeof scheduleEntries)[number]>();
  for (const e of scheduleEntries) scheduleBySpecialist.set(e.specialistId, e);

  const apptBySp = new Map<number, Window[]>();
  for (const a of appointments) {
    const list = apptBySp.get(a.specialistId) ?? [];
    list.push({
      start: toZonedLocalMinutes(a.startAt, tz),
      end: toZonedLocalMinutes(a.endAt, tz),
    });
    apptBySp.set(a.specialistId, list);
  }

  const blkBySp = new Map<number, Window[]>();
  for (const b of blockedSlots) {
    const w = {
      start: toZonedLocalMinutes(b.startAt, tz),
      end: toZonedLocalMinutes(b.endAt, tz),
    };
    if (b.specialistId) {
      const list = blkBySp.get(b.specialistId) ?? [];
      list.push(w);
      blkBySp.set(b.specialistId, list);
    } else {
      // location-wide -> РІСЃРµРј
      for (const sp of specialists) {
        const list = blkBySp.get(sp.id) ?? [];
        list.push(w);
        blkBySp.set(sp.id, list);
      }
    }
  }

  const holdsBySp = new Map<number, Window[]>();
  for (const item of holds) {
    const list = holdsBySp.get(item.specialistId) ?? [];
    list.push({
      start: toZonedLocalMinutes(item.startAt, tz),
      end: toZonedLocalMinutes(item.endAt, tz),
    });
    holdsBySp.set(item.specialistId, list);
  }

  // Р’Р«РҐРћР”: time -> serviceId -> specialistIds
  const offers = new Map<number, Map<number, Set<number>>>();

  for (const sp of specialists) {
    const entry = scheduleBySpecialist.get(sp.id);
    if (!entry || entry.type !== "WORKING") continue;
    if (entry.locationId !== locationId) continue;

    const entryStart = toMinutes(entry.startTime ?? "");
    const entryEnd = toMinutes(entry.endTime ?? "");
    if (entryStart == null || entryEnd == null) continue;

    // РєР°РєРёРµ СѓСЃР»СѓРіРё Сѓ СЌС‚РѕРіРѕ СЃРїРµС†Р°
    const spServiceIds = sp.services.map((x) => x.serviceId).filter((id) => serviceById.has(id));
    if (!spServiceIds.length) continue;

    // precompute durations for sp/service
    const durationByService = new Map<number, number>();
    for (const sid of spServiceIds) {
      const srv = serviceById.get(sid);
      if (!srv) continue;
      const override = srv.specialists.find((x) => x.specialistId === sp.id)?.durationOverrideMin ?? null;
      const levelCfg = srv.levelConfigs.find((x) => x.levelId === sp.levelId)?.durationMin ?? null;
      const dur = override ?? levelCfg ?? srv.baseDurationMin;
      if (Number.isFinite(dur) && dur > 0) durationByService.set(sid, dur);
    }
    if (!durationByService.size) continue;

    // blocked windows (breaks + appt + blocks)
    const breaks = entry.breaks
      .map((br) => ({
        start: toMinutes(br.startTime) ?? 0,
        end: toMinutes(br.endTime) ?? 0,
      }))
      .filter((w) => w.start < w.end);

    const appts = apptBySp.get(sp.id) ?? [];
    const blks = blkBySp.get(sp.id) ?? [];
    const holdsWindows = holdsBySp.get(sp.id) ?? [];

    const blocked = mergeWindows(
      [...breaks, ...appts, ...blks, ...holdsWindows]
        .map((w) => ({
          start: Math.max(entryStart, w.start),
          end: Math.min(entryEnd, w.end),
        }))
        .filter((w) => w.start < w.end)
    );

    // free segments
    let cursor = entryStart;
    const free: Window[] = [];
    for (const w of blocked) {
      if (w.start > cursor) free.push({ start: cursor, end: w.start });
      cursor = Math.max(cursor, w.end);
    }
    if (cursor < entryEnd) free.push({ start: cursor, end: entryEnd });

    // РґР»СЏ РєР°Р¶РґРѕРіРѕ free segment РіРµРЅРµСЂРёРј СЃС‚Р°СЂС‚С‹ РїРѕ 15 РјРёРЅСѓС‚
    for (const seg of free) {
      let t = ceilToStep(seg.start, slotStepMinutes);
      for (; t + slotStepMinutes <= seg.end; t += slotStepMinutes) {
        // РїСЂРѕС€Р»РѕРµ СЃРµРіРѕРґРЅСЏ вЂ” СЃРєСЂС‹РІР°РµРј
        if (dateValue === nowTz.ymd && t <= nowTz.minutes) continue;

        const remaining = seg.end - t;

        // РєР°РєРёРµ СѓСЃР»СѓРіРё РїРѕРјРµС‰Р°СЋС‚СЃСЏ
        for (const [srvId, dur] of durationByService.entries()) {
          if (dur <= remaining) {
            const timeMap = offers.get(t) ?? new Map<number, Set<number>>();
            const spSet = timeMap.get(srvId) ?? new Set<number>();
            spSet.add(sp.id);
            timeMap.set(srvId, spSet);
            offers.set(t, timeMap);
          }
        }
      }
    }
  }

  // СЃРµСЂРёР°Р»РёР·Р°С†РёСЏ
  const times = Array.from(offers.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, byService]) => ({
      time: minutesToTime(t),
      services: Array.from(byService.entries())
        .sort(([a], [b]) => a - b)
        .map(([serviceId, spSet]) => ({
          serviceId,
          specialistIds: Array.from(spSet).sort((a, b) => a - b),
        })),
    }));

  return jsonOk({ date: dateValue, times });
}


