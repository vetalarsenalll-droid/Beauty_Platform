import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createDefaultDraft,
  DEFAULT_ACCOUNT_NAME,
  normalizeDraft,
  type SiteDraft,
  type SitePageKey,
} from "@/lib/site-builder";

const PAGE_LABELS: Record<SitePageKey, string> = {
  home: "Главная",
  booking: "Онлайн-запись",
  client: "Личный кабинет",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
};

const PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "client",
  "locations",
  "services",
  "specialists",
  "promos",
];

export default async function CrmSiteProjectPage() {
  const session = await requireCrmPermission("crm.settings.read");

  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true },
  });

  const publicPage = await prisma.publicPage.findFirst({
    where: { accountId: session.accountId },
    select: {
      id: true,
      draftJson: true,
      status: true,
      updatedAt: true,
    },
  });

  const accountName = account?.name?.trim() || DEFAULT_ACCOUNT_NAME;
  const defaultDraft = createDefaultDraft(accountName);
  const page = publicPage
    ? publicPage
    : await prisma.publicPage.create({
        data: {
          accountId: session.accountId,
          status: "DRAFT",
          draftJson: defaultDraft as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          draftJson: true,
          status: true,
          updatedAt: true,
        },
      });

  const safeDraft = normalizeDraft((page.draftJson ?? defaultDraft) as SiteDraft, accountName);

  const [locationsCount, servicesCount, specialistsCount, promosCount] = await Promise.all([
    prisma.location.count({ where: { accountId: session.accountId } }),
    prisma.service.count({ where: { accountId: session.accountId } }),
    prisma.specialistProfile.count({ where: { accountId: session.accountId } }),
    prisma.promotion.count({ where: { accountId: session.accountId } }),
  ]);

  const hasPageBlocks = (key: SitePageKey) => (safeDraft.pages?.[key]?.length ?? 0) > 0;
  const availablePageKeys = PAGE_KEYS.filter((key) => {
    if (key === "home") return true;
    if (key === "locations") return locationsCount > 0 || hasPageBlocks(key);
    if (key === "services") return servicesCount > 0 || hasPageBlocks(key);
    if (key === "specialists") return specialistsCount > 0 || hasPageBlocks(key);
    if (key === "promos") return promosCount > 0 || hasPageBlocks(key);
    return hasPageBlocks(key);
  });

  const projectTitle = account?.name?.trim() || "Мой сайт";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              Проект сайта
            </div>
            <h1 className="mt-2 text-3xl font-light text-[color:var(--bp-ink)]">{projectTitle}</h1>
            <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
              Статус: {page.status} • Страниц: {availablePageKeys.length}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/site"
              className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)]"
            >
              Открыть конструктор
            </Link>
            <Link
              href="/crm/site/seo"
              className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)]"
            >
              Настройки сайта
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4 sm:p-6">
        <div className="mb-4 text-sm font-medium text-[color:var(--bp-muted)]">Страницы проекта</div>
        <div className="divide-y divide-[color:var(--bp-stroke)]">
          {availablePageKeys.map((key) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{PAGE_LABELS[key]}</div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  Блоков в странице: {safeDraft.pages?.[key]?.length ?? 0}
                </div>
              </div>
              <Link
                href={`/crm/site?page=${key}`}
                className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)]"
              >
                Редактировать
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
