import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import HomeLeftSidebar from "../home-left-sidebar";
import HomeHeroSection from "../home-hero-section";
import MapClient, { type PublicMapPoint } from "./map-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const locations = await prisma.location.findMany({
    where: {
      status: "ACTIVE",
      account: { status: "ACTIVE" },
    },
    orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      geoPoint: { select: { lat: true, lng: true } },
      account: {
        select: {
          id: true,
          name: true,
          slug: true,
          branding: { select: { logoUrl: true } },
          _count: { select: { services: true } },
        },
      },
    },
    take: 80,
  });

  const points: PublicMapPoint[] = locations.flatMap((location) => {
    const publicSlug = buildPublicSlugId(location.account.slug, location.account.id);
    const geo = location.geoPoint;
    if (!geo) return [];

    return [{
      id: String(location.id),
      accountName: location.account.name,
      locationName: location.name,
      address: location.address,
      logoUrl: location.account.branding?.logoUrl ?? null,
      href: `/${publicSlug}`,
      bookingHref: `/${publicSlug}/booking`,
      servicesCount: location.account._count.services,
      lat: geo.lat,
      lng: geo.lng,
    }];
  });
  const accountCount = new Set(locations.map((location) => location.account.id)).size;

  const pageStyle: CSSProperties = {
    fontFamily: 'var(--font-montserrat), var(--font-sans)',
    color: "#111827",
    backgroundColor: "#f6f7fb",
    "--bp-ink": "#111827",
    "--bp-muted": "#6b7280",
    "--bp-paper": "#ffffff",
    "--bp-stroke": "rgba(17, 24, 39, 0.08)",
    "--bp-accent": "#ff5a5f",
    "--bp-accent-strong": "#e14b50",
    "--bp-shadow": "0 24px 50px rgba(17, 24, 39, 0.12)",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <HomeLeftSidebar active="map" />
      <div className="mx-auto w-full max-w-[1560px] px-6 pb-20 pt-6 md:pl-[280px]">
        <div className="flex flex-col gap-6">
          <HomeHeroSection />

          <section className="rounded-[28px] border border-[color:var(--bp-stroke)] bg-white p-6 shadow-[var(--bp-shadow)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">На карте</div>
                <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
                  Организации и специалисты на карте города.
                </p>
              </div>
              <div className="rounded-2xl bg-[color:var(--bp-accent)]/10 px-4 py-2 text-xs font-semibold text-[color:var(--bp-accent)]">
                {accountCount} аккаунтов
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <MapClient points={points} />

              <aside className="rounded-[24px] border border-[color:var(--bp-stroke)] bg-[#f9fafb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Аккаунты на карте</div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {points.length} с координатами
                  </div>
                </div>

                <div className="mt-4 flex max-h-[492px] flex-col gap-3 overflow-auto pr-1">
                  {points.map((point, index) => (
                    <div
                      key={point.id}
                      className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--bp-accent)] text-xs font-semibold text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{point.accountName}</div>
                          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                            {point.locationName}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-[color:var(--bp-muted)]">
                            {point.address}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-[color:var(--bp-muted)]">
                          Услуг: {point.servicesCount}
                        </span>
                        <a
                          href={point.bookingHref}
                          className="ml-auto rounded-full bg-[color:var(--bp-accent)] px-3 py-1 font-semibold text-white"
                        >
                          Записаться
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
