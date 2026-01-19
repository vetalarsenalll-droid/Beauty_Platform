import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";
import { requirePlatformApiPermission } from "@/lib/platform-api";

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.moderation");
  if ("response" in auth) return auth.response;

  const pages = await prisma.publicPage.findMany({
    where: { status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
    include: { account: true },
  });

  return jsonOk(
    pages.map((page) => ({
      id: page.id,
      status: page.status,
      account: { id: page.accountId, name: page.account.name, slug: page.account.slug },
      updatedAt: page.updatedAt.toISOString(),
      createdAt: page.createdAt.toISOString(),
    }))
  );
}
