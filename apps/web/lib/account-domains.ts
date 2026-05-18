import dns from "node:dns/promises";
import { buildPublicSlugId } from "@/lib/public-slug";

export type AccountDomainStatus = "PENDING" | "DNS_OK" | "ACTIVE" | "ERROR";
export type AccountDomainSslStatus = "PENDING" | "ISSUING" | "ACTIVE" | "ERROR";

export type DomainDnsCheck = {
  expectedIp: string;
  root: {
    host: string;
    ips: string[];
    ok: boolean;
    error: string | null;
  };
  www: {
    host: string;
    ips: string[];
    ok: boolean;
    error: string | null;
  };
  ok: boolean;
  warning: string | null;
  error: string | null;
};

const DEFAULT_SYSTEM_DOMAINS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getPlatformPublicOrigin() {
  return process.env.PLATFORM_PUBLIC_ORIGIN?.trim() || "http://localhost:3000";
}

export function getPlatformPublicIp() {
  return process.env.PLATFORM_PUBLIC_IP?.trim() || "127.0.0.1";
}

export function getSystemDomains() {
  const configured = (process.env.PLATFORM_SYSTEM_DOMAINS ?? "")
    .split(",")
    .map((item) => normalizeHost(item))
    .filter(Boolean);
  const originHost = normalizeHost(getPlatformPublicOrigin());
  return new Set([...DEFAULT_SYSTEM_DOMAINS, ...configured, originHost].filter(Boolean));
}

export function normalizeHost(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  const host = withoutProtocol.split(/[/?#]/)[0] ?? "";
  return host.replace(/:\d+$/, "").replace(/\.$/, "");
}

export function normalizeDomainInput(value: unknown) {
  const host = normalizeHost(typeof value === "string" ? value : "");
  if (!host) return { domain: "", error: "Введите домен." };
  if (host.includes("*")) return { domain: host, error: "Wildcard-домены пока не поддерживаются." };
  if (host.includes(" ")) return { domain: host, error: "Домен не должен содержать пробелы." };
  if (host === "localhost") return { domain: host, error: "localhost нельзя подключить как домен." };
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return { domain: host, error: "IP-адрес нельзя подключить вместо домена." };
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-zа-яё]{2,}$/iu.test(host)) {
    return { domain: host, error: "Некорректный домен." };
  }
  if (getSystemDomains().has(host)) {
    return { domain: host, error: "Служебный домен платформы нельзя подключить." };
  }
  return { domain: host, error: null };
}

async function resolveA(host: string): Promise<{ ips: string[]; error: string | null }> {
  try {
    const ips = await dns.resolve4(host);
    return { ips, error: null };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "DNS_ERROR";
    return { ips: [], error: code };
  }
}

export async function checkDomainDns(domain: string): Promise<DomainDnsCheck> {
  const expectedIp = getPlatformPublicIp();
  const wwwHost = domain.startsWith("www.") ? domain : `www.${domain}`;
  const [root, www] = await Promise.all([resolveA(domain), resolveA(wwwHost)]);
  const rootOk = root.ips.includes(expectedIp);
  const wwwOk = www.ips.includes(expectedIp);
  const rootError = root.error ?? null;
  const wwwError = www.error ?? null;
  const ok = rootOk;
  return {
    expectedIp,
    root: { host: domain, ips: root.ips, ok: rootOk, error: rootError },
    www: { host: wwwHost, ips: www.ips, ok: wwwOk, error: wwwError },
    ok,
    warning: ok && !wwwOk ? "www-запись пока не указывает на сервер платформы." : null,
    error: ok ? null : "Основной домен пока не указывает на сервер платформы.",
  };
}

export function getDomainStatusFromDns(check: DomainDnsCheck): AccountDomainStatus {
  return check.ok ? "ACTIVE" : "ERROR";
}

export function buildAccountPublicSlug(account: { id: number; slug: string }) {
  return buildPublicSlugId(account.slug, account.id);
}

export function isSystemHost(host: string) {
  return getSystemDomains().has(normalizeHost(host));
}
