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
      setError(data?.error?.message ?? "Ошибка регистрации.");
      return;
    }

    const target = accountSlug ? `/c?account=${accountSlug}` : "/c";
    window.location.href = target;
  };

  return (
    <div
      className="mx-auto flex min-h-[70vh] w-full items-center"
      style={{ maxWidth: "var(--site-client-auth-width, 560px)" }}
    >
      <div className="w-full rounded-[var(--site-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-8 shadow-[var(--bp-shadow)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Личный кабинет
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Регистрация</h1>
        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-medium">
            Имя
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
            />
          </label>
          <label className="text-sm font-medium">
            Фамилия
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
            />
          </label>
          <label className="text-sm font-medium">
            Телефон
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
            />
          </label>
          <label className="text-sm font-medium">
            Эл. почта
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@mail.ru"
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
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
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
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
            className="mt-2 inline-flex items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-5 py-3 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-60"
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
  );
}
