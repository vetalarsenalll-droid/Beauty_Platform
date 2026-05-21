"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ClientSocialAuthButtons from "@/components/client-social-auth-buttons";

type ClientLoginPageProps = {
  initialAccountSlug?: string;
  returnTo?: string;
  registerHref?: string;
  embedded?: boolean;
};

export default function ClientLoginPage({
  initialAccountSlug = "",
  returnTo,
  registerHref,
  embedded = false,
}: ClientLoginPageProps) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountSlug] = useState(() => params.get("account") ?? initialAccountSlug);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload: { email: string; password: string; accountSlug?: string } = {
      email,
      password,
    };
    if (accountSlug) payload.accountSlug = accountSlug;

    const response = await fetch("/api/v1/auth/client/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error?.message ?? "Ошибка входа.");
      return;
    }

    const target = returnTo || (accountSlug ? `/c?account=${accountSlug}` : "/c");
    window.location.href = target;
  };

  return (
    <div
      className={`site-client-auth-page flex items-center ${embedded ? "px-8 py-8" : "min-h-screen justify-center px-6 py-12"}`}
      style={{ backgroundColor: "var(--site-client-auth-page-bg, var(--bp-surface))", backgroundImage: "var(--site-client-auth-page-bg-image, none)" }}
    >
      <div
        className="site-client-auth-card grid w-full max-w-[980px] overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--site-client-auth-block-bg,var(--bp-paper))] shadow-[var(--bp-shadow)] md:grid-cols-[1.05fr_1fr]"
        style={{
          width: embedded ? "var(--site-client-content-width, 100%)" : "100%",
          marginLeft: embedded ? "var(--site-client-content-left, auto)" : "auto",
          marginRight: embedded ? 0 : "auto",
          minHeight: "var(--site-client-auth-block-height, 700px)",
          borderRadius: "var(--site-client-auth-radius, 28px)",
          backgroundColor: "transparent",
          backgroundImage: "none",
        }}
      >
        <div className={`site-client-auth-side flex flex-col justify-between gap-6 ${embedded ? "p-8" : "p-10"}`} style={{ backgroundColor: "var(--site-client-auth-side-bg,var(--bp-accent))", backgroundImage: "var(--site-client-auth-side-bg-image, none)", color: "var(--site-client-auth-side-text,#ffffff)" }}>
          <div>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--site-client-auth-side-muted,rgba(255,255,255,0.7))" }}>
              {embedded ? "Клиентский доступ" : "Marketplace"}
            </div>
            <h1 className="mt-3 font-semibold" style={{ fontSize: "var(--site-client-auth-title-size,32px)" }}>Личный кабинет клиента</h1>
            <p className="mt-3" style={{ color: "var(--site-client-auth-side-muted,rgba(255,255,255,0.8))", fontSize: "var(--site-client-auth-text-size,14px)" }}>
              {embedded
                ? "Войдите, чтобы увидеть свои записи, бонусы и данные по этой организации."
                : "Управляйте записями, бонусами и любимыми салонами в одном месте."}
            </p>
          </div>
          <div className="space-y-3" style={{ color: "var(--site-client-auth-side-muted,rgba(255,255,255,0.8))", fontSize: "var(--site-client-auth-text-size,14px)" }}>
            <div className="border px-4 py-3" style={{ borderRadius: "var(--site-client-auth-hint-radius,0px)", borderColor: "var(--site-client-auth-hint-border,rgba(255,255,255,0.2))" }}>
              Умные подсказки по следующему визиту
            </div>
            <div className="border px-4 py-3" style={{ borderRadius: "var(--site-client-auth-hint-radius,0px)", borderColor: "var(--site-client-auth-hint-border,rgba(255,255,255,0.2))" }}>
              История записей и оплат по организациям
            </div>
          </div>
        </div>
        <div className={`site-client-auth-form ${embedded ? "p-8" : "p-10"}`} style={{ backgroundColor: "var(--site-client-auth-right-bg,#ffffff)", backgroundImage: "var(--site-client-auth-right-bg-image, none)", color: "var(--site-client-auth-right-text,#111827)" }}>
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--site-client-auth-right-muted,var(--bp-muted))" }}>
            Личный кабинет
          </div>
          <h2 className="mt-2 font-semibold" style={{ fontSize: "var(--site-client-auth-form-title-size,24px)" }}>Вход</h2>
          <ClientSocialAuthButtons
            accountSlug={accountSlug}
            returnTo={returnTo || (accountSlug ? `/c?account=${accountSlug}` : "/c")}
            className="mt-8"
            buttonClassName="flex w-full items-center justify-center rounded-[var(--site-client-auth-social-button-radius,var(--site-button-radius))] border border-[color:var(--site-client-auth-social-button-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-social-button,#ffffff)] px-4 py-3 text-[length:var(--site-client-auth-social-button-text-size,14px)] font-semibold text-[color:var(--site-client-auth-social-button-text,#111827)] transition hover:bg-[color:var(--site-client-auth-social-button-hover,var(--site-client-auth-social-button,#ffffff))]"
          />
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="font-medium" style={{ fontSize: "var(--site-client-auth-form-text-size,14px)" }}>
              Эл. почта
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@mail.ru"
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
              />
            </label>
            <label className="font-medium" style={{ fontSize: "var(--site-client-auth-form-text-size,14px)" }}>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
              />
            </label>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-[var(--site-client-auth-button-radius,var(--site-button-radius))] border border-[color:var(--site-client-auth-button-border,transparent)] bg-[color:var(--site-client-button)] px-5 py-3 font-semibold text-[color:var(--site-client-button-text,#ffffff)] shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--site-client-auth-button-hover,var(--site-client-button))] disabled:opacity-60"
              style={{ fontSize: "var(--site-client-auth-button-text-size,14px)" }}
            >
              {loading ? "Вход..." : "Войти"}
            </button>
            <a
              href={registerHref ?? (accountSlug ? `/c/register?account=${accountSlug}` : "/c/register")}
              className="text-center text-sm text-[color:var(--bp-muted)] underline"
            >
              Создать аккаунт
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
