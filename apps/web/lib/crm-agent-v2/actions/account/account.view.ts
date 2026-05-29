import { prisma } from "@/lib/prisma";
import { defineCrmAgentAction } from "../define-action";

export const accountViewAction = defineCrmAgentAction({
  name: "account.view",
  domain: "account",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать профиль аккаунта, настройки и основные реквизиты.",
  plannerHints: ["Use account.view when the user asks to inspect: Показать профиль аккаунта, настройки и основные реквизиты."],
  read: async (_payload, ctx) => {
    const account = await prisma.account.findUnique({
      where: { id: ctx.accountId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        onboardingStatus: true,
        legalType: true,
        businessType: true,
        timeZone: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        settings: true,
        branding: true,
        domains: { select: { id: true, domain: true, isPrimary: true, status: true, sslStatus: true, verifiedAt: true } },
      },
    });
    if (!account) throw new Error("Account not found.");
    return {
      account: {
        ...account,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        domains: account.domains.map((domain) => ({ ...domain, verifiedAt: domain.verifiedAt?.toISOString() ?? null })),
      },
    };
  },
});
