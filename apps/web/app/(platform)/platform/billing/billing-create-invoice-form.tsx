"use client";

import { useState } from "react";

type AccountOption = {
  id: number;
  name: string;
};

type BillingCreateInvoiceFormProps = {
  accounts: AccountOption[];
};

export default function BillingCreateInvoiceForm({
  accounts,
}: BillingCreateInvoiceFormProps) {
  const [accountId, setAccountId] = useState(
    accounts[0]?.id ? String(accounts[0].id) : ""
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/v1/platform/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: Number(accountId),
          amount,
          currency,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось выставить счет");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось выставить счет");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Аккаунт
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Сумма
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            placeholder="Например, 5000"
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Валюта
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Оплатить до
          <input
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
      >
        {saving ? "Выставление..." : "Выставить счет"}
      </button>
    </form>
  );
}
