import type { CSSProperties } from "react";
import HomeCatalogTabs from "../home-catalog-tabs";
import HomeMarketplaceHeader from "../home-marketplace-header";
import HomeHeroSection from "../home-hero-section";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  const pageStyle: CSSProperties = {
    fontFamily: '"Montserrat", var(--font-sans)',
    color: "#111827",
    backgroundColor: "#f6f7fb",
    "--bp-ink": "#111827",
    "--bp-muted": "#6b7280",
    "--bp-paper": "#ffffff",
    "--bp-stroke": "rgba(17, 24, 39, 0.08)",
    "--bp-accent": "#ff6a3d",
    "--bp-accent-strong": "#e3562d",
    "--bp-shadow": "0 24px 50px rgba(17, 24, 39, 0.12)",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-6">
        <div className="flex flex-col gap-6">
          <HomeMarketplaceHeader />
          <HomeHeroSection />
          <HomeCatalogTabs active="records" />
        </div>

        <section className="mt-6 rounded-[28px] border border-[color:var(--bp-stroke)] bg-white p-6 shadow-[var(--bp-shadow)]">
          <div className="text-lg font-semibold">Мои записи</div>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">История и будущие записи в одном месте.</p>
        </section>
      </div>
    </main>
  );
}
