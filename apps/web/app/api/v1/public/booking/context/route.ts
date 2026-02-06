import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAccountSlotStepMinutes, resolvePublicAccount } from "@/lib/public-booking";

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const { account } = resolved;

  const slotStepMinutes = await getAccountSlotStepMinutes(account.id);
  const publicAccount = { ...account, slotStepMinutes };

  const [locations, legalDocs, platformLegalDocs] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: account.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
      },
    }),
    prisma.legalDocument.findMany({
      where: { accountId: account.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        isRequired: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            content: true,
            publishedAt: true,
          },
        },
      },
    }),
    prisma.platformLegalDocument.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        isRequired: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            content: true,
            publishedAt: true,
          },
        },
      },
    }),
  ]);

  const legalDocuments = legalDocs
    .map((doc) => {
      const version = doc.versions[0];
      if (!version) return null;
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        isRequired: doc.isRequired,
        versionId: version.id,
        version: version.version,
        content: version.content,
        publishedAt: version.publishedAt.toISOString(),
      };
    })
    .filter(Boolean);

  const platformLegalDocuments = platformLegalDocs
    .map((doc) => {
      const version = doc.versions[0];
      if (!version) return null;
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        isRequired: doc.isRequired,
        versionId: version.id,
        version: version.version,
        content: version.content,
        publishedAt: version.publishedAt.toISOString(),
      };
    })
    .filter(Boolean);

  return jsonOk({
    account: publicAccount,
    locations,
    legalDocuments,
    platformLegalDocuments,
  });
}
