import crypto from "crypto";

type CaptchaRecord = {
  id: string;
  scope: string;
  ip: string;
  answer: string;
  expiresAt: number;
  attempts: number;
};

type RiskRecord = {
  count: number;
  resetAt: number;
};

type CaptchaStore = Map<string, CaptchaRecord> & { __lastGcAt?: number };
type RiskStore = Map<string, RiskRecord> & { __lastGcAt?: number };

const globalState = globalThis as typeof globalThis & {
  __bpCaptchaStore?: CaptchaStore;
  __bpCaptchaRiskStore?: RiskStore;
};

function getIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function getCaptchaStore(): CaptchaStore {
  if (!globalState.__bpCaptchaStore) {
    globalState.__bpCaptchaStore = new Map() as CaptchaStore;
    globalState.__bpCaptchaStore.__lastGcAt = 0;
  }
  return globalState.__bpCaptchaStore;
}

function getRiskStore(): RiskStore {
  if (!globalState.__bpCaptchaRiskStore) {
    globalState.__bpCaptchaRiskStore = new Map() as RiskStore;
    globalState.__bpCaptchaRiskStore.__lastGcAt = 0;
  }
  return globalState.__bpCaptchaRiskStore;
}

function maybeGcCaptcha(now: number) {
  const store = getCaptchaStore();
  if (now - (store.__lastGcAt ?? 0) < 60_000) return;
  store.__lastGcAt = now;
  for (const [key, item] of store.entries()) {
    if (item.expiresAt <= now || item.attempts >= 5) {
      store.delete(key);
    }
  }
}

function maybeGcRisk(now: number) {
  const store = getRiskStore();
  if (now - (store.__lastGcAt ?? 0) < 60_000) return;
  store.__lastGcAt = now;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function shouldRequireCaptcha(input: {
  request: Request;
  scope: string;
  identity?: string;
  threshold: number;
  windowMs: number;
}) {
  const now = Date.now();
  maybeGcRisk(now);
  const ip = getIp(input.request);
  const suffix = input.identity?.trim()
    ? `${ip}:${input.identity.trim().toLowerCase()}`
    : ip;
  const key = `${input.scope}:${suffix}`;

  const store = getRiskStore();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + input.windowMs });
    return false;
  }

  current.count += 1;
  store.set(key, current);
  return current.count > input.threshold;
}

export function clearCaptchaRisk(input: {
  request: Request;
  scope: string;
  identity?: string;
}) {
  const ip = getIp(input.request);
  const suffix = input.identity?.trim()
    ? `${ip}:${input.identity.trim().toLowerCase()}`
    : ip;
  const key = `${input.scope}:${suffix}`;
  getRiskStore().delete(key);
}

export function createCaptchaChallenge(input: {
  request: Request;
  scope: string;
  ttlMs?: number;
}) {
  const ttlMs = input.ttlMs ?? 10 * 60 * 1000;
  const now = Date.now();
  maybeGcCaptcha(now);

  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const op = Math.random() > 0.5 ? "+" : "-";
  const answer = op === "+" ? String(a + b) : String(a - b);
  const id = crypto.randomUUID();
  const ip = getIp(input.request);

  const record: CaptchaRecord = {
    id,
    scope: input.scope,
    ip,
    answer,
    expiresAt: now + ttlMs,
    attempts: 0,
  };

  getCaptchaStore().set(`${input.scope}:${id}`, record);

  return {
    captchaId: id,
    question: `${a} ${op} ${b} = ?`,
    expiresAt: new Date(record.expiresAt).toISOString(),
  };
}

export function verifyCaptchaChallenge(input: {
  request: Request;
  scope: string;
  captchaId: string;
  answer: string;
}) {
  const now = Date.now();
  maybeGcCaptcha(now);

  const key = `${input.scope}:${input.captchaId.trim()}`;
  const store = getCaptchaStore();
  const item = store.get(key);
  if (!item) return { ok: false, code: "CAPTCHA_INVALID_OR_EXPIRED" as const };
  if (item.expiresAt <= now) {
    store.delete(key);
    return { ok: false, code: "CAPTCHA_EXPIRED" as const };
  }

  const ip = getIp(input.request);
  if (item.ip !== ip) {
    return { ok: false, code: "CAPTCHA_IP_MISMATCH" as const };
  }

  item.attempts += 1;
  if (item.attempts > 5) {
    store.delete(key);
    return { ok: false, code: "CAPTCHA_TOO_MANY_ATTEMPTS" as const };
  }

  const valid = item.answer === input.answer.trim();
  if (!valid) {
    store.set(key, item);
    return { ok: false, code: "CAPTCHA_INVALID_ANSWER" as const };
  }

  store.delete(key);
  return { ok: true as const };
}

