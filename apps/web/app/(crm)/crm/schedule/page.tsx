import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ScheduleView from "./schedule-view";

export default async function CrmSchedulePage() {
  const session = await requireCrmPermission("crm.schedule.read");

  const [specialists, types] = await Promise.all([
    prisma.specialistProfile.findMany({
      where: {
        accountId: session.accountId,
        user: { status: { not: "DISABLED" } },
      },
      include: { user: { include: { profile: true } }, level: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheduleNonWorkingType.findMany({
      where: { accountId: session.accountId, isArchived: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const staff = specialists.map((specialist) => {
    const firstName = specialist.user.profile?.firstName ?? "";
    const lastName = specialist.user.profile?.lastName ?? "";
    const fullName =
      `${firstName} ${lastName}`.trim() ||
      specialist.user.email ||
      "Без имени";
    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    return {
      id: specialist.id,
      name: fullName,
      role: specialist.level?.name ?? "Специалист",
      initials: initials || fullName.slice(0, 2).toUpperCase(),
    };
  });

  return (
    <ScheduleView
      staff={staff}
      initialTypes={types.map((type) => ({
        id: type.id,
        name: type.name,
        color: type.color,
      }))}
    />
  );
}
