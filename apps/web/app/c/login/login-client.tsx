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
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-[var(--bp-shadow)] md:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col justify-between gap-6 bg-[linear-gradient(135deg,var(--bp-accent),var(--bp-accent-strong))] p-10 text-white">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/70">Marketplace</div>
            <h1 className="mt-3 text-3xl font-semibold">Личный кабинет клиента</h1>
            <p className="mt-3 text-sm text-white/80">
              Управляйте записями, бонусами и любимыми салонами в одном месте.
            </p>
          </div>
          <div className="space-y-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/20 px-4 py-3">
              Умные подсказки по следующему визиту
            </div>
            <div className="rounded-2xl border border-white/20 px-4 py-3">
              История записей и оплат по организациям
            </div>
          </div>
        </div>
        <div className="p-10">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Личный кабинет
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Вход</h2>
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium">
              Эл. почта
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@mail.ru"
                className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]/30"
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
    </div>
  );
}
