import { cookies } from "next/headers";
import type { ClientSocialProvider } from "@/lib/client-social-auth";
import { randomOAuthState, safeClientReturnTo } from "@/lib/client-social-auth";

type OAuthStatePayload = {
  state: string;
  accountSlug: string | null;
  returnTo: string;
};

function stateCookieName(provider: ClientSocialProvider) {
  return `bp_client_oauth_${provider.toLowerCase()}_state`;
}

function encodePayload(payload: OAuthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed.state || !parsed.returnTo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createClientOAuthState(provider: ClientSocialProvider, accountSlug?: string | null, returnTo?: string | null) {
  const state = randomOAuthState();
  const payload: OAuthStatePayload = {
    state,
    accountSlug: accountSlug || null,
    returnTo: safeClientReturnTo(returnTo, accountSlug),
  };
  const cookieStore = await cookies();
  cookieStore.set(stateCookieName(provider), encodePayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return payload;
}

export async function consumeClientOAuthState(provider: ClientSocialProvider, state: string | null) {
  const cookieStore = await cookies();
  const name = stateCookieName(provider);
  const payload = decodePayload(cookieStore.get(name)?.value ?? "");
  cookieStore.delete(name);
  if (!payload || !state || payload.state !== state) return null;
  return payload;
}

export function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export function appendParams(url: string, params: Record<string, string | undefined | null>) {
  const next = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value) next.searchParams.set(key, value);
  });
  return next;
}

