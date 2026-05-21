"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ClientSocialAuthButtons from "@/components/client-social-auth-buttons";

type ClientRegisterPageProps = {
  initialAccountSlug?: string;
  returnTo?: string;
  loginHref?: string;
  embedded?: boolean;
};

export default function ClientRegisterPage({
  initialAccountSlug = "",
  returnTo,
  loginHref,
  embedded = false,
}: ClientRegisterPageProps) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountSlug] = useState(() => params.get("account") ?? initialAccountSlug);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string;
      accountSlug?: string;
    } = {
      email,
      password,
      firstName,
      lastName,
      phone,
    };
    if (accountSlug) payload.accountSlug = accountSlug;

    const response = await fetch("/api/v1/auth/client/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const code = data?.error?.code as string | undefined;
      const details = data?.error?.details as { fields?: string[] } | undefined;
      const messages: Record<string, string> = {
        EMAIL_ALREADY_REGISTERED: "Пользователь с таким email уже зарегистрирован.",
        PHONE_ALREADY_REGISTERED: "Клиент с таким телефоном уже зарегистрирован.",
        INVALID_EMAIL: "Укажите корректный email.",
        INVALID_PHONE: "Укажите корректный номер телефона.",
        WEAK_PASSWORD: "Пароль должен содержать минимум 6 символов.",
        ACCOUNT_NOT_FOUND: "Организация не найдена.",
      };
      if (code === "VALIDATION_FAILED" && details?.fields?.length) {
        if (details.fields.includes("email") && details.fields.includes("password")) {
          setError("Email и пароль обязательны.");
        } else if (details.fields.includes("email")) {
          setError("Email обязателен.");
        } else if (details.fields.includes("password")) {
          setError("Пароль обязателен.");
        } else {
          setError("Заполните обязательные поля.");
        }
      } else {
        setError(messages[code ?? ""] ?? data?.error?.message ?? "Ошибка регистрации.");
      }
      return;
    }

    const target = returnTo || (accountSlug ? `/c?account=${accountSlug}` : "/c");
    window.location.href = target;
  };

  return (
    <div
      className={`site-client-auth-page flex items-center ${embedded ? "px-8 py-8" : "min-h-screen justify-center px-6 py-12"}`}
      style={{ backgroundColor: "var(--site-client-auth-page-bg, var(--bp-surface))" }}
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
        <div
          className={`site-client-auth-side flex flex-col justify-between gap-6 text-white ${embedded ? "p-8" : "p-10"}`}
          style={{ backgroundColor: "var(--site-client-auth-side-bg,var(--bp-accent))" }}
        >
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/70">
              {embedded ? "Клиентский доступ" : "Marketplace"}
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Новый клиент</h1>
            <p className="mt-3 text-sm text-white/80">
              {embedded
                ? "Создайте профиль, чтобы видеть записи, бонусы и данные по этой организации."
                : "Зарегистрируйтесь и управляйте всеми записями в одном кабинете."}
            </p>
          </div>
          <div className="space-y-3 text-sm text-white/80">
            <div
              className="border px-4 py-3"
              style={{ borderRadius: "var(--site-client-auth-hint-radius,0px)", borderColor: "var(--site-client-auth-hint-border,rgba(255,255,255,0.2))" }}
            >
              Единый профиль для всех организаций
            </div>
            <div
              className="border px-4 py-3"
              style={{ borderRadius: "var(--site-client-auth-hint-radius,0px)", borderColor: "var(--site-client-auth-hint-border,rgba(255,255,255,0.2))" }}
            >
              Бонусы и история посещений по салонам
            </div>
          </div>
        </div>
        <div className={`site-client-auth-form ${embedded ? "p-8" : "p-10"}`} style={{ backgroundColor: "var(--site-client-auth-right-bg,#ffffff)", backgroundImage: "var(--site-client-auth-right-bg-image, none)", color: "var(--site-client-auth-right-text,#111827)" }}>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Личный кабинет
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Регистрация</h2>
          <ClientSocialAuthButtons
            accountSlug={accountSlug}
            returnTo={returnTo || (accountSlug ? `/c?account=${accountSlug}` : "/c")}
            className="mt-8"
            buttonClassName="flex w-full items-center justify-center rounded-[var(--site-client-auth-social-button-radius,var(--site-button-radius))] border border-[color:var(--site-client-auth-social-button-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-social-button,#ffffff)] px-4 py-3 text-[length:var(--site-client-auth-social-button-text-size,14px)] font-semibold text-[color:var(--site-client-auth-social-button-text,#111827)] transition hover:bg-[color:var(--site-client-auth-social-button-hover,var(--site-client-auth-social-button,#ffffff))]"
          />
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium">
              Имя
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
              />
            </label>
            <label className="text-sm font-medium">
              Фамилия
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
              />
            </label>
            <label className="text-sm font-medium">
              Телефон
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
              />
            </label>
            <label className="text-sm font-medium">
              Эл. почта
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@mail.ru"
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-none border border-[color:var(--site-client-auth-field-border,var(--bp-stroke))] bg-[color:var(--site-client-auth-field-bg,#f3f4f6)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
                style={{ borderRadius: "var(--site-client-auth-field-radius,var(--site-client-auth-button-radius,var(--site-button-radius)))" }}
                required
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
              className="mt-2 inline-flex items-center justify-center rounded-[var(--site-client-auth-button-radius,var(--site-button-radius))] border border-[color:var(--site-client-auth-button-border,transparent)] bg-[color:var(--site-client-button)] px-5 py-3 text-sm font-semibold text-[color:var(--site-client-button-text,#ffffff)] shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--site-client-auth-button-hover,var(--site-client-button))] disabled:opacity-60"
            >
              {loading ? "Создание..." : "Создать аккаунт"}
            </button>
            <a
              href={loginHref ?? (accountSlug ? `/c/login?account=${accountSlug}` : "/c/login")}
              className="text-center text-sm text-[color:var(--bp-muted)] underline"
            >
              Уже есть аккаунт?
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
