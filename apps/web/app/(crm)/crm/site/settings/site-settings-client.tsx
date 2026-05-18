"use client";

import { useMemo, useState } from "react";

type DomainItem = {
  id: number;
  domain: string;
  isPrimary: boolean;
  status: string;
  sslStatus: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type DnsCheck = {
  expectedIp: string;
  root: { host: string; ips: string[]; ok: boolean; error: string | null };
  www: { host: string; ips: string[]; ok: boolean; error: string | null };
  ok: boolean;
  warning: string | null;
  error: string | null;
};

type SiteSettingsClientProps = {
  accountName: string;
  technicalUrl: string;
  domainPlaceholder: string;
  platformPublicIp: string;
  initialDomains: DomainItem[];
};

const statusLabel: Record<string, string> = {
  PENDING: "Ожидает DNS",
  DNS_OK: "DNS настроен",
  ACTIVE: "Активен",
  ERROR: "Ошибка DNS",
};

const sslLabel: Record<string, string> = {
  PENDING: "Ожидает выпуска",
  ISSUING: "Выпускается",
  ACTIVE: "HTTPS активен",
  ERROR: "Ошибка SSL",
};

function formatDate(value: string | null) {
  if (!value) return "Еще не проверялся";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SiteSettingsClient({
  accountName,
  technicalUrl,
  domainPlaceholder,
  platformPublicIp,
  initialDomains,
}: SiteSettingsClientProps) {
  const [domainInput, setDomainInput] = useState("");
  const [domains, setDomains] = useState<DomainItem[]>(initialDomains);
  const [checks, setChecks] = useState<Record<number, DnsCheck>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const primaryDomain = useMemo(
    () => domains.find((domain) => domain.isPrimary) ?? domains[0] ?? null,
    [domains]
  );

  const reloadDomains = async () => {
    const response = await fetch("/api/v1/crm/site/domains");
    const payload = await response.json();
    setDomains(payload.data.domains);
  };

  const addDomain = async () => {
    setMessage(null);
    setLoading("add");
    try {
      const response = await fetch("/api/v1/crm/site/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error?.message ?? "Не удалось добавить домен.");
        return;
      }
      setDomainInput("");
      await reloadDomains();
      setMessage("Домен добавлен. Теперь проверьте DNS.");
    } finally {
      setLoading(null);
    }
  };

  const checkDomain = async (id: number) => {
    setMessage(null);
    setLoading(`check:${id}`);
    try {
      const response = await fetch(`/api/v1/crm/site/domains/${id}/check`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error?.message ?? "Не удалось проверить домен.");
        return;
      }
      setChecks((prev) => ({ ...prev, [id]: payload.data.check }));
      await reloadDomains();
      setMessage(payload.data.check.ok ? "DNS настроен корректно." : "DNS пока настроен неверно.");
    } finally {
      setLoading(null);
    }
  };

  const makePrimary = async (id: number) => {
    setLoading(`primary:${id}`);
    try {
      await fetch(`/api/v1/crm/site/domains/${id}/primary`, { method: "PATCH" });
      await reloadDomains();
    } finally {
      setLoading(null);
    }
  };

  const deleteDomain = async (id: number) => {
    if (!window.confirm("Удалить домен из сайта?")) return;
    setLoading(`delete:${id}`);
    try {
      await fetch(`/api/v1/crm/site/domains/${id}`, { method: "DELETE" });
      await reloadDomains();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Настройки сайта
        </div>
        <h1 className="mt-2 text-3xl font-light text-[color:var(--bp-ink)]">{accountName}</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Управление техническим адресом и собственным доменом сайта.
        </p>
      </section>

      <section className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Публичный адрес</div>
        <div className="mt-4 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
            Технический адрес
          </div>
          <a href={technicalUrl} target="_blank" className="mt-2 block break-all text-sm underline">
            {technicalUrl}
          </a>
          <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
            Этот адрес остается рабочим даже после подключения своего домена.
          </div>
        </div>
        {primaryDomain ? (
          <div className="mt-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
              Основной домен
            </div>
            <a href={`https://${primaryDomain.domain}`} target="_blank" className="mt-2 block break-all text-sm underline">
              https://{primaryDomain.domain}
            </a>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Свой домен</div>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--bp-muted)]">
              Оставьте DNS у регистратора и измените только ресурсные записи. Не указывайте ns1/ns2.
            </p>
          </div>
          <div className="rounded-full bg-[color:var(--bp-chip)] px-3 py-1 text-xs text-[color:var(--bp-muted)]">
            IP сервера: {platformPublicIp}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder={domainPlaceholder}
            className="h-12 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          />
          <button
            type="button"
            onClick={addDomain}
            disabled={loading === "add"}
            className="rounded-2xl bg-[color:var(--bp-ink)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading === "add" ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        {message ? <div className="mt-3 text-sm text-[color:var(--bp-muted)]">{message}</div> : null}

        <div className="mt-6 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
            DNS-инструкция
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                <tr>
                  <th className="py-2 pr-4">Тип</th>
                  <th className="py-2 pr-4">Имя</th>
                  <th className="py-2 pr-4">Значение</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[color:var(--bp-stroke)]">
                  <td className="py-3 pr-4 font-semibold">A</td>
                  <td className="py-3 pr-4">@</td>
                  <td className="py-3 pr-4">{platformPublicIp}</td>
                </tr>
                <tr className="border-t border-[color:var(--bp-stroke)]">
                  <td className="py-3 pr-4 font-semibold">A</td>
                  <td className="py-3 pr-4">www</td>
                  <td className="py-3 pr-4">{platformPublicIp}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 divide-y divide-[color:var(--bp-stroke)] rounded-2xl border border-[color:var(--bp-stroke)]">
          {domains.length > 0 ? (
            domains.map((domain) => {
              const check = checks[domain.id];
              return (
                <div key={domain.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{domain.domain}</div>
                        {domain.isPrimary ? (
                          <span className="rounded-full bg-[color:var(--bp-chip)] px-2 py-1 text-xs text-[color:var(--bp-muted)]">
                            основной
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                        DNS: {statusLabel[domain.status] ?? domain.status} · SSL: {sslLabel[domain.sslStatus] ?? domain.sslStatus}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                        Последняя проверка: {formatDate(domain.lastCheckedAt)}
                      </div>
                      {domain.lastError ? (
                        <div className="mt-1 text-xs text-[#b45309]">{domain.lastError}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => checkDomain(domain.id)}
                        disabled={loading === `check:${domain.id}`}
                        className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)] disabled:opacity-60"
                      >
                        {loading === `check:${domain.id}` ? "Проверяем..." : "Проверить"}
                      </button>
                      {!domain.isPrimary ? (
                        <button
                          type="button"
                          onClick={() => makePrimary(domain.id)}
                          className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)]"
                        >
                          Сделать основным
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteDomain(domain.id)}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  {check ? (
                    <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
                      <DnsResult title="Основной домен" result={check.root} expectedIp={check.expectedIp} />
                      <DnsResult title="www" result={check.www} expectedIp={check.expectedIp} />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="p-4 text-sm text-[color:var(--bp-muted)]">
              Домены пока не подключены.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DnsResult({
  title,
  result,
  expectedIp,
}: {
  title: string;
  result: DnsCheck["root"];
  expectedIp: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
      <div className="font-semibold">{title}</div>
      <div className={result.ok ? "mt-1 text-green-600" : "mt-1 text-[#b45309]"}>
        {result.ok ? "Указывает на сервер платформы" : "Пока не указывает на сервер платформы"}
      </div>
      <div className="mt-1 text-[color:var(--bp-muted)]">Хост: {result.host}</div>
      <div className="mt-1 text-[color:var(--bp-muted)]">
        Текущие IP: {result.ips.length ? result.ips.join(", ") : result.error ?? "нет A-записи"}
      </div>
      <div className="mt-1 text-[color:var(--bp-muted)]">Нужный IP: {expectedIp}</div>
    </div>
  );
}
