import { headers } from "next/headers";
import { isSystemHost, normalizeHost } from "@/lib/account-domains";

export async function getPublicBasePath(publicSlug: string) {
  const headerStore = await headers();
  const customDomain = headerStore.get("x-bp-custom-domain");
  if (customDomain) return "";
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  );
  if (host && !isSystemHost(host)) return "";
  return publicSlug ? `/${publicSlug}` : "";
}
