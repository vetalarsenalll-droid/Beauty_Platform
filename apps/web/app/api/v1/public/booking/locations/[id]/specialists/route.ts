import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";

const buildSpecialistName = (profile: {
  user: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null };
}) => {
  const first = profile.user.profile?.firstName?.trim() ?? "";
  const last = profile.user.profile?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return profile.user.email ?? "Специалист";
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const locationId = Number(params.id);
  if (!Number.isInteger(locationId)) {
    return jsonError("INVALID_LOCATION", "Некорректная локация.", null, 400);
  }

  const { searchParams } = new URL(request.url);
  const serviceIdParam = searchParams.get("serviceId");
  const serviceId = serviceIdParam ? Number(serviceIdParam) : null;

  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      accountId: resolved.account.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
      ...(serviceId && Number.isInteger(serviceId)
        ? { services: { some: { serviceId } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      levelId: true,
      level: { select: { name: true } },
      user: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const output = specialists.map((item) => ({
    id: item.id,
    name: buildSpecialistName(item),
    role: item.level?.name ?? null,
    levelId: item.levelId,
  }));

  return jsonOk({ specialists: output });
}
