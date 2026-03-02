import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPastDateOrTimeInTz, toMinutes, zonedDayRangeUtc, zonedTimeToUtc } from "@/lib/public-booking";

export type Mode = "SELF" | "ASSISTANT";

export type DraftLike = {
  locationId: number | null;
  serviceId: number | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
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
) {
  const u = new URL("/api/v1/public/booking/slots", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(locationId));
  u.searchParams.set("serviceId", String(serviceId));
  u.searchParams.set("date", date);
  const slots = await apiData<{ slots: Array<{ time: string }> }>(u.toString());
  return Array.from(new Set((slots?.slots ?? []).map((x) => x.time))).sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0));
}

export async function getOffers(
  origin: string,
  accountSlug: string,
  locationId: number,
  date: string,
  excludeAppointmentId?: number | null,
) {
  const u = new URL("/api/v1/public/booking/offers", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(locationId));
  u.searchParams.set("date", date);
  if (excludeAppointmentId && Number.isInteger(excludeAppointmentId) && excludeAppointmentId > 0) {
    u.searchParams.set("excludeAppointmentId", String(excludeAppointmentId));
  }
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
};

export async function createAssistantBooking(args: CreateBookingArgs) {
  const { d, accountId, accountTz, requiredVersionIds, request, services } = args;
  const startAt = zonedTimeToUtc(String(d.date), String(d.time), accountTz);
  const day = zonedDayRangeUtc(String(d.date), accountTz);
  if (!startAt || !day || isPastDateOrTimeInTz(String(d.date), String(d.time), accountTz)) {
    return { ok: false as const, code: "bad_datetime" as const };
  }

  const service = services.find((x) => x.id === d.serviceId);
  if (!service) return { ok: false as const, code: "bad_service" as const };

  const [specialist, schedule] = await Promise.all([
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
  if (!specialist || !schedule) return { ok: false as const, code: "combo_unavailable" as const };

  const specialistLite: SpecialistLite = {
    id: specialist.id,
    levelId: specialist.levelId ?? null,
    name: "",
    locationIds: [],
    serviceIds: [],
  };
  const effective = getEffectiveServiceForSpecialist(service, specialistLite);

  const startM = toMinutes(String(d.time));
  const sStart = toMinutes(schedule.startTime || "");
  const sEnd = toMinutes(schedule.endTime || "");
  if (startM == null || sStart == null || sEnd == null || startM < sStart || startM + effective.durationMin > sEnd) {
    return { ok: false as const, code: "outside_working_hours" as const };
  }

  const endAt = new Date(startAt);
  endAt.setUTCMinutes(endAt.getUTCMinutes() + effective.durationMin);
  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
  const ua = request.headers.get("user-agent") ?? null;

  try {
    const appointmentId = await prisma.$transaction(
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
          },
          select: { id: true },
        });
        if (holdConflict) return null;

        const clientProfile = await tx.client.findFirst({
          where: { accountId, phone: d.clientPhone! },
          select: { id: true, firstName: true },
        });
        const clientId = clientProfile
          ? (
              await tx.client.update({
                where: { id: clientProfile.id },
                data: { firstName: clientProfile.firstName || d.clientName! },
              })
            ).id
          : (await tx.client.create({ data: { accountId, firstName: d.clientName!, phone: d.clientPhone! } })).id;

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
            services: {
              create: [{ serviceId: service.id, price: Number(effective.price), durationMin: effective.durationMin }],
            },
          },
          select: { id: true },
        });

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

    if (!appointmentId) return { ok: false as const, code: "slot_busy" as const };
    return { ok: true as const, appointmentId };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code === "P2034") {
      return { ok: false as const, code: "slot_busy" as const };
    }
    throw error;
  }
}















