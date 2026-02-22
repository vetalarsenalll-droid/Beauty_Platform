import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
  identity?: string;
};

type StoreWithGc = Map<string, Bucket> & { __lastGcAt?: number };

const globalStore = globalThis as typeof globalThis & {
  __bpRateLimitStore?: StoreWithGc;
};

function getStore(): StoreWithGc {
  if (!globalStore.__bpRateLimitStore) {
    globalStore.__bpRateLimitStore = new Map() as StoreWithGc;
    globalStore.__bpRateLimitStore.__lastGcAt = 0;
  }
  return globalStore.__bpRateLimitStore;
}

function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function maybeGc(store: StoreWithGc, now: number) {
  const lastGcAt = store.__lastGcAt ?? 0;
  if (now - lastGcAt < 60_000) return;
  store.__lastGcAt = now;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function enforceRateLimit({
  request,
  scope,
  limit,
  windowMs,
  identity,
}: RateLimitOptions) {
  const now = Date.now();
  const store = getStore();
  maybeGc(store, now);

  const ip = getRequestIp(request);
  const suffix = identity?.trim() ? `${ip}:${identity.trim()}` : ip;
  const key = `${scope}:${suffix}`;
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Слишком много запросов. Попробуйте позже.",
          details: { retryAfterSec },
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  bucket.count += 1;
  store.set(key, bucket);
  return null;
}
