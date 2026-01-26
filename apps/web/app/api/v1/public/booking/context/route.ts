import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const { account } = resolved;

  const locations = await prisma.location.findMany({
    where: { accountId: account.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
    },
  });

  return jsonOk({ account, locations });
}
