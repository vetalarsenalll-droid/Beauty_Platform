import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";

function extractCity(address?: string | null) {
  if (!address) return null;
  const first = address.split(",")[0]?.trim();
  if (!first) return null;
  return first.replace(/^г\.?\s*/i, "").trim() || null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();

  const where = query
    ? {
        address: {
          contains: query,
          mode: "insensitive" as const,
        },
      }
    : undefined;

  const locations = await prisma.location.findMany({
    where,
    select: { address: true },
    take: 80,
  });

  const citySet = new Set<string>();
  const normalizedQuery = query.toLowerCase();

  for (const item of locations) {
    const city = extractCity(item.address);
    if (!city) continue;
    if (normalizedQuery && !city.toLowerCase().includes(normalizedQuery)) {
      continue;
    }
    citySet.add(city);
  }

  const cities = Array.from(citySet).slice(0, 8);

  return jsonOk({ cities });
}
