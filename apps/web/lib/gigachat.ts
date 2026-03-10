import { randomUUID } from "node:crypto";

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

let cachedAccessToken: { value: string; expiresAtMs: number } | null = null;

const DEFAULT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
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

function resolveModel() {
  return process.env.GIGACHAT_MODEL?.trim() || DEFAULT_MODEL;
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
  const model = resolveModel();
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

export async function createGigaChatCompletion(messages: ChatMessage[]): Promise<GigaChatCompletionResult> {
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

  return {
    content,
    model: payload.model || resolveModel(),
    finishReason: choice?.finish_reason ?? null,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? null,
      completionTokens: payload.usage?.completion_tokens ?? null,
      totalTokens: payload.usage?.total_tokens ?? null,
    },
  };
}
