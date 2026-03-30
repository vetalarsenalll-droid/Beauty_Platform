import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getLocationWorkWindowForDate,
  isPastDateOrTimeInTz,
  toMinutes,
  zonedDayRangeUtc,
  zonedTimeToUtc,
} from "@/lib/public-booking";

export type Mode = "SELF" | "ASSISTANT";

export type DraftLike = {
  locationId: number | null;
  serviceId: number | null;
  serviceIds?: number[] | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  planJson?: Array<{
    serviceId: number;
    specialistId: number | null;
    date: string | null;
    time: string | null;
  }> | null;
  bookingMode?: "single_specialist_multi" | "chain_multi_specialist" | null;
  mode: Mode | null;
  status: string;
  consentConfirmedAt: string | null;
};

export type LocationLite = { id: number; name: string; address: string | null; description?: string | null };
export type ServiceLite = {
  id: number;
  name: string;
  baseDurationMin: number;
  description?: string | null;
  categoryName?: string | null;
  basePrice: number;
  allowMultiServiceBooking?: boolean;
  locationIds: number[];
  levelConfigs?: Array<{ levelId: number; durationMin: number | null; price: number | null }>;
  specialistConfigs?: Array<{ specialistId: number; durationOverrideMin: number | null; priceOverride: number | null }>;
};
export type SpecialistLite = { id: number; name: string; levelId?: number | null; levelName?: string | null; bio?: string | null; locationIds: number[]; serviceIds: number[] };

export function serviceLowerBounds(service: ServiceLite) {
  const prices = [
    Number(service.basePrice),
    ...(service.levelConfigs ?? []).map((x) => (x.price == null ? NaN : Number(x.price))),
    ...(service.specialistConfigs ?? []).map((x) => (x.priceOverride == null ? NaN : Number(x.priceOverride))),
  ].filter((x) => Number.isFinite(x) && x > 0) as number[];

  const durations = [
    Number(service.baseDurationMin),
    ...(service.levelConfigs ?? []).map((x) => (x.durationMin == null ? NaN : Number(x.durationMin))),
    ...(service.specialistConfigs ?? []).map((x) => (x.durationOverrideMin == null ? NaN : Number(x.durationOverrideMin))),
  ].filter((x) => Number.isFinite(x) && x > 0) as number[];

  return {
    minPrice: prices.length ? Math.min(...prices) : Math.round(Number(service.basePrice) || 0),
    minDuration: durations.length ? Math.min(...durations) : Number(service.baseDurationMin) || 0,
  };
}

export function formatServiceQuickLabel(service: ServiceLite) {
  const { minPrice, minDuration } = serviceLowerBounds(service);
  return `${service.name} — от ${Math.round(minPrice)} ₽, от ${Math.round(minDuration)} мин`;
}

export function formatSpecialistQuickLabel(specialist: SpecialistLite) {
  const lvl = (specialist.levelName ?? "").trim();
  return lvl ? `${specialist.name} — ${lvl}` : specialist.name;
}

export async function apiData<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const payload = await r.json().catch(() => null);
    return (payload?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function getSlots(
  origin: string,
  accountSlug: string,
  locationId: number,
  serviceId: number,
  date: string,
  holdOwnerMarker?: number | null,
) {
  const u = new URL("/api/v1/public/booking/slots", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(locationId));
  u.searchParams.set("serviceId", String(serviceId));
  u.searchParams.set("date", date);
  if (Number.isInteger(Number(holdOwnerMarker))) u.searchParams.set("holdOwnerMarker", String(holdOwnerMarker));
  const slots = await apiData<{ slots: Array<{ time: string }> }>(u.toString());
  return Array.from(new Set((slots?.slots ?? []).map((x) => x.time))).sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0));
}

export async function getOffers(
  origin: string,
  accountSlug: string,
  locationId: number,
  date: string,
  excludeAppointmentId?: number | null,
  holdOwnerMarker?: number | null,
) {
  const u = new URL("/api/v1/public/booking/offers", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(locationId));
  u.searchParams.set("date", date);
  if (excludeAppointmentId && Number.isInteger(excludeAppointmentId) && excludeAppointmentId > 0) {
    u.searchParams.set("excludeAppointmentId", String(excludeAppointmentId));
  }
  if (Number.isInteger(Number(holdOwnerMarker))) u.searchParams.set("holdOwnerMarker", String(holdOwnerMarker));
  return (
    (await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number; specialistIds?: number[] }> }> }>(u.toString())) ?? {
      times: [],
    }
  );
}
export function getEffectiveServiceForSpecialist(service: ServiceLite, specialist: SpecialistLite | null) {
  const override = service.specialistConfigs?.find((x) => specialist && x.specialistId === specialist.id) ?? null;
  const levelCfg =
    service.levelConfigs?.find((x) => specialist?.levelId != null && x.levelId === specialist.levelId) ?? null;
  const durationMin = override?.durationOverrideMin ?? levelCfg?.durationMin ?? service.baseDurationMin;
  const price = override?.priceOverride ?? levelCfg?.price ?? service.basePrice;
  return { durationMin: Number(durationMin), price: Number(price) };
}

export async function specialistsForSlot(
  origin: string,
  accountSlug: string,
  d: DraftLike,
  specialists: SpecialistLite[],
) {
  const u = new URL("/api/v1/public/booking/specialists", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(d.locationId));
  u.searchParams.set("serviceId", String(d.serviceId));
  u.searchParams.set("date", String(d.date));
  u.searchParams.set("time", String(d.time));
  const res = await apiData<{ specialists: Array<{ id: number }> }>(u.toString());
  const ids = new Set((res?.specialists ?? []).map((x) => x.id));
  return specialists.filter((s) => ids.has(s.id));
}

export function bookingSummary(
  d: DraftLike,
  locations: LocationLite[],
  services: ServiceLite[],
  specialists: SpecialistLite[],
) {
  const formatYmdRu = (ymd: string | null | undefined) => {
    if (!ymd) return "—";
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return ymd;
    return `${m[3]}.${m[2]}.${m[1]}`;
  };
  const l = locations.find((x) => x.id === d.locationId)?.name ?? "—";
  const selectedServiceIds = Array.from(
    new Set(
      [
        ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
        ...(Number.isInteger(d.serviceId) && Number(d.serviceId) > 0 ? [Number(d.serviceId)] : []),
      ].filter((value) => Number.isInteger(value) && Number(value) > 0),
    ),
  );
  const rows = selectedServiceIds.map((serviceId, index) => {
    const service = services.find((x) => x.id === serviceId) ?? null;
    const planItem = (d.planJson ?? []).find((item) => item?.serviceId === serviceId) ?? null;
    const specialistId = planItem?.specialistId ?? d.specialistId ?? null;
    const specialistName = specialistId ? specialists.find((x) => x.id === specialistId)?.name ?? `#${specialistId}` : "—";
    const specialist = specialistId ? specialists.find((x) => x.id === specialistId) ?? null : null;
    const effective = service ? getEffectiveServiceForSpecialist(service, specialist) : null;
    const whenDate = planItem?.date ?? d.date;
    let whenTime = planItem?.time ?? (index === 0 ? d.time : null);
    if (!planItem?.time && !(Array.isArray(d.planJson) && d.planJson.length > 0) && d.specialistId && d.time && index > 0) {
      let cursor = toMinutes(d.time);
      if (cursor != null) {
        for (let i = 0; i <= index; i += 1) {
          const rowService = services.find((x) => x.id === selectedServiceIds[i]!) ?? null;
          if (!rowService) {
            cursor = null;
            break;
          }
          const specialist = specialists.find((x) => x.id === d.specialistId) ?? null;
          const effective = getEffectiveServiceForSpecialist(rowService, specialist);
          if (i === index) break;
          cursor += Number(effective.durationMin || 0);
        }
      }
      if (cursor != null) {
        const hh = String(Math.floor(cursor / 60)).padStart(2, "0");
        const mm = String(cursor % 60).padStart(2, "0");
        whenTime = `${hh}:${mm}`;
      }
    }
    return {
      serviceId,
      serviceName: service?.name ?? `#${serviceId}`,
      specialistName,
      whenDate,
      whenTime,
      price: effective ? Math.round(Number(effective.price || 0)) : null,
      durationMin: effective ? Math.round(Number(effective.durationMin || 0)) : null,
    };
  });

  if (rows.length <= 1) {
    const first = rows[0] ?? null;
    const s = first?.serviceName ?? "—";
    const sp = first?.specialistName ?? "—";
    const date = first?.whenDate ?? d.date;
    const time = first?.whenTime ?? d.time;
    const priceText = first?.price != null ? `${first.price} ₽` : "—";
    const durationText = first?.durationMin != null ? `${first.durationMin} мин` : "—";
    return `Локация: ${l}.\nУслуга: ${s}.\nСпециалист: ${sp}.\nДата: ${formatYmdRu(date)}.\nВремя: ${time ?? "—"}.\nСтоимость: ${priceText}.\nДлительность: ${durationText}.`;
  }

  const lines = rows.map(
    (row, index) =>
      `Услуга №${index + 1}: ${row.serviceName}.\nСпециалист: ${row.specialistName}.\nДата: ${formatYmdRu(row.whenDate)}.\nВремя: ${row.whenTime ?? "—"}.\nСтоимость: ${row.price != null ? `${row.price} ₽` : "—"}.\nДлительность: ${row.durationMin != null ? `${row.durationMin} мин` : "—"}.`,
  );
  const totalPrice = rows.reduce((acc, row) => acc + Number(row.price ?? 0), 0);
  const totalDuration = rows.reduce((acc, row) => acc + Number(row.durationMin ?? 0), 0);
  return `Локация: ${l}.\n${lines.join("\n\n")}\n\nОбщая стоимость: ${Math.round(totalPrice)} ₽.\nОбщая длительность: ${Math.round(totalDuration)} мин.`;
}

export function serviceListText(services: ServiceLite[], limit = 12) {
  return services
    .slice(0, limit)
    .map((x, i) => `${i + 1}. ${formatServiceQuickLabel(x)}`)
    .join("\n");
}

type CreateBookingArgs = {
  d: DraftLike;
  accountId: number;
  accountTz: string;
  requiredVersionIds: number[];
  request: Request;
  services: ServiceLite[];
  preferredClientId?: number | null;
  holdOwnerMarker?: number | null;
};

type LocationCalendarLite = {
  id: number;
  hours: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  exceptions: Array<{ date: Date; isClosed: boolean; startTime: string | null; endTime: string | null }>;
};

export async function reserveAssistantSlotHold(args: {
  accountId: number;
  locationId: number;
  specialistId: number;
  date: string;
  time: string;
  durationMin: number;
  accountTz: string;
  holdOwnerMarker: number;
}) {
  const { accountId, locationId, specialistId, date, time, durationMin, accountTz, holdOwnerMarker } = args;
  const startAt = zonedTimeToUtc(String(date), String(time), accountTz);
  const day = zonedDayRangeUtc(String(date), accountTz);
  if (!startAt || !day || isPastDateOrTimeInTz(String(date), String(time), accountTz)) return false;

  const [location, schedule] = await Promise.all([
    prisma.location.findFirst({
      where: { id: locationId, accountId, status: "ACTIVE" },
      select: {
        id: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
    }),
    prisma.scheduleEntry.findFirst({
      where: {
        accountId,
        specialistId,
        locationId,
        date: { gte: day.dayStartUtc, lt: day.dayEndUtc },
        type: "WORKING",
      },
      select: { startTime: true, endTime: true },
    }),
  ]);
  if (!location || !schedule) return false;

  const locationWindow = getLocationWorkWindowForDate(location, String(date));
  if (locationWindow.isClosed) return false;

  const holdStart = toMinutes(String(time));
  const holdEnd = holdStart == null ? null : holdStart + Number(durationMin || 0);
  const scheduleStart = toMinutes(schedule.startTime ?? "");
  const scheduleEnd = toMinutes(schedule.endTime ?? "");
  if (
    holdStart == null ||
    holdEnd == null ||
    scheduleStart == null ||
    scheduleEnd == null ||
    holdStart < scheduleStart ||
    holdEnd > scheduleEnd ||
    holdStart < locationWindow.startMinutes ||
    holdEnd > locationWindow.endMinutes
  ) {
    return false;
  }

  const endAt = new Date(startAt);
  endAt.setUTCMinutes(endAt.getUTCMinutes() + Number(durationMin || 0));
  const now = new Date();

  const setting = await prisma.accountSetting.findUnique({
    where: { accountId },
    select: { holdTtlMinutes: true },
  });
  const ttlMinutes = Math.min(Math.max(setting?.holdTtlMinutes ?? 5, 1), 30);
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  try {
    const ok = await prisma.$transaction(async (tx) => {
      const [conflictAppt, conflictBlock, conflictHold] = await Promise.all([
        tx.appointment.findFirst({
          where: {
            accountId,
            locationId,
            specialistId,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        }),
        tx.blockedSlot.findFirst({
          where: {
            accountId,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            OR: [{ locationId }, { specialistId }],
          },
          select: { id: true },
        }),
        tx.appointmentHold.findFirst({
          where: {
            accountId,
            specialistId,
            expiresAt: { gt: now },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            clientId: { not: holdOwnerMarker },
          },
          select: { id: true },
        }),
      ]);

      if (conflictAppt || conflictBlock || conflictHold) return false;

      await tx.appointmentHold.deleteMany({
        where: { accountId, clientId: holdOwnerMarker },
      });

      await tx.appointmentHold.create({
        data: {
          accountId,
          specialistId,
          clientId: holdOwnerMarker,
          startAt,
          endAt,
          expiresAt,
        },
      });

      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return ok;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code === "P2034") return false;
    throw error;
  }
}

export async function createAssistantBooking(args: CreateBookingArgs) {
  const { d, accountId, accountTz, requiredVersionIds, request, services, preferredClientId = null, holdOwnerMarker = null } = args;
  const selectedServiceIds = Array.from(
    new Set<number>([
      ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
      ...(d.serviceId ? [Number(d.serviceId)] : []),
    ]),
  ).filter((id) => Number.isInteger(id) && id > 0);
  if (!selectedServiceIds.length) {
    return { ok: false as const, code: "bad_service" as const };
  }

  const selectedServices = selectedServiceIds
    .map((id) => services.find((x) => x.id === id) ?? null)
    .filter((x): x is ServiceLite => Boolean(x));
  if (selectedServices.length !== selectedServiceIds.length) {
    return { ok: false as const, code: "bad_service" as const };
  }
  if (selectedServiceIds.length > 1 && selectedServices.some((service) => service.allowMultiServiceBooking === false)) {
    return { ok: false as const, code: "bad_service" as const };
  }

  type PlanItem = {
    serviceId: number;
    specialistId: number;
    date: string;
    time: string;
  };

  const rawPlan = Array.isArray(d.planJson) ? d.planJson : [];
  const normalizedPlan: PlanItem[] = rawPlan
    .map((item) => {
      const serviceId = Number((item as { serviceId?: unknown })?.serviceId);
      const specialistId = Number((item as { specialistId?: unknown })?.specialistId);
      const date = String((item as { date?: unknown })?.date ?? "").trim();
      const time = String((item as { time?: unknown })?.time ?? "").trim();
      if (!Number.isInteger(serviceId) || serviceId <= 0) return null;
      if (!Number.isInteger(specialistId) || specialistId <= 0) return null;
      if (!date || !time) return null;
      return { serviceId, specialistId, date, time };
    })
    .filter((x): x is PlanItem => Boolean(x));

  const hasChainPlan =
    selectedServiceIds.length > 1 &&
    normalizedPlan.length === selectedServiceIds.length &&
    selectedServiceIds.every((id) => normalizedPlan.some((item) => item.serviceId === id));

  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const ua = request.headers.get("user-agent") ?? null;

  const normalizeEmail = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  };
  const normalizedEmail = normalizeEmail(d.clientEmail);

  try {
    const appointmentResult = await prisma.$transaction(
      async (tx) => {
        const clientByPreferred = preferredClientId
          ? await tx.client.findFirst({
              where: { id: preferredClientId, accountId },
              select: { id: true, firstName: true, phone: true, email: true },
            })
          : null;

        const clientByPhone =
          !clientByPreferred && d.clientPhone
            ? await tx.client.findFirst({
                where: { accountId, phone: d.clientPhone },
                select: { id: true, firstName: true, phone: true, email: true },
              })
            : null;

        const clientByEmail =
          !clientByPreferred && normalizedEmail
            ? await tx.client.findFirst({
                where: { accountId, email: normalizedEmail },
                select: { id: true, firstName: true, phone: true, email: true },
              })
            : null;

        if (clientByPhone && clientByEmail && clientByPhone.id !== clientByEmail.id) {
          return "client_conflict" as const;
        }

        const existingClient = clientByPreferred ?? clientByPhone ?? clientByEmail;
        const clientId = existingClient
          ? (
              await tx.client.update({
                where: { id: existingClient.id },
                data: {
                  firstName: existingClient.firstName || d.clientName || null,
                  phone: existingClient.phone || d.clientPhone || null,
                  email: existingClient.email || normalizedEmail || null,
                },
              })
            ).id
          : (
              await tx.client.create({
                data: {
                  accountId,
                  firstName: d.clientName || null,
                  phone: d.clientPhone || null,
                  email: normalizedEmail || null,
                },
              })
            ).id;

        const createLegalAcceptances = async (appointmentIds: number[]) => {
          if (!requiredVersionIds.length || !appointmentIds.length) return;
          await tx.legalAcceptance.createMany({
            data: requiredVersionIds.flatMap((v) =>
              appointmentIds.map((appointmentId) => ({
                accountId,
                documentVersionId: v,
                appointmentId,
                clientId,
                source: "public_booking",
                ip,
                userAgent: ua,
              })),
            ),
          });
        };

        if (hasChainPlan) {
          const locationsByDate = new Map<string, LocationCalendarLite | null>();
          const schedulesByKey = new Map<string, Awaited<ReturnType<typeof tx.scheduleEntry.findFirst>>>();
          const createdAppointmentIds: number[] = [];
          const groupBookingId = randomUUID();

          const plannedWindows: Array<{
            service: ServiceLite;
            specialistId: number;
            startAt: Date;
            endAt: Date;
            date: string;
            time: string;
            durationMin: number;
            price: number;
          }> = [];

          for (const serviceId of selectedServiceIds) {
            const item = normalizedPlan.find((x) => x.serviceId === serviceId);
            if (!item) return "bad_datetime" as const;
            if (isPastDateOrTimeInTz(item.date, item.time, accountTz)) return "bad_datetime" as const;

            const service = selectedServices.find((x) => x.id === serviceId);
            if (!service) return "bad_service" as const;

            const specialist = await tx.specialistProfile.findFirst({
              where: { id: item.specialistId, accountId, locations: { some: { locationId: d.locationId! } } },
              select: { id: true, levelId: true },
            });
            if (!specialist) return "combo_unavailable" as const;
            const supported = await tx.specialistService.findFirst({
              where: { specialistId: specialist.id, serviceId: service.id },
              select: { specialistId: true },
            });
            if (!supported) return "combo_unavailable" as const;

            const startAt = zonedTimeToUtc(item.date, item.time, accountTz);
            const day = zonedDayRangeUtc(item.date, accountTz);
            if (!startAt || !day) return "bad_datetime" as const;

            const locationKey = item.date;
            if (!locationsByDate.has(locationKey)) {
              const location = await tx.location.findFirst({
                where: { id: d.locationId!, accountId, status: "ACTIVE" },
                select: {
                  id: true,
                  hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
                  exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
                },
              });
              locationsByDate.set(locationKey, location);
            }
            const location = locationsByDate.get(locationKey);
            if (!location) return "combo_unavailable" as const;

            const scheduleKey = `${item.specialistId}:${item.date}`;
            if (!schedulesByKey.has(scheduleKey)) {
              const schedule = await tx.scheduleEntry.findFirst({
                where: {
                  accountId,
                  specialistId: item.specialistId,
                  locationId: d.locationId!,
                  date: { gte: day.dayStartUtc, lt: day.dayEndUtc },
                  type: "WORKING",
                },
              });
              schedulesByKey.set(scheduleKey, schedule);
            }
            const schedule = schedulesByKey.get(scheduleKey);
            if (!schedule) return "combo_unavailable" as const;

            const specialistLite: SpecialistLite = {
              id: specialist.id,
              levelId: specialist.levelId ?? null,
              name: "",
              locationIds: [],
              serviceIds: [],
            };
            const effective = getEffectiveServiceForSpecialist(service, specialistLite);
            const locationWindow = getLocationWorkWindowForDate(location, item.date);
            if (locationWindow.isClosed) return "outside_working_hours" as const;

            const startM = toMinutes(item.time);
            const sStart = toMinutes(schedule.startTime || "");
            const sEnd = toMinutes(schedule.endTime || "");
            if (
              startM == null ||
              sStart == null ||
              sEnd == null ||
              startM < sStart ||
              startM + effective.durationMin > sEnd ||
              startM < locationWindow.startMinutes ||
              startM + effective.durationMin > locationWindow.endMinutes
            ) {
              return "outside_working_hours" as const;
            }

            const endAt = new Date(startAt);
            endAt.setUTCMinutes(endAt.getUTCMinutes() + effective.durationMin);
            plannedWindows.push({
              service,
              specialistId: specialist.id,
              startAt,
              endAt,
              date: item.date,
              time: item.time,
              durationMin: effective.durationMin,
              price: Number(effective.price),
            });
          }

          plannedWindows.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

          for (let i = 1; i < plannedWindows.length; i += 1) {
            if (plannedWindows[i]!.startAt.getTime() < plannedWindows[i - 1]!.endAt.getTime()) {
              return "bad_datetime" as const;
            }
          }

          for (const window of plannedWindows) {
            const [conflict, holdConflict, blockedConflict] = await Promise.all([
              tx.appointment.findFirst({
                where: {
                  accountId,
                  locationId: d.locationId!,
                  specialistId: window.specialistId,
                  status: { notIn: ["CANCELLED", "NO_SHOW"] },
                  startAt: { lt: window.endAt },
                  endAt: { gt: window.startAt },
                },
                select: { id: true },
              }),
              tx.appointmentHold.findFirst({
                where: {
                  accountId,
                  specialistId: window.specialistId,
                  expiresAt: { gt: new Date() },
                  startAt: { lt: window.endAt },
                  endAt: { gt: window.startAt },
                  ...(holdOwnerMarker != null ? { clientId: { not: holdOwnerMarker } } : {}),
                },
                select: { id: true },
              }),
              tx.blockedSlot.findFirst({
                where: {
                  accountId,
                  startAt: { lt: window.endAt },
                  endAt: { gt: window.startAt },
                  OR: [{ locationId: d.locationId! }, { specialistId: window.specialistId }],
                },
                select: { id: true },
              }),
            ]);
            if (conflict || holdConflict || blockedConflict) return "slot_busy" as const;
          }

          for (const [index, window] of plannedWindows.entries()) {
            const appt = await tx.appointment.create({
              data: {
                accountId,
                locationId: d.locationId!,
                specialistId: window.specialistId,
                clientId,
                startAt: window.startAt,
                endAt: window.endAt,
                status: "NEW",
                priceTotal: Number(window.price),
                durationTotalMin: window.durationMin,
                source: "ai_assistant",
                groupBookingId,
              },
              select: { id: true },
            });

            await tx.$executeRaw`
              INSERT INTO "public"."AppointmentService"
                ("appointmentId", "serviceId", "price", "durationMin", "orderIndex", "specialistId")
              VALUES
                (${appt.id}, ${window.service.id}, ${Number(window.price)}, ${window.durationMin}, ${index}, ${window.specialistId})
            `;
            await tx.appointmentStatusHistory.create({
              data: { appointmentId: appt.id, actorType: "assistant", toStatus: "NEW" },
            });
            createdAppointmentIds.push(appt.id);
          }

          await createLegalAcceptances(createdAppointmentIds);
          return { type: "chain" as const, appointmentIds: createdAppointmentIds };
        }

        const startAt = zonedTimeToUtc(String(d.date), String(d.time), accountTz);
        const day = zonedDayRangeUtc(String(d.date), accountTz);
        if (!startAt || !day || isPastDateOrTimeInTz(String(d.date), String(d.time), accountTz)) {
          return "bad_datetime" as const;
        }
        if (!d.specialistId) return "combo_unavailable" as const;

        const [location, specialist, schedule] = await Promise.all([
          tx.location.findFirst({
            where: { id: d.locationId!, accountId, status: "ACTIVE" },
            select: {
              id: true,
              hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
              exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
            },
          }),
          tx.specialistProfile.findFirst({
            where: { id: d.specialistId!, accountId },
            select: { id: true, levelId: true },
          }),
          tx.scheduleEntry.findFirst({
            where: {
              accountId,
              specialistId: d.specialistId!,
              locationId: d.locationId!,
              date: { gte: day.dayStartUtc, lt: day.dayEndUtc },
              type: "WORKING",
            },
          }),
        ]);
        if (!location || !specialist || !schedule) return "combo_unavailable" as const;

        const serviceRows = selectedServices.map((service) => {
          const specialistLite: SpecialistLite = {
            id: specialist.id,
            levelId: specialist.levelId ?? null,
            name: "",
            locationIds: [],
            serviceIds: [],
          };
          const effective = getEffectiveServiceForSpecialist(service, specialistLite);
          return {
            service,
            durationMin: effective.durationMin,
            price: Number(effective.price),
          };
        });

        const totalDuration = serviceRows.reduce((acc, row) => acc + row.durationMin, 0);
        const totalPrice = serviceRows.reduce((acc, row) => acc + row.price, 0);
        if (totalDuration <= 0) return "bad_datetime" as const;

        const locationWindow = getLocationWorkWindowForDate(location, String(d.date));
        if (locationWindow.isClosed) return "outside_working_hours" as const;

        const startM = toMinutes(String(d.time));
        const sStart = toMinutes(schedule.startTime || "");
        const sEnd = toMinutes(schedule.endTime || "");
        if (
          startM == null ||
          sStart == null ||
          sEnd == null ||
          startM < sStart ||
          startM + totalDuration > sEnd ||
          startM < locationWindow.startMinutes ||
          startM + totalDuration > locationWindow.endMinutes
        ) {
          return "outside_working_hours" as const;
        }

        const endAt = new Date(startAt);
        endAt.setUTCMinutes(endAt.getUTCMinutes() + totalDuration);

        const [conflict, holdConflict, blockedConflict] = await Promise.all([
          tx.appointment.findFirst({
            where: {
              accountId,
              locationId: d.locationId!,
              specialistId: d.specialistId!,
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
            select: { id: true },
          }),
          tx.appointmentHold.findFirst({
            where: {
              accountId,
              specialistId: d.specialistId!,
              expiresAt: { gt: new Date() },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
              ...(holdOwnerMarker != null ? { clientId: { not: holdOwnerMarker } } : {}),
            },
            select: { id: true },
          }),
          tx.blockedSlot.findFirst({
            where: {
              accountId,
              startAt: { lt: endAt },
              endAt: { gt: startAt },
              OR: [{ locationId: d.locationId! }, { specialistId: d.specialistId! }],
            },
            select: { id: true },
          }),
        ]);
        if (conflict || holdConflict || blockedConflict) return "slot_busy" as const;

        const appt = await tx.appointment.create({
          data: {
            accountId,
            locationId: d.locationId!,
            specialistId: d.specialistId!,
            clientId,
            startAt,
            endAt,
            status: "NEW",
            priceTotal: totalPrice,
            durationTotalMin: totalDuration,
            source: "ai_assistant",
          },
          select: { id: true },
        });

        for (const [orderIndex, row] of serviceRows.entries()) {
          await tx.$executeRaw`
            INSERT INTO "public"."AppointmentService"
              ("appointmentId", "serviceId", "price", "durationMin", "orderIndex", "specialistId")
            VALUES
              (${appt.id}, ${row.service.id}, ${Number(row.price)}, ${row.durationMin}, ${orderIndex}, ${d.specialistId!})
          `;
        }

        await tx.appointmentStatusHistory.create({
          data: { appointmentId: appt.id, actorType: "assistant", toStatus: "NEW" },
        });
        await createLegalAcceptances([appt.id]);
        return { type: "single" as const, appointmentId: appt.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (appointmentResult === "client_conflict") {
      return { ok: false as const, code: "client_conflict" as const };
    }
    if (appointmentResult === "bad_datetime") {
      return { ok: false as const, code: "bad_datetime" as const };
    }
    if (appointmentResult === "bad_service") {
      return { ok: false as const, code: "bad_service" as const };
    }
    if (appointmentResult === "outside_working_hours") {
      return { ok: false as const, code: "outside_working_hours" as const };
    }
    if (appointmentResult === "combo_unavailable") {
      return { ok: false as const, code: "combo_unavailable" as const };
    }
    if (appointmentResult === "slot_busy") {
      return { ok: false as const, code: "slot_busy" as const };
    }
    if (!appointmentResult) {
      return { ok: false as const, code: "slot_busy" as const };
    }

    if (appointmentResult.type === "chain") {
      return { ok: true as const, appointmentId: appointmentResult.appointmentIds[0], appointmentIds: appointmentResult.appointmentIds };
    }
    return { ok: true as const, appointmentId: appointmentResult.appointmentId, appointmentIds: [appointmentResult.appointmentId] };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code === "P2034") {
      return { ok: false as const, code: "slot_busy" as const };
    }
    throw error;
  }
}


















