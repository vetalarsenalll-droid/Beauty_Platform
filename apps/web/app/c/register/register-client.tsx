"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ClientRegisterPageProps = {
  initialAccountSlug?: string;
};

export default function ClientRegisterPage({ initialAccountSlug = "" }: ClientRegisterPageProps) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountSlug, setAccountSlug] = useState(initialAccountSlug);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const account = params.get("account");
    if (account) setAccountSlug(account);
  }, [params]);

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

    const target = accountSlug ? `/c?account=${accountSlug}` : "/c";
    window.location.href = target;
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-[var(--bp-shadow)] md:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col justify-between gap-6 bg-[linear-gradient(135deg,var(--bp-accent),var(--bp-accent-strong))] p-10 text-white">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/70">Marketplace</div>
            <h1 className="mt-3 text-3xl font-semibold">Новый клиент</h1>
            <p className="mt-3 text-sm text-white/80">
              Зарегистрируйтесь и управляйте всеми записями в одном кабинете.
            </p>
          </div>
          <div className="space-y-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/20 px-4 py-3">
              Единый профиль для всех организаций
            </div>
            <div className="rounded-2xl border border-white/20 px-4 py-3">
              Бонусы и история посещений по салонам
            </div>
          </div>
        </div>
        <div className="p-10">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Личный кабинет
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Регистрация</h2>
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium">
              Имя
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
              />
            </label>
            <label className="text-sm font-medium">
              Фамилия
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
              />
            </label>
            <label className="text-sm font-medium">
              Телефон
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
              />
            </label>
            <label className="text-sm font-medium">
              Эл. почта
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@mail.ru"
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
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
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
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
              className="mt-2 inline-flex items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Создание..." : "Создать аккаунт"}
            </button>
            <a
              href={accountSlug ? `/c/login?account=${accountSlug}` : "/c/login"}
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
