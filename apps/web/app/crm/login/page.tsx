"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type AccountOption = { id: number; name: string; slug: string };

export default function CrmLoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[70vh] w-full max-w-xl" />}>
      <CrmLoginPageContent />
    </Suspense>
  );
}

function CrmLoginPageContent() {
  const [email, setEmail] = useState("owner@beauty.local");
  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  const urlError = useMemo(
    () => (params.get("error") === "forbidden" ? "Нет доступа к CRM для этого аккаунта." : null),
    [params]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response =
      accounts.length > 0
        ? await fetch("/api/v1/crm/auth/select-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password,
              accountId: Number(selectedAccountId),
            }),
          })
        : await fetch("/api/v1/crm/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "Неверные данные для входа.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          data?: {
            requiresAccountSelection?: boolean;
            accounts?: AccountOption[];
          };
        }
      | null;

    if (payload?.data?.requiresAccountSelection && payload.data.accounts?.length) {
      setAccounts(payload.data.accounts);
      setSelectedAccountId(String(payload.data.accounts[0].id));
      return;
    }

    window.location.href = "/crm";
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center">
      <div className="w-full rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-8 shadow-[var(--bp-shadow)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM Business
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Вход в CRM</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Доступ для владельцев и менеджеров бизнеса.
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@onlais.ru"
              className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
            />
          </label>

          <label className="text-sm font-medium">
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
            />
          </label>

          {accounts.length > 0 ? (
            <label className="text-sm font-medium">
              Выберите аккаунт
              <select
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.slug})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error || urlError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error ?? urlError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || (accounts.length > 0 && !selectedAccountId)}
            className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--bp-accent-strong)] disabled:opacity-60"
          >
            {loading ? "Вход..." : accounts.length > 0 ? "Продолжить" : "Войти"}
          </button>

          <Link
            href="/crm/register"
            className="text-center text-sm text-[color:var(--bp-accent)] hover:underline"
          >
            Зарегистрировать новый бизнес
          </Link>
        </form>
      </div>
    </div>
  );
}
