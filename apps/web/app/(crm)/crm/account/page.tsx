import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import AccountProfileClient from "./account-profile-client";

export default async function AccountProfilePage() {
  const session = await requireCrmPermission("crm.settings.read");

  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, slug: true, timeZone: true },
  });

  const [profile, branding, links, roles, permissions, user] = await Promise.all([
    prisma.accountProfile.findUnique({
      where: { accountId: session.accountId },
    }),
    prisma.accountBranding.findUnique({
      where: { accountId: session.accountId },
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: { in: ["account.logo", "account.cover"] },
        entityId: String(session.accountId),
      },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.role.findMany({
      where: { accountId: session.accountId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        roleAssignments: {
          where: { accountId: session.accountId },
          include: { role: true },
        },
      },
    }),
  ]);

  const publicSlug = account
    ? buildPublicSlugId(account.slug, account.id)
    : null;

  const logoLink = links.find((item) => item.entityType === "account.logo");
  const coverLink = links.find((item) => item.entityType === "account.cover");

  return (
    <div className="flex flex-col gap-6">

      <AccountProfileClient
        account={{
          id: account?.id ?? session.accountId,
          name: account?.name ?? "Аккаунт",
          slug: account?.slug ?? "",
          timeZone: account?.timeZone ?? "Europe/Moscow",
          publicSlug,
        }}
        user={{
          id: session.userId,
          email: user?.email ?? "",
          roleId: user?.roleAssignments?.[0]?.roleId ?? null,
        }}
        profile={{
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
        branding={{
          logoUrl: branding?.logoUrl ?? null,
          coverUrl: branding?.coverUrl ?? null,
          logoLinkId: logoLink?.id ?? null,
          coverLinkId: coverLink?.id ?? null,
        }}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          permissionKeys: role.permissions.map(
            (item) => item.permission.key
          ),
        }))}
        permissions={permissions.map((permission) => ({
          key: permission.key,
          description: permission.description ?? null,
        }))}
      />
    </div>
  );
}
