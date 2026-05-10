export type CalendarEventKind =
  | "appointment.created"
  | "group-session.participant.created"
  | "group-session.changed";

export type CalendarEvent = {
  accountId: number;
  kind: CalendarEventKind;
  entityId?: number;
  locationId?: number;
  specialistId?: number;
  at: string;
};

type CalendarEventListener = (event: CalendarEvent) => void;

declare global {
  var __beautyPlatformCalendarEventListeners:
    | Set<CalendarEventListener>
    | undefined;
}

function getListeners() {
  if (!globalThis.__beautyPlatformCalendarEventListeners) {
    globalThis.__beautyPlatformCalendarEventListeners =
      new Set<CalendarEventListener>();
  }
  return globalThis.__beautyPlatformCalendarEventListeners;
}

export function publishCalendarEvent(event: Omit<CalendarEvent, "at">) {
  const payload: CalendarEvent = { ...event, at: new Date().toISOString() };
  for (const listener of getListeners()) {
    try {
      listener(payload);
    } catch {
      getListeners().delete(listener);
    }
  }
}

export function subscribeToCalendarEvents(listener: CalendarEventListener) {
  const listeners = getListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
