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
      detailHref: `/${publicSlug}/locations/${location.id}`,
      bookingHref: `/${publicSlug}/booking?scenario=dateFirst&locationId=${location.id}`,
      lat: geo.lat,
      lng: geo.lng,
    }];
  });

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
            </div>

            <div className="mt-6">
              <MapClient points={points} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
