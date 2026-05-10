import { randomUUID } from "crypto";
import Redis from "ioredis";

export type CalendarEventKind =
  | "appointment.created"
  | "group-session.participant.created"
  | "group-session.changed";

export type CalendarEvent = {
  id: string;
  accountId: number;
  kind: CalendarEventKind;
  entityId?: number;
  locationId?: number;
  specialistId?: number;
  at: string;
};

type CalendarEventListener = (event: CalendarEvent) => void;

const CALENDAR_EVENTS_CHANNEL = "beauty-platform:calendar-events";
const RECENT_EVENT_LIMIT = 1_000;

declare global {
  var __beautyPlatformCalendarEventListeners:
    | Set<CalendarEventListener>
    | undefined;
  var __beautyPlatformCalendarRedisPublisher: Redis | undefined;
  var __beautyPlatformCalendarRedisSubscriber: Redis | undefined;
  var __beautyPlatformCalendarRedisSubscribed: boolean | undefined;
  var __beautyPlatformCalendarRecentEventIds: Set<string> | undefined;
}

function getListeners() {
  if (!globalThis.__beautyPlatformCalendarEventListeners) {
    globalThis.__beautyPlatformCalendarEventListeners =
      new Set<CalendarEventListener>();
  }
  return globalThis.__beautyPlatformCalendarEventListeners;
}

function getRedisUrl() {
  return String(process.env.REDIS_URL ?? "").trim();
}

function getRecentEventIds() {
  if (!globalThis.__beautyPlatformCalendarRecentEventIds) {
    globalThis.__beautyPlatformCalendarRecentEventIds = new Set<string>();
  }
  return globalThis.__beautyPlatformCalendarRecentEventIds;
}

function rememberEventId(id: string) {
  const ids = getRecentEventIds();
  ids.add(id);
  if (ids.size <= RECENT_EVENT_LIMIT) return;
  const oldest = ids.values().next().value as string | undefined;
  if (oldest) ids.delete(oldest);
}

function dispatchCalendarEvent(payload: CalendarEvent) {
  const ids = getRecentEventIds();
  if (ids.has(payload.id)) return;
  rememberEventId(payload.id);

  for (const listener of getListeners()) {
    try {
      listener(payload);
    } catch {
      getListeners().delete(listener);
    }
  }
}

function parseCalendarEvent(raw: string): CalendarEvent | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const event = parsed as Partial<CalendarEvent>;
  if (
    typeof event.id !== "string" ||
    !Number.isInteger(event.accountId) ||
    typeof event.kind !== "string" ||
    typeof event.at !== "string"
  ) {
    return null;
  }
  return event as CalendarEvent;
}

function createRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  client.on("error", () => {
    // Redis is optional for local/dev mode; in-memory delivery remains active.
  });
  return client;
}

function ensureRedisSubscriber() {
  if (!getRedisUrl()) return;
  if (globalThis.__beautyPlatformCalendarRedisSubscribed) return;

  const subscriber =
    globalThis.__beautyPlatformCalendarRedisSubscriber ?? createRedisClient();
  if (!subscriber) return;

  globalThis.__beautyPlatformCalendarRedisSubscriber = subscriber;
  globalThis.__beautyPlatformCalendarRedisSubscribed = true;

  subscriber.on("message", (_channel, message) => {
    try {
      const event = parseCalendarEvent(message);
      if (event) dispatchCalendarEvent(event);
    } catch {
      // Ignore malformed cross-process messages.
    }
  });

  subscriber
    .connect()
    .catch(() => undefined)
    .then(() => subscriber.subscribe(CALENDAR_EVENTS_CHANNEL))
    .catch(() => {
      globalThis.__beautyPlatformCalendarRedisSubscribed = false;
    });
}

function publishCalendarEventToRedis(payload: CalendarEvent) {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return;

  const publisher =
    globalThis.__beautyPlatformCalendarRedisPublisher ?? createRedisClient();
  if (!publisher) return;

  globalThis.__beautyPlatformCalendarRedisPublisher = publisher;
  publisher
    .connect()
    .catch(() => undefined)
    .then(() => publisher.publish(CALENDAR_EVENTS_CHANNEL, JSON.stringify(payload)))
    .catch(() => undefined);
}

export function publishCalendarEvent(event: Omit<CalendarEvent, "id" | "at">) {
  const payload: CalendarEvent = {
    ...event,
    id: randomUUID(),
    at: new Date().toISOString(),
  };
  dispatchCalendarEvent(payload);
  publishCalendarEventToRedis(payload);
}

export function subscribeToCalendarEvents(listener: CalendarEventListener) {
  ensureRedisSubscriber();
  const listeners = getListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
