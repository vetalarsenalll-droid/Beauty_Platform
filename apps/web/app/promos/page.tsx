import type { CSSProperties } from "react";
import HomeLeftSidebar from "../home-left-sidebar";
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
      <HomeLeftSidebar active="promos" />
      <div className="mx-auto w-full max-w-[1560px] px-6 pb-20 pt-6 md:pl-[280px]">
        <div className="flex flex-col gap-6">
          <HomeHeroSection />

          <section className="rounded-[28px] border border-[color:var(--bp-stroke)] bg-white p-6 shadow-[var(--bp-shadow)]">
            <div className="text-lg font-semibold">Акции</div>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              Подборки и специальные предложения от студий и специалистов.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
