import type { CSSProperties } from "react";
import ClientRegisterPage from "./register-client";

type PageProps = {
  searchParams?: Promise<{ account?: string }> | { account?: string };
};

export default async function ClientRegisterPageWrapper({ searchParams }: PageProps) {
  const resolved = await Promise.resolve(searchParams ?? {});
  const accountSlug = resolved?.account?.trim() || "";

  const pageStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    backgroundImage:
      "radial-gradient(960px 520px at 10% -10%, rgba(255, 237, 213, 0.6) 0%, rgba(255,255,255,0) 65%), radial-gradient(820px 480px at 88% -15%, rgba(30, 41, 59, 0.08) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #f8fafc 0%, #f3f4f6 60%, #eef2f7 100%)",
    color: "#0f172a",
    "--bp-ink": "#0f172a",
    "--bp-muted": "#64748b",
    "--bp-paper": "rgba(255, 255, 255, 0.92)",
    "--bp-surface": "#f3f4f6",
    "--bp-stroke": "rgba(15, 23, 42, 0.08)",
    "--bp-accent": "#ef5a3c",
    "--bp-accent-strong": "#d94b2f",
    "--bp-shadow": "0 24px 55px rgba(15, 23, 42, 0.12)",
    "--site-client-button": "#ef5a3c",
    "--site-client-button-text": "#ffffff",
    "--site-button-radius": "16px",
    "--site-radius": "24px",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <ClientRegisterPage initialAccountSlug={accountSlug} />
    </main>
  );
}
