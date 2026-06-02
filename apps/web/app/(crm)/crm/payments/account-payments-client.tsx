"use client";

import { useMemo, useState } from "react";

type ProviderCode = "yookassa" | "tbank" | "sber" | "alfa";

type Connection = {
  id: number;
  provider: "YOOKASSA" | "TBANK" | "SBER" | "ALFA";
  mode: "TEST" | "LIVE";
  title: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  credentialsMasked: Record<string, unknown> | null;
  receiptEnabled: boolean;
  receiptVat: string;
  receiptTaxationSystem: string;
  currency: string;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
};

type Props = {
  initialConnections: Connection[];
};

const providerLabels: Record<ProviderCode, string> = {
  yookassa: "ЮKassa",
  tbank: "Т-Банк",
  sber: "Сбер",
  alfa: "Альфа-Банк",
};

const providerFromDb: Record<Connection["provider"], ProviderCode> = {
  YOOKASSA: "yookassa",
  TBANK: "tbank",
  SBER: "sber",
  ALFA: "alfa",
};

export default function AccountPaymentsClient({ initialConnections }: Props) {
  const [connections, setConnections] = useState(initialConnections);
  const [provider, setProvider] = useState<ProviderCode>(providerFromDb[initialConnections[0]?.provider] ?? "yookassa");
  const [mode, setMode] = useState<"TEST" | "LIVE">("TEST");
  const [isEnabled, setIsEnabled] = useState(true);
  const [receiptEnabled, setReceiptEnabled] = useState(false);
  const [receiptVat, setReceiptVat] = useState("NONE");
  const [taxation, setTaxation] = useState("DEFAULT");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => connections.find((item) => providerFromDb[item.provider] === provider) ?? null,
    [connections, provider],
  );

  const webhookUrl = typeof window === "undefined" ? "" : `${window.location.origin}/api/v1/account-payments/${provider}/webhook`;

  async function saveConnection() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/crm/account-payments/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          mode,
          isEnabled,
          isDefault: true,
          receiptEnabled,
          receiptVat,
          receiptTaxationSystem: taxation,
          paymentSubject: "service",
          paymentMethod: "full_payment",
          currency: "RUB",
          credentials,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { connection?: Connection }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data?.connection) {
        setMessage(payload?.error?.message ?? "Не удалось сохранить подключение");
        return;
      }
      const saved = payload.data.connection;
      setConnections((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setCredentials({});
      setMessage("Подключение сохранено.");
    } catch {
      setMessage("Не удалось сохранить подключение");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Прием оплат от клиентов</h2>
          <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
            Реквизиты салона для оплаты записей, услуг, товаров и сертификатов.
          </p>
        </div>
        <div className="text-xs text-[color:var(--bp-muted)]">
          {selected ? `Подключено: ${providerLabels[provider]}` : "Подключение не настроено"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          <label className="text-sm font-medium">Провайдер</label>
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as ProviderCode);
              setCredentials({});
            }}
            className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm"
          >
            <option value="yookassa">ЮKassa</option>
            <option value="tbank">Т-Банк</option>
            <option value="sber">Сбер</option>
            <option value="alfa">Альфа-Банк</option>
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "TEST" | "LIVE")}
              className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm"
            >
              <option value="TEST">Тест</option>
              <option value="LIVE">Рабочий</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm">
              <input type="checkbox" checked={isEnabled} onChange={(event) => setIsEnabled(event.target.checked)} />
              Включено
            </label>
          </div>

          {selected?.credentialsMasked ? (
            <div className="rounded-xl bg-[color:var(--input-bg)] p-3 text-xs text-[color:var(--bp-muted)]">
              Сохраненные реквизиты: {Object.entries(selected.credentialsMasked).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <CredentialFields provider={provider} credentials={credentials} setCredentials={setCredentials} />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm">
              <input type="checkbox" checked={receiptEnabled} onChange={(event) => setReceiptEnabled(event.target.checked)} />
              Передавать чек
            </label>
            <select value={receiptVat} onChange={(event) => setReceiptVat(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm">
              <option value="NONE">Без НДС</option>
              <option value="VAT_0">НДС 0%</option>
              <option value="VAT_5">НДС 5%</option>
              <option value="VAT_7">НДС 7%</option>
              <option value="VAT_10">НДС 10%</option>
              <option value="VAT_20">НДС 20%</option>
            </select>
            <select value={taxation} onChange={(event) => setTaxation(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm">
              <option value="DEFAULT">По умолчанию</option>
              <option value="OSN">ОСН</option>
              <option value="USN_INCOME">УСН доходы</option>
              <option value="USN_INCOME_OUTCOME">УСН доходы-расходы</option>
              <option value="PATENT">Патент</option>
            </select>
          </div>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-xs text-[color:var(--bp-muted)]">
            URL уведомлений: <span className="break-all text-[color:var(--bp-ink)]">{webhookUrl}</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={saveConnection} disabled={saving} className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? "Сохраняем..." : "Сохранить подключение"}
            </button>
            {message ? <span className="text-sm text-[color:var(--bp-muted)]">{message}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function CredentialFields({
  provider,
  credentials,
  setCredentials,
}: {
  provider: ProviderCode;
  credentials: Record<string, string>;
  setCredentials: (value: Record<string, string>) => void;
}) {
  const fields =
    provider === "yookassa"
      ? [
          ["shopId", "Номер магазина"],
          ["secretKey", "Секретный ключ API"],
        ]
      : provider === "tbank"
        ? [
            ["terminalKey", "Terminal Key"],
            ["password", "Пароль"],
            ["apiUrl", "API URL"],
          ]
        : [
            ["apiLogin", "Логин API"],
            ["apiPassword", "Пароль API"],
            ["apiUrl", "API URL"],
          ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(([key, label]) => (
        <input
          key={key}
          value={credentials[key] ?? ""}
          onChange={(event) => setCredentials({ ...credentials, [key]: event.target.value })}
          placeholder={label}
          type={key.toLowerCase().includes("password") || key.toLowerCase().includes("secret") ? "password" : "text"}
          className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm"
        />
      ))}
    </div>
  );
}
