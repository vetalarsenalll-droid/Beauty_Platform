import { createHmac, timingSafeEqual } from "crypto";

export const BOOKING_HOLD_COOKIE = "bp_booking_hold";

type HoldProofPayload = {
  holdId: number;
  accountId: number;
  specialistId: number;
  startAt: string;
  endAt: string;
  expiresAt: string;
};

type VerifyInput = {
  holdId: number;
  accountId: number;
  specialistId: number;
  startAt: Date;
  endAt: Date;
};

function getSecret() {
  return (
    process.env.PUBLIC_BOOKING_HOLD_SECRET ??
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-public-booking-hold-secret"
  );
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function createHoldProofToken(payload: HoldProofPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyHoldProofToken(token: string, expected: VerifyInput) {
  if (!token || !token.includes(".")) return false;

  const [encoded, signature] = token.split(".", 2);
  if (!encoded || !signature) return false;

  const expectedSignature = sign(encoded);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<HoldProofPayload>;

    if (
      !Number.isInteger(payload.holdId) ||
      !Number.isInteger(payload.accountId) ||
      !Number.isInteger(payload.specialistId) ||
      typeof payload.startAt !== "string" ||
      typeof payload.endAt !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return false;
    }

    if (new Date(payload.expiresAt).getTime() <= Date.now()) return false;

    return (
      payload.holdId === expected.holdId &&
      payload.accountId === expected.accountId &&
      payload.specialistId === expected.specialistId &&
      payload.startAt === expected.startAt.toISOString() &&
      payload.endAt === expected.endAt.toISOString()
    );
  } catch {
    return false;
  }
}
