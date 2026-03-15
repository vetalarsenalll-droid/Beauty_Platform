import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import MarketplaceHeroEditor from "./marketplace-hero-editor";
import MarketplaceCategoryEditor from "./marketplace-category-editor";
import MarketplaceTabs from "./marketplace-tabs";
import { HERO_SETTING_KEY, normalizeHeroConfig } from "@/lib/marketplace-hero";
import {
  CATEGORY_SETTING_KEY,
  normalizeCategoryConfig,
} from "@/lib/marketplace-categories";

export default async function PlatformMarketplacePage() {
  await requirePlatformPermission("platform.settings");

  const [
    heroSetting,
    categorySetting,
    accounts,
    locations,
    services,
    specialists,
  ] = await Promise.all([
    prisma.platformSetting.findUnique({ where: { key: HERO_SETTING_KEY } }),
    prisma.platformSetting.findUnique({ where: { key: CATEGORY_SETTING_KEY } }),
    prisma.account.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, accountId: true },
    }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, accountId: true },
    }),
    prisma.specialistProfile.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        accountId: true,
        user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  const heroConfig = normalizeHeroConfig(heroSetting?.valueJson);
  const categoryConfig = normalizeCategoryConfig(categorySetting?.valueJson);

  const specialistOptions = specialists.map((item) => {
    const firstName = item.user.profile?.firstName ?? "";
    const lastName = item.user.profile?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim();
    return {
      id: item.id,
      accountId: item.accountId,
      label: fullName || item.user.email || `Специалист #${item.id}`,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Маркетплейс
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Витрина главной страницы
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Настройте большие и маленькие карточки, рекламируйте AI‑ассистента,
          аккаунты, студии, мастеров и услуги.
        </p>
      </header>

      <MarketplaceTabs
        hero={
          <MarketplaceHeroEditor
            initialConfig={heroConfig}
            accounts={accounts}
            locations={locations}
            services={services}
            specialists={specialistOptions}
          />
        }
        categories={<MarketplaceCategoryEditor initialConfig={categoryConfig} />}
      />
    </div>
  );
}
