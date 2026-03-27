import { Prisma } from "@prisma/client";
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
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
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
  const s = services.find((x) => x.id === d.serviceId)?.name ?? "—";
  const sp = specialists.find((x) => x.id === d.specialistId)?.name ?? "—";
  return `Локация: ${l}\nУслуга: ${s}\nСпециалист: ${sp}\nДата: ${formatYmdRu(d.date)}\nВремя: ${d.time ?? "—"}`;
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
  const startAt = zonedTimeToUtc(String(d.date), String(d.time), accountTz);
  const day = zonedDayRangeUtc(String(d.date), accountTz);
  if (!startAt || !day || isPastDateOrTimeInTz(String(d.date), String(d.time), accountTz)) {
    return { ok: false as const, code: "bad_datetime" as const };
  }

  const service = services.find((x) => x.id === d.serviceId);
  if (!service) return { ok: false as const, code: "bad_service" as const };

  const [location, specialist, schedule] = await Promise.all([
    prisma.location.findFirst({
      where: { id: d.locationId!, accountId, status: "ACTIVE" },
      select: {
        id: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
    }),
    prisma.specialistProfile.findFirst({
      where: { id: d.specialistId!, accountId },
      select: { id: true, levelId: true },
    }),
    prisma.scheduleEntry.findFirst({
      where: {
        accountId,
        specialistId: d.specialistId!,
        locationId: d.locationId!,
        date: { gte: day.dayStartUtc, lt: day.dayEndUtc },
        type: "WORKING",
      },
    }),
  ]);
  if (!location || !specialist || !schedule) return { ok: false as const, code: "combo_unavailable" as const };

  const specialistLite: SpecialistLite = {
    id: specialist.id,
    levelId: specialist.levelId ?? null,
    name: "",
    locationIds: [],
    serviceIds: [],
  };
  const effective = getEffectiveServiceForSpecialist(service, specialistLite);

  const locationWindow = getLocationWorkWindowForDate(location, String(d.date));
  if (locationWindow.isClosed) {
    return { ok: false as const, code: "outside_working_hours" as const };
  }

  const startM = toMinutes(String(d.time));
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
    return { ok: false as const, code: "outside_working_hours" as const };
  }

  const endAt = new Date(startAt);
  endAt.setUTCMinutes(endAt.getUTCMinutes() + effective.durationMin);
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const ua = request.headers.get("user-agent") ?? null;

  try {
    const appointmentResult = await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            accountId,
            locationId: d.locationId!,
            specialistId: d.specialistId!,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        });
        if (conflict) return null;

        const holdConflict = await tx.appointmentHold.findFirst({
          where: {
            accountId,
            specialistId: d.specialistId!,
            expiresAt: { gt: new Date() },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            ...(holdOwnerMarker != null ? { clientId: { not: holdOwnerMarker } } : {}),
          },
          select: { id: true },
        });
        if (holdConflict) return null;

        const normalizedEmail = d.clientEmail ? d.clientEmail.trim().toLowerCase() : null;

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
          return "client_conflict";
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

        const appt = await tx.appointment.create({
          data: {
            accountId,
            locationId: d.locationId!,
            specialistId: d.specialistId!,
            clientId,
            startAt,
            endAt,
            status: "NEW",
            priceTotal: Number(effective.price),
            durationTotalMin: effective.durationMin,
            source: "ai_assistant",
          },
          select: { id: true },
        });

        await tx.$executeRaw`
          INSERT INTO "public"."AppointmentService"
            ("appointmentId", "serviceId", "price", "durationMin", "orderIndex", "specialistId")
          VALUES
            (${appt.id}, ${service.id}, ${Number(effective.price)}, ${effective.durationMin}, ${0}, ${d.specialistId!})
        `;

        await tx.appointmentStatusHistory.create({
          data: { appointmentId: appt.id, actorType: "assistant", toStatus: "NEW" },
        });

        if (requiredVersionIds.length) {
          await tx.legalAcceptance.createMany({
            data: requiredVersionIds.map((v) => ({
              accountId,
              documentVersionId: v,
              appointmentId: appt.id,
              clientId,
              source: "public_booking",
              ip,
              userAgent: ua,
            })),
          });
        }

        return appt.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (appointmentResult === "client_conflict") {
      return { ok: false as const, code: "client_conflict" as const };
    }
    if (!appointmentResult) return { ok: false as const, code: "slot_busy" as const };
    return { ok: true as const, appointmentId: appointmentResult };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code === "P2034") {
      return { ok: false as const, code: "slot_busy" as const };
    }
    throw error;
  }
}

















