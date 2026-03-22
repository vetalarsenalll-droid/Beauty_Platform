import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import JournalView from "./journal-view";

type CrmCalendarPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseDateParam(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIntParam(value?: string) {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export default async function CrmCalendarPage({ searchParams }: CrmCalendarPageProps) {
  const session = await requireCrmPermission("crm.calendar.read");

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const dateParam =
    typeof resolvedSearchParams?.date === "string" ? resolvedSearchParams.date : undefined;
  const initialDate = parseDateParam(dateParam) ?? new Date();

  const monthStart = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(initialDate.getFullYear(), initialDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const scheduleStart = new Date(monthStart);
  scheduleStart.setDate(scheduleStart.getDate() - 7);

  const scheduleEnd = new Date(monthEnd);
  scheduleEnd.setDate(scheduleEnd.getDate() + 7);

  const [
    specialists,
    locations,
    clients,
    appointments,
    services,
    scheduleEntries,
  ] = await Promise.all([
    prisma.specialistProfile.findMany({
      where: {
        accountId: session.accountId,
        user: { status: { not: "DISABLED" } },
      },
      include: { user: { include: { profile: true } }, level: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        accountId: session.accountId,
        startAt: { gte: monthStart, lte: monthEnd },
      },
      include: {
        client: true,
        location: true,
        specialist: { include: { user: { include: { profile: true } } } },
        services: { include: { service: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId, isActive: true },
      include: {
        locations: true,
        specialists: true,
        levelConfigs: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: {
        accountId: session.accountId,
        date: { gte: scheduleStart, lte: scheduleEnd },
      },
      include: { breaks: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // initialLocationId: берем из query, если валидный и существует в списке
  const locParam =
    typeof resolvedSearchParams?.locationId === "string"
      ? resolvedSearchParams.locationId
      : undefined;
  const desiredLocId = parseIntParam(locParam);
  const initialLocationId =
    (desiredLocId && locations.some((l) => l.id === desiredLocId) ? desiredLocId : null) ??
    locations[0]?.id ??
    null;

  const staff = specialists.map((specialist) => {
    const firstName = specialist.user.profile?.firstName ?? "";
    const lastName = specialist.user.profile?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || specialist.user.email || "Без имени";
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    return {
      id: specialist.id,
      name: fullName,
      role: specialist.level?.name ?? "Специалист",
      initials: initials || fullName.slice(0, 2).toUpperCase(),
      levelId: specialist.levelId ?? null,
    };
  });

  const appointmentItems = appointments.map((appointment) => {
    const clientName = `${appointment.client.firstName ?? ""} ${appointment.client.lastName ?? ""}`
      .trim()
      .replace(/\s+/g, " ");
    return {
      id: appointment.id,
      specialistId: appointment.specialistId,
      locationId: appointment.locationId,
      clientId: appointment.clientId,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      status: appointment.status,
      source: appointment.source,
      clientName: clientName || appointment.client.phone || "Без клиента",
      serviceNames: appointment.services.map((item) => item.service.name),
      serviceIds: appointment.services.map((item) => item.service.id),
      priceTotal: appointment.priceTotal.toString(),
      durationMin: appointment.durationTotalMin,
    };
  });

  return (
    <div className="w-full max-w-none">
      <JournalView
        initialDate={initialDate.toISOString().slice(0, 10)}
        initialLocationId={initialLocationId}
        staff={staff}
        clients={clients.map((client) => {
          const firstName = client.firstName ?? "";
          const lastName = client.lastName ?? "";
          const fullName = `${firstName} ${lastName}`.trim();
          return {
            id: client.id,
            name: fullName || client.phone || "Без имени",
          };
        })}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
        }))}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          basePrice: service.basePrice.toString(),
          baseDurationMin: service.baseDurationMin,
          locationIds: service.locations.map((item) => item.locationId),
          specialistIds: service.specialists.map((item) => item.specialistId),
          levelConfigs: service.levelConfigs.map((item) => ({
            levelId: item.levelId,
            price: item.price ? item.price.toString() : null,
            durationMin: item.durationMin,
          })),
          specialistOverrides: service.specialists.map((item) => ({
            specialistId: item.specialistId,
            price: item.priceOverride ? item.priceOverride.toString() : null,
            durationMin: item.durationOverrideMin,
          })),
        }))}
        scheduleEntries={scheduleEntries.map((entry) => ({
          id: entry.id,
          specialistId: entry.specialistId,
          locationId: entry.locationId,
          date: entry.date.toISOString().slice(0, 10),
          type: entry.type,
          startTime: entry.startTime,
          endTime: entry.endTime,
          breaks: entry.breaks.map((item) => ({
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        }))}
        appointments={appointmentItems}
      />
    </div>
  );
}
