import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ScheduleView from "./schedule-view";

export default async function CrmSchedulePage() {
  const session = await requireCrmPermission("crm.schedule.read");

  const [specialists, types, locations] = await Promise.all([
    prisma.specialistProfile.findMany({
      where: {
        accountId: session.accountId,
        user: { status: { not: "DISABLED" } },
      },
      include: {
        user: { include: { profile: true } },
        level: true,
        locations: { select: { locationId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheduleNonWorkingType.findMany({
      where: { accountId: session.accountId, isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const staff = specialists.map((specialist) => {
    const firstName = specialist.user.profile?.firstName ?? "";
    const lastName = specialist.user.profile?.lastName ?? "";
    const fullName =
      `${firstName} ${lastName}`.trim() || specialist.user.email || "Без имени";
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    return {
      id: specialist.id,
      name: fullName,
      role: specialist.level?.name ?? "Специалист",
      initials: initials || fullName.slice(0, 2).toUpperCase(),
      locationIds: specialist.locations.map((item) => item.locationId),
    };
  });

  const locationOptions = locations.map((l) => ({
    id: l.id,
    name: l.name,
    hours: l.hours,
    exceptions: l.exceptions.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      isClosed: item.isClosed,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  }));
  const initialLocationId = locationOptions[0]?.id ?? null;

  return (
    <ScheduleView
      staff={staff}
      locations={locationOptions}
      initialLocationId={initialLocationId}
      initialTypes={types.map((type) => ({
        id: type.id,
        name: type.name,
        color: type.color,
      }))}
    />
  );
}
