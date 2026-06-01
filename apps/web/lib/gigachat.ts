import { randomUUID } from "node:crypto";
import { checkAiAccessAllowed } from "@/lib/ai-billing";
import { getGlobalAiSetting } from "@/lib/ai-settings";
import { getAiUsageContext, recordAiUsage } from "@/lib/ai-usage";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type GigaChatCompletionResult = {
  content: string;
  model: string;
  finishReason: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

type GigaChatCompletionOptions = {
  purpose?: string;
  scope?: "public_site" | "crm_agent";
};

type OAuthResponse = {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
};

type CompletionResponse = {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string;
    };
  }>;
};

export type GigaChatBalanceItem = {
  model: string;
  remainingTokens: number;
  totalTokens: number | null;
  expiresAt: string | null;
};

export type GigaChatBalanceResult = {
  ok: boolean;
  items: GigaChatBalanceItem[];
  error: string | null;
};

let cachedAccessToken: { value: string; expiresAtMs: number } | null = null;

const DEFAULT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
const DEFAULT_API_BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1";
const DEFAULT_MODEL = "GigaChat";
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const PROXY_ENV_KEYS = ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"] as const;

async function withGigaChatNetworkEnv<T>(fn: () => Promise<T>) {
  const savedProxyEntries = PROXY_ENV_KEYS.map((key) => [key, process.env[key]] as const);
  const savedTlsValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  const allowInsecureTls = process.env.GIGACHAT_ALLOW_INSECURE_TLS === "true";

  for (const [key] of savedProxyEntries) {
    delete process.env[key];
  }
  if (allowInsecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of savedProxyEntries) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (savedTlsValue === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = savedTlsValue;
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveAuthUrl() {
  return process.env.GIGACHAT_AUTH_URL?.trim() || DEFAULT_AUTH_URL;
}

function resolveChatUrl() {
  return process.env.GIGACHAT_API_URL?.trim() || DEFAULT_CHAT_URL;
}

function resolveApiBaseUrl() {
  const explicit = process.env.GIGACHAT_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const chatUrl = resolveChatUrl();
  return chatUrl.replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
}

async function resolveModel() {
  return (await getGlobalAiSetting("gigachat.model")) || process.env.GIGACHAT_MODEL?.trim() || DEFAULT_MODEL;
}

async function fetchAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - TOKEN_SAFETY_WINDOW_MS > now) {
    return cachedAccessToken.value;
  }

  const authKey = requireEnv("GIGACHAT_AUTH_KEY");
  let response: Response;
  try {
    response = await withGigaChatNetworkEnv(() =>
      fetch(resolveAuthUrl(), {
        method: "POST",
        headers: {
          Authorization: `Basic ${authKey}`,
          RqUID: randomUUID(),
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "scope=GIGACHAT_API_PERS",
        cache: "no-store",
      })
    );
  } catch (error) {
    console.error("[gigachat] auth request failed", error);
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[gigachat] auth failed", {
      status: response.status,
      statusText: response.statusText,
      url: resolveAuthUrl(),
      body: errorText.slice(0, 600),
    });
    throw new Error(`GigaChat auth failed (${response.status}): ${errorText || "unknown error"}`);
  }

  const payload = (await response.json()) as OAuthResponse;
  if (!payload?.access_token) {
    throw new Error("GigaChat auth failed: access_token is missing");
  }

  const expiresAtMs = payload.expires_at
    ? payload.expires_at * 1000
    : now + (payload.expires_in ?? 1800) * 1000;

  cachedAccessToken = {
    value: payload.access_token,
    expiresAtMs,
  };

  return payload.access_token;
}

async function requestCompletion(messages: ChatMessage[], accessToken: string) {
  const model = await resolveModel();
  return withGigaChatNetworkEnv(() =>
    fetch(resolveChatUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 500,
        stream: false,
      }),
      cache: "no-store",
    })
  );
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectBalanceItems(value: unknown): GigaChatBalanceItem[] {
  const items: GigaChatBalanceItem[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const model =
      readString(record.model) ??
      readString(record.name) ??
      readString(record.model_name) ??
      readString(record.usage);
    const remaining =
      readNumber(record.remaining_tokens) ??
      readNumber(record.available_tokens) ??
      readNumber(record.balance) ??
      readNumber(record.tokens) ??
      readNumber(record.value);
    if (model && remaining != null) {
      items.push({
        model,
        remainingTokens: Math.max(0, Math.round(remaining)),
        totalTokens:
          readNumber(record.total_tokens) ??
          readNumber(record.package_tokens) ??
          readNumber(record.initial_tokens) ??
          null,
        expiresAt:
          readString(record.expires_at) ??
          readString(record.expired_at) ??
          readString(record.valid_until) ??
          readString(record.expiration_date),
      });
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child);
    }
  };
  visit(value);
  return items;
}

export async function getGigaChatBalance(): Promise<GigaChatBalanceResult> {
  if (!process.env.GIGACHAT_AUTH_KEY?.trim()) {
    return { ok: false, items: [], error: "GIGACHAT_AUTH_KEY is not configured" };
  }

  try {
    const accessToken = await fetchAccessToken();
    const response = await withGigaChatNetworkEnv(() =>
      fetch(`${resolveApiBaseUrl()}/balance`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      })
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        items: [],
        error: `GigaChat balance failed (${response.status}): ${errorText || response.statusText}`,
      };
    }

    const payload = await response.json();
    return { ok: true, items: collectBalanceItems(payload), error: null };
  } catch (error) {
    console.error("[gigachat] balance request failed", error);
    return { ok: false, items: [], error: error instanceof Error ? error.message : "unknown error" };
  }
}

export async function createGigaChatCompletion(
  messages: ChatMessage[],
  options: GigaChatCompletionOptions = {},
): Promise<GigaChatCompletionResult> {
  const usageContext = getAiUsageContext();
  if (usageContext?.accountId) {
    const access = await checkAiAccessAllowed(usageContext.accountId, options.scope ?? "public_site", {
      actionId: usageContext.actionId,
    });
    if (!access.allowed) {
      throw new Error(`AI access denied: ${access.reason ?? "ai_access_denied"}`);
    }
  }

  let accessToken = await fetchAccessToken();
  let response: Response;

  try {
    response = await requestCompletion(messages, accessToken);
  } catch (error) {
    console.error("[gigachat] completion request failed", error);
    throw error;
  }

  if (response.status === 401 || response.status === 403) {
    // Token might have been invalidated during idle; refresh once and retry.
    cachedAccessToken = null;
    accessToken = await fetchAccessToken();
    try {
      response = await requestCompletion(messages, accessToken);
    } catch (error) {
      console.error("[gigachat] completion retry failed", error);
      throw error;
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[gigachat] completion failed", {
      status: response.status,
      statusText: response.statusText,
      url: resolveChatUrl(),
      body: errorText.slice(0, 600),
    });
    throw new Error(`GigaChat completion failed (${response.status}): ${errorText || "unknown error"}`);
  }

  const payload = (await response.json()) as CompletionResponse;
  const choice = payload.choices?.[0];
  const content = choice?.message?.content?.trim();

  if (!content) {
    throw new Error("GigaChat completion failed: empty content");
  }

  const result = {
    content,
    model: payload.model || (await resolveModel()),
    finishReason: choice?.finish_reason ?? null,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      totalTokens: payload.usage?.total_tokens ?? null,
    },
  };

  await recordAiUsage({
    provider: "gigachat",
    model: result.model,
    purpose: options.purpose ?? "completion",
    usage: result.usage,
  });

  return result;
}
