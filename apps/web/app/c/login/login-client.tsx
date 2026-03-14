"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ClientLoginPageProps = {
  initialAccountSlug?: string;
};

export default function ClientLoginPage({ initialAccountSlug = "" }: ClientLoginPageProps) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Вход</h1>
        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-medium">
            Эл. почта
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@mail.ru"
              className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
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
            {loading ? "Вход..." : "Войти"}
          </button>
          <a
            href={accountSlug ? `/c/register?account=${accountSlug}` : "/c/register"}
            className="text-center text-sm text-[color:var(--bp-muted)] underline"
          >
            Создать аккаунт
          </a>
        </form>
      </div>
    </div>
  );
}
