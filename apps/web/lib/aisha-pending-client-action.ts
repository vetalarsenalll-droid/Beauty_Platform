import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type PendingClientAction =
  | { type: "cancel"; appointmentId: number }
  | { type: "reschedule"; appointmentId: number; date: string; hh: string; mm: string }
  | { type: "cancel_choice" };

const TOKEN_PREFIX = "[aisha-action:";
const TOKEN_TTL_MS = 30 * 60_000;

function signingSecret() {
  const secret = process.env.AISHA_ACTION_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (secret?.trim()) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AISHA_ACTION_SECRET or auth secret is required in production");
  }
  return "dev-aisha-action-secret";
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePendingAction(value: unknown): PendingClientAction | null {
  if (!isObject(value)) return null;
  const type = value.type;
  const appointmentId = Number(value.appointmentId);
  if (type === "cancel_choice") return { type };
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) return null;
  if (type === "cancel") return { type, appointmentId };
  if (type === "reschedule") {
    const date = typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : null;
    const hh = typeof value.hh === "string" && /^([01]\d|2[0-3])$/.test(value.hh) ? value.hh : null;
    const mm = typeof value.mm === "string" && /^[0-5]\d$/.test(value.mm) ? value.mm : null;
    if (!date || !hh || !mm) return null;
    return { type, appointmentId, date, hh, mm };
  }
  return null;
}

export function createPendingClientActionToken(action: PendingClientAction) {
  const payload = b64url(
    JSON.stringify({
      ...action,
      nonce: randomBytes(8).toString("hex"),
      exp: Date.now() + TOKEN_TTL_MS,
    }),
  );
  return `${TOKEN_PREFIX}${payload}.${sign(payload)}]`;
}

export function appendPendingClientActionToken(value: string, action: PendingClientAction) {
  return `${value} ${createPendingClientActionToken(action)}`;
}

export function extractPendingClientActionFromMessage(message: string): PendingClientAction | null {
  const escapedPrefix = TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = message.match(new RegExp(`${escapedPrefix}([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)\\]`));
  if (!match) return null;
  const [, payload, signature] = match;
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return normalizePendingAction(parsed);
  } catch {
    return null;
  }
}
