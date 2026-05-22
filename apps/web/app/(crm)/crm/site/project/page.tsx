import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createDefaultDraft,
  DEFAULT_ACCOUNT_NAME,
  normalizeDraft,
  type SiteBlock,
  type SiteDraft,
  type SiteEntityPages,
  type SitePageKey,
} from "@/lib/site-builder";
import ProjectClient, {
  type ProjectBlockTag,
  type ProjectPageRow,
  type ProjectSeoSettings,
} from "./project-client";

const PAGE_LABELS: Partial<Record<SitePageKey, string>> = {
  home: "Главная",
  booking: "Онлайн-запись",
  aisha: "Ассистент",
  client: "Личный кабинет",
  legal: "Документы",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
};

const PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "aisha",
  "client",
  "clientLogin",
  "clientCabinet",
  "legal",
  "locations",
  "services",
  "specialists",
  "promos",
];

const pageLabel = (key: SitePageKey) =>
  PAGE_LABELS[key] ?? (key === "clientLogin" ? "Вход" : key === "clientCabinet" ? "Кабинет" : key);

const pagePath = (key: SitePageKey) => {
  if (key === "home") return "/";
  if (key === "aisha") return "/assistant";
  if (key === "clientLogin") return "/client/login";
  if (key === "clientCabinet") return "/client/cabinet";
  return `/${key}`;
};

const getPageBlocksSnapshot = (draft: SiteDraft, key: SitePageKey) =>
  key === "home" ? draft.pages?.home ?? draft.blocks : draft.pages?.[key] ?? [];

const hasUnpublishedPageChanges = (
  draft: SiteDraft,
  publishedDraft: SiteDraft | null,
  key: SitePageKey
) => {
  if (!publishedDraft) return (draft.pages?.[key]?.length ?? 0) > 0;
  return (
    JSON.stringify(getPageBlocksSnapshot(draft, key)) !==
    JSON.stringify(getPageBlocksSnapshot(publishedDraft, key))
  );
};

function blockTags(blocks: SiteBlock[]): ProjectBlockTag[] {
  return blocks.map((block, index) => ({
    blockId: block.id,
    index,
    type: block.type,
    title: typeof block.data.title === "string" ? block.data.title : "",
    subtitle: typeof block.data.subtitle === "string" ? block.data.subtitle : "",
    seoTitleTag: typeof block.data.seoTitleTag === "string" ? block.data.seoTitleTag : "",
    seoSubtitleTag:
      typeof block.data.seoSubtitleTag === "string" ? block.data.seoSubtitleTag : "",
  }));
}

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
      publishedVersion: { select: { contentJson: true } },
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
          publishedVersion: { select: { contentJson: true } },
        },
      });

  const safeDraft = normalizeDraft((page.draftJson ?? defaultDraft) as SiteDraft, accountName);
  const publishedDraft = page.publishedVersion?.contentJson
    ? normalizeDraft(page.publishedVersion.contentJson as SiteDraft, accountName)
    : null;

  const [
    locations,
    services,
    specialists,
    promos,
    legalDocs,
    platformLegalDocs,
    seoPageSettings,
  ] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.promotion.findMany({
      where: { accountId: session.accountId },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.legalDocument.findMany({
      where: { accountId: session.accountId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.platformLegalDocument.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.seoPageSetting.findMany({
      where: { accountId: session.accountId },
      orderBy: { pageKey: "asc" },
    }),
  ]);

  const hasPageBlocks = (key: SitePageKey) => (safeDraft.pages?.[key]?.length ?? 0) > 0;
  const availablePageKeys = PAGE_KEYS.filter((key) => {
    if (key === "home") return true;
    if (key === "booking") return true;
    if (key === "aisha") return true;
    if (key === "client") return false;
    if (key === "clientLogin") return true;
    if (key === "clientCabinet") return true;
    if (key === "legal") return false;
    if (key === "locations") return locations.length > 0 || hasPageBlocks(key);
    if (key === "services") return services.length > 0 || hasPageBlocks(key);
    if (key === "specialists") return specialists.length > 0 || hasPageBlocks(key);
    if (key === "promos") return promos.length > 0 || hasPageBlocks(key);
    return hasPageBlocks(key);
  });

  const seoByKey = new Map(seoPageSettings.map((item) => [item.pageKey, item]));
  const readSeo = (pageKey: string): ProjectSeoSettings => {
    const item = seoByKey.get(pageKey);
    return {
      pageKey,
      title: item?.title ?? "",
      description: item?.description ?? "",
      ogImageUrl: item?.ogImageUrl ?? "",
      keywords: item?.keywords ?? "",
      canonicalUrl: item?.canonicalUrl ?? "",
      noIndex: item?.noIndex ?? false,
      noFollow: item?.noFollow ?? false,
    };
  };

  const entityBlocks = (
    entityPages: SiteEntityPages[keyof SiteEntityPages] | undefined,
    id: number
  ) => entityPages?.[String(id)] ?? [];
  void platformLegalDocs;
  const legalDocumentRows: ProjectPageRow[] = legalDocs.flatMap((doc) => {
    const version = doc.versions[0];
    if (!version) return [];
    const entityPageBlocks = entityBlocks(safeDraft.entityPages?.legalDocuments, version.id);
    const blocks = entityPageBlocks.length > 0 ? entityPageBlocks : getPageBlocksSnapshot(safeDraft, "legal");
    const publishedEntityPageBlocks = publishedDraft
      ? entityBlocks(publishedDraft.entityPages?.legalDocuments, version.id)
      : [];
    const publishedBlocks =
      publishedDraft && publishedEntityPageBlocks.length > 0
        ? publishedEntityPageBlocks
        : publishedDraft
          ? getPageBlocksSnapshot(publishedDraft, "legal")
          : [];
    return {
      pageKey: `legal:${version.id}`,
      label: doc.title || `\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 ${version.id}`,
      path: `/legal/${version.id}`,
      editorHref: `/crm/site?page=legal&entity=legalDocument:${version.id}`,
      publishPage: "legal" as SitePageKey,
      publishEntity: { type: "legalDocuments" as const, id: String(version.id) },
      blocksCount: blocks.length,
      hasUnpublishedChanges: !publishedDraft || JSON.stringify(blocks) !== JSON.stringify(publishedBlocks),
      seo: readSeo(`legal:${version.id}`),
      blockTags: blockTags(blocks),
    };
  });

  const pageRows: ProjectPageRow[] = [
    ...availablePageKeys.map((key) => ({
      pageKey: key,
      label: pageLabel(key),
      path: pagePath(key),
      editorHref: `/crm/site?page=${key}`,
      publishPage: key,
      publishEntity: null,
      blocksCount: getPageBlocksSnapshot(safeDraft, key).length,
      hasUnpublishedChanges: hasUnpublishedPageChanges(safeDraft, publishedDraft, key),
      seo: readSeo(key),
      blockTags: blockTags(getPageBlocksSnapshot(safeDraft, key)),
    })),
    ...legalDocumentRows,
    ...locations.map((item) => ({
      pageKey: `location:${item.id}`,
      label: `Локация: ${item.name}`,
      path: `/locations/${item.id}`,
      editorHref: `/crm/site?page=locations&entity=location:${item.id}`,
      publishPage: "locations" as SitePageKey,
      publishEntity: { type: "locations" as const, id: String(item.id) },
      blocksCount: entityBlocks(safeDraft.entityPages?.locations, item.id).length,
      hasUnpublishedChanges: false,
      seo: readSeo(`location:${item.id}`),
      blockTags: blockTags(entityBlocks(safeDraft.entityPages?.locations, item.id)),
    })),
    ...services.map((item) => ({
      pageKey: `service:${item.id}`,
      label: `Услуга: ${item.name}`,
      path: `/services/${item.id}`,
      editorHref: `/crm/site?page=services&entity=service:${item.id}`,
      publishPage: "services" as SitePageKey,
      publishEntity: { type: "services" as const, id: String(item.id) },
      blocksCount: entityBlocks(safeDraft.entityPages?.services, item.id).length,
      hasUnpublishedChanges: false,
      seo: readSeo(`service:${item.id}`),
      blockTags: blockTags(entityBlocks(safeDraft.entityPages?.services, item.id)),
    })),
    ...specialists.map((item) => {
      const specialistName =
        [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") ||
        item.user.email ||
        `#${item.id}`;
      return {
        pageKey: `specialist:${item.id}`,
        label: `Специалист: ${specialistName}`,
        path: `/specialists/${item.id}`,
        editorHref: `/crm/site?page=specialists&entity=specialist:${item.id}`,
        publishPage: "specialists" as SitePageKey,
        publishEntity: { type: "specialists" as const, id: String(item.id) },
        blocksCount: entityBlocks(safeDraft.entityPages?.specialists, item.id).length,
        hasUnpublishedChanges: false,
        seo: readSeo(`specialist:${item.id}`),
        blockTags: blockTags(entityBlocks(safeDraft.entityPages?.specialists, item.id)),
      };
    }),
    ...promos.map((item) => ({
      pageKey: `promo:${item.id}`,
      label: `Промо: ${item.name}`,
      path: `/promos/${item.id}`,
      editorHref: `/crm/site?page=promos&entity=promo:${item.id}`,
      publishPage: "promos" as SitePageKey,
      publishEntity: { type: "promos" as const, id: String(item.id) },
      blocksCount: entityBlocks(safeDraft.entityPages?.promos, item.id).length,
      hasUnpublishedChanges: false,
      seo: readSeo(`promo:${item.id}`),
      blockTags: blockTags(entityBlocks(safeDraft.entityPages?.promos, item.id)),
    })),
  ];

  const projectTitle = account?.name?.trim() || "Мой сайт";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              Проект сайта
            </div>
            <h1 className="mt-2 text-3xl font-light text-[color:var(--bp-ink)]">
              {projectTitle}
            </h1>
            <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
              Статус: {page.status} • Страниц: {pageRows.length}
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

      <ProjectClient initialDraft={safeDraft} pages={pageRows} />
    </div>
  );
}
