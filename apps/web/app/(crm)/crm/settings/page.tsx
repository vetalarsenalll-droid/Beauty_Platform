import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./settings-client";

export default async function CrmSettingsPage() {
  const session = await requireCrmPermission("crm.settings.read");

  const [legalDocs, profile] = await Promise.all([
    prisma.legalDocument.findMany({
      where: { accountId: session.accountId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    }),
    prisma.accountProfile.findUnique({
      where: { accountId: session.accountId },
    }),
  ]);

  const legalSettings = legalDocs.map((doc) => ({
    id: doc.id,
    key: doc.key,
    title: doc.title,
    description: doc.description,
    isRequired: doc.isRequired,
    sortOrder: doc.sortOrder,
    versionId: doc.versions[0]?.id ?? null,
    version: doc.versions[0]?.version ?? null,
    content: doc.versions[0]?.content ?? "",
  }));

  return (
    <div className="flex flex-col gap-6">

      <SettingsClient
        initialLegalDocs={legalSettings}
        initialProfile={{
          description: profile?.description ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
          address: profile?.address ?? "",
          websiteUrl: profile?.websiteUrl ?? "",
          instagramUrl: profile?.instagramUrl ?? "",
          whatsappUrl: profile?.whatsappUrl ?? "",
          telegramUrl: profile?.telegramUrl ?? "",
          maxUrl: profile?.maxUrl ?? "",
          vkUrl: profile?.vkUrl ?? "",
          viberUrl: profile?.viberUrl ?? "",
          pinterestUrl: profile?.pinterestUrl ?? "",
        }}
      />
    </div>
  );
}

