import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { buildPublicSlugId } from "@/lib/public-slug";

export const runtime = "nodejs";

type SearchItem = {
  id: string;
  type: "service" | "specialist" | "account";
  title: string;
  subtitle?: string | null;
  url: string;
};

function extractCity(address?: string | null) {
  if (!address) return null;
  const first = address.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^г\.?\s*/i, "").trim() || null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryRaw = (searchParams.get("query") ?? "").trim();
  const cityRaw = (searchParams.get("city") ?? "").trim();

  if (!queryRaw) {
    return jsonOk({ services: [], specialists: [], accounts: [] });
  }

  const query = queryRaw.slice(0, 80);
  const city = cityRaw ? cityRaw.toLowerCase() : "";

  let allowedAccountIds: number[] | null = null;
  if (city) {
    const locations = await prisma.location.findMany({
      select: { accountId: true, address: true },
      where: { address: { contains: cityRaw, mode: "insensitive" } },
      take: 300,
    });
    const ids = new Set<number>();
    for (const loc of locations) {
      const locCity = extractCity(loc.address);
      if (locCity && locCity.toLowerCase().includes(city)) {
        ids.add(loc.accountId);
      }
    }
    allowedAccountIds = Array.from(ids);
  }

  const accountWhere = {
    status: "ACTIVE" as const,
    name: { contains: query, mode: "insensitive" as const },
    ...(allowedAccountIds ? { id: { in: allowedAccountIds } } : {}),
  };

  const serviceWhere = {
    isActive: true,
    name: { contains: query, mode: "insensitive" as const },
    ...(allowedAccountIds ? { accountId: { in: allowedAccountIds } } : {}),
  };

  const specialistWhere = {
    ...(allowedAccountIds ? { accountId: { in: allowedAccountIds } } : {}),
    user: {
      profile: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
        ],
      },
    },
  };

  const [accounts, services, specialists] = await Promise.all([
    prisma.account.findMany({
      where: accountWhere,
      select: { id: true, name: true, slug: true },
      take: 5,
    }),
    prisma.service.findMany({
      where: serviceWhere,
      select: { id: true, name: true, account: { select: { id: true, name: true, slug: true } } },
      take: 5,
    }),
    prisma.specialistProfile.findMany({
      where: specialistWhere,
      select: {
        id: true,
        accountId: true,
        account: { select: { id: true, name: true, slug: true } },
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
      take: 5,
    }),
  ]);

  const accountItems: SearchItem[] = accounts.map((acc) => ({
    id: String(acc.id),
    type: "account",
    title: acc.name,
    subtitle: "Студия",
    url: `/${buildPublicSlugId(acc.slug, acc.id)}/booking`,
  }));

  const serviceItems: SearchItem[] = services.map((svc) => ({
    id: String(svc.id),
    type: "service",
    title: svc.name,
    subtitle: svc.account?.name ?? "",
    url: svc.account
      ? `/${buildPublicSlugId(svc.account.slug, svc.account.id)}/services/${svc.id}`
      : "/",
  }));

  const specialistItems: SearchItem[] = specialists.map((sp) => {
    const first = sp.user.profile?.firstName ?? "";
    const last = sp.user.profile?.lastName ?? "";
    const name = `${first} ${last}`.trim() || "Специалист";
    return {
      id: String(sp.id),
      type: "specialist",
      title: name,
      subtitle: sp.account?.name ?? "",
      url: sp.account
        ? `/${buildPublicSlugId(sp.account.slug, sp.account.id)}/specialists/${sp.id}`
        : "/",
    };
  });

  return jsonOk({ services: serviceItems, specialists: specialistItems, accounts: accountItems });
}
