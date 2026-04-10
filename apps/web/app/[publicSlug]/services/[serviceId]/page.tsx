import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { cookies } from "next/headers";

import { loadPublicData } from "../../_shared/public-data";
import { renderPublicPageShell } from "../../_shared/public-page-shell";

type PageProps = {
  params: Promise<{ publicSlug?: string; serviceId?: string }>;
};

export default async function PublicServicePage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const serviceId = Number(resolvedParams.serviceId);
  if (!Number.isInteger(serviceId)) return notFound();

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();
  if (!data.services.some((item) => item.id === serviceId)) return notFound();

  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${data.account.slug}`
    : `/c/login?account=${data.account.slug}`;

  const cookieStore = await cookies();
  const storedMode = cookieStore.get?.("site-theme-mode")?.value;
  const modeOverride =
    storedMode === "dark" || storedMode === "light" ? storedMode : undefined;

  return renderPublicPageShell({
    data,
    pageKey: "services",
    publicSlug,
    accountLinkOverride,
    currentEntity: { type: "service", id: serviceId },
    modeOverride,
    layout: {
      rootTag: "main",
      rootClassName: "min-h-screen pb-0",
      useInnerColumn: true,
      innerClassName: "flex w-full flex-col pt-0 pb-0",
    },
  });
}
