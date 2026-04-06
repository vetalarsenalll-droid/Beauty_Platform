"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SiteLoaderConfig } from "@/lib/site-builder";
import SiteLoader from "@/components/site-loader";
import { normalizeRuPhone } from "@/lib/phone";

type BookingClientProps = {
  accountSlug?: string;
  accountPublicSlug?: string;
  loaderConfig?: SiteLoaderConfig | null;
};

type PublicAccount = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
  slotStepMinutes?: number;
};

type Location = {
  id: number;
  name: string;
  address: string | null;
  coverUrl?: string | null;
  hours?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  exceptions?: Array<{
    date: string; // YYYY-MM-DD in account TZ
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
  }>;
};

type Service = {
  id: number;
  name: string;
  description: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  baseDurationMin: number;
  basePrice: number;
  computedDurationMin?: number | null;
  computedPrice?: number | null;
  minDurationMin?: number | null;
  minPrice?: number | null;
  specialistIds?: number[];
  allowMultiServiceBooking?: boolean;
  bookingType?: "SINGLE" | "GROUP";
  groupCapacityDefault?: number | null;
  coverUrl?: string | null;
};

type Specialist = {
  id: number;
  name: string;
  role: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  servicePrice?: number | null;
  serviceDurationMin?: number | null;
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
};

type Slot = {
  time: string; // "HH:mm"
  specialistId: number;
};

type GroupSessionSlot = {
  id: number;
  specialistId: number;
  time: string;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  availableSeats: number;
  pricePerClient: number | null;
};

type ChainItem = {
  serviceId: number;
  specialistId: number | null;
  date: string; // YYYY-MM-DD
  time: string | null;
  holdId?: number;
};

type ActiveHold = {
  holdId: number;
  expiresAt: string;
  locationId: number;
  specialistId: number;
  serviceId: number;
  serviceIds: number[];
  date: string;
  time: string;
};

type ContextData = {
  account: PublicAccount;
  locations: Location[];
  legalDocuments?: LegalDocument[];
  platformLegalDocuments?: LegalDocument[];
};

type ServicesData = {
  services: Service[];
};

type SpecialistsData = {
  specialists: Specialist[];
};

type SlotsData = {
  slots: Slot[];
};

type ClientProfile = {
  id: number | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type AvailabilityCalendar = {
  start: string;
  days: Array<{
    date: string; // YYYY-MM-DD (в TZ аккаунта)
    times: Array<{
      time: string; // HH:mm
      specialistIds: number[];
    }>;
  }>;
};

type AvailabilitySpecialists = {
  specialistIds: number[];
};

type LegalDocument = {
  id: number;
  title: string;
  description?: string | null;
  isRequired: boolean;
  versionId: number;
  version: number;
  content: string;
  publishedAt: string;
};

type TimeBucket = "all" | "morning" | "day" | "evening";
type Scenario = "dateFirst" | "serviceFirst" | "specialistFirst";
type BookingUiStepKey = "scenario" | "location" | "service" | "specialist" | "datetime" | "chain" | "details";
type BookingPersistedState = {
  scenario: Scenario;
  startScenario: boolean;
  locationId: number | null;
  serviceId: number | null;
  serviceIds: number[];
  specialistId: number | null;
  dateYmd: string;
  timeChoice: string | null;
  timeBucket: TimeBucket;
  query: string;
  specialistQuery: string;
  selectedServiceCategory: string;
  selectedSpecialistCategory: string;
  stepKey: BookingUiStepKey | null;
  updatedAt: number;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatMoneyRub = (value: number) => {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ₽`;
  }
};

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
};

const makeIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const minutesToTime = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
};

const formatTimeInTz = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));

const addMinutes = (time: string, minutes: number) => {
  const start = timeToMinutes(time);
  if (start === null) return "";
  return minutesToTime(start + minutes);
};

type BookingApiError = Error & {
  code?: string;
  details?: { waitSeconds?: number; expiresAt?: string | null } | null;
};

const formatWaitTimeRu = (secondsRaw: number) => {
  const totalSeconds = Math.max(1, Math.ceil(secondsRaw));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} сек`;
  if (seconds <= 0) return `${minutes} мин`;
  return `${minutes} мин ${seconds} сек`;
};

const humanizeBookingError = (error: unknown) => {
  const err = error as BookingApiError;
  if (err?.code === "TIME_HELD") {
    const waitSeconds = Number(err?.details?.waitSeconds);
    if (Number.isFinite(waitSeconds) && waitSeconds > 0) {
      return `Это время сейчас резервируется другим клиентом. Подождите ${formatWaitTimeRu(waitSeconds)} или выберите другой слот.`;
    }
    return "Это время сейчас резервируется другим клиентом. Подождите немного и выберите другой слот.";
  }
  if (err?.code === "HOLD_EXPIRED") {
    return "Резерв времени истек. Выберите время снова.";
  }
  return err?.message || "Ошибка запроса";
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || "Ошибка запроса";
    const error = new Error(message) as BookingApiError;
    const code = payload?.error?.code;
    if (typeof code === "string" && code.length > 0) {
      error.code = code;
      error.name = code;
    }
    if (payload?.error?.details && typeof payload.error.details === "object") {
      error.details = payload.error.details as BookingApiError["details"];
    }
    throw error;
  }
  return payload?.data as T;
}

const buildUrl = (
  path: string,
  params: Record<string, string | number | null | undefined>
) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const BOOKING_STATE_VERSION = 1;
const BOOKING_SESSION_VERSION = 1;

const bookingStateStorageKey = (accountSlug?: string, accountPublicSlug?: string) =>
  `booking-state:v${BOOKING_STATE_VERSION}:${accountSlug || accountPublicSlug || "public"}`;

const bookingSessionStorageKey = (accountSlug?: string, accountPublicSlug?: string) =>
  `booking-session:v${BOOKING_SESSION_VERSION}:${accountSlug || accountPublicSlug || "public"}`;

const groupSessionStorageKey = (accountSlug?: string, accountPublicSlug?: string) =>
  `group-booked:v1:${accountSlug || accountPublicSlug || "public"}`;

const loadPersistedBookingState = (
  accountSlug?: string,
  accountPublicSlug?: string
): BookingPersistedState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      bookingStateStorageKey(accountSlug, accountPublicSlug)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingPersistedState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

// ============================================================================
// TIMEZONE HELPERS (единый источник истины — YMD строки в TZ аккаунта, day-math через UTC)
// ============================================================================

const ymdToUtcDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  // 12:00 UTC чтобы не словить DST
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
};

const utcDateToYmd = (d: Date) => d.toISOString().slice(0, 10);

const ymdAddDays = (ymd: string, days: number) => {
  const base = ymdToUtcDate(ymd);
  base.setUTCDate(base.getUTCDate() + days);
  return utcDateToYmd(base);
};

const monthStartYmd = (ymd: string) => `${ymd.slice(0, 7)}-01`;

const ymdAddMonths = (ymd: string, months: number) => {
  const base = ymdToUtcDate(monthStartYmd(ymd));
  base.setUTCMonth(base.getUTCMonth() + months);
  return utcDateToYmd(base);
};

const ymdDiffDays = (fromYmd: string, toYmd: string) => {
  const from = ymdToUtcDate(fromYmd).getTime();
  const to = ymdToUtcDate(toYmd).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000));
};

function getNowInTimeZone(timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const minutes =
      (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
    return { ymd: `${y}-${m}-${d}`, minutes };
  } catch {
    // fallback: браузерная TZ (редко)
    const d = new Date();
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const minutes = d.getHours() * 60 + d.getMinutes();
    return { ymd, minutes };
  }
}

function isPastYmd(ymd: string, nowYmd: string) {
  return ymd < nowYmd;
}

function isPastTimeOnDate(
  ymd: string,
  time: string,
  now: { ymd: string; minutes: number }
) {
  if (ymd !== now.ymd) return false;
  const tm = timeToMinutes(time);
  if (tm === null) return false;
  return tm <= now.minutes;
}

function filterPastTimes(
  ymd: string,
  times: string[],
  now: { ymd: string; minutes: number }
) {
  if (ymd !== now.ymd) return times;
  return times.filter((t) => {
    const tm = timeToMinutes(t);
    if (tm === null) return false;
    return tm > now.minutes;
  });
}

function uniqSortedTimes(times: string[]) {
  return Array.from(new Set(times)).sort((a, b) =>
    a > b ? 1 : a < b ? -1 : 0
  );
}

function getLocationOpenStatus(
  location: Location,
  now: { ymd: string; minutes: number },
  timeZone: string
) {
  const parseRangeStatus = (startRaw: string | null, endRaw: string | null) => {
    const start = startRaw ? timeToMinutes(startRaw) : null;
    const end = endRaw ? timeToMinutes(endRaw) : null;
    if (start === null || end === null || start >= end) {
      return { label: "График уточняется", open: false };
    }
    if (now.minutes < start) {
      return { label: `Откроется в ${startRaw}`, open: false };
    }
    if (now.minutes >= end) {
      return { label: "Закрыто", open: false };
    }
    return { label: `Открыто до ${endRaw}`, open: true };
  };

  const todayException = location.exceptions?.find((item) => item.date === now.ymd);
  if (todayException) {
    if (todayException.isClosed) {
      return { label: "Сегодня выходной", open: false };
    }
    return parseRangeStatus(todayException.startTime, todayException.endTime);
  }

  const todayMon0 = weekdayIndexMon0InTz(now.ymd, timeZone);
  const todayHours = location.hours?.find((item) => item.dayOfWeek === todayMon0);
  if (!todayHours) {
    return { label: "Сегодня выходной", open: false };
  }
  return parseRangeStatus(todayHours.startTime, todayHours.endTime);
}

function getTodayWorkRange(
  location: Location,
  todayYmd: string,
  timeZone: string
): { startMinutes: number | null; endMinutes: number | null; isClosed: boolean } | null {
  const exception = location.exceptions?.find((item) => item.date === todayYmd);
  if (exception) {
    if (exception.isClosed) return { startMinutes: null, endMinutes: null, isClosed: true };
    const startMinutes = exception.startTime ? timeToMinutes(exception.startTime) : null;
    const endMinutes = exception.endTime ? timeToMinutes(exception.endTime) : null;
    if (startMinutes === null || endMinutes === null) return null;
    return { startMinutes, endMinutes, isClosed: false };
  }

  const mon0 = weekdayIndexMon0InTz(todayYmd, timeZone);
  const hours = location.hours?.find((item) => item.dayOfWeek === mon0);
  if (!hours) return { startMinutes: null, endMinutes: null, isClosed: true };
  const startMinutes = timeToMinutes(hours.startTime);
  const endMinutes = timeToMinutes(hours.endTime);
  if (startMinutes === null || endMinutes === null) return null;
  return { startMinutes, endMinutes, isClosed: false };
}

const weekdayIndexSun0InTz = (ymd: string, timeZone: string) => {
  const d = ymdToUtcDate(ymd);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
};

const weekdayIndexMon0InTz = (ymd: string, timeZone: string) => {
  const sun0 = weekdayIndexSun0InTz(ymd, timeZone);
  return (sun0 + 6) % 7; // 0=Mon
};

const mondayOfWeek = (ymd: string, timeZone: string) => {
  const mon0 = weekdayIndexMon0InTz(ymd, timeZone);
  return ymdAddDays(ymd, -mon0);
};

const monthLabelRu = (year: number, month1: number, timeZone: string) => {
  const d = new Date(Date.UTC(year, month1 - 1, 15, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone, month: "long" });
  const s = fmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const daysInMonthUtc = (year: number, month1: number) => {
  return new Date(Date.UTC(year, month1, 0, 12, 0, 0)).getUTCDate();
};

const prettyDayYmd = (ymd: string, todayYmd: string) => {
  if (ymd === todayYmd) return "Сегодня";
  if (ymd === ymdAddDays(todayYmd, 1)) return "Завтра";
  // dd.mm
  const dd = Number(ymd.slice(8, 10));
  const mm = Number(ymd.slice(5, 7));
  return `${pad2(dd)}.${pad2(mm)}`;
};

const formatDateRu = (ymd: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[3]}.${match[2]}.${match[1]}`;
};

// ============================================================================
// UI
// ============================================================================

function SoftPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "booking-panel rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]",
        // тени оставляем в проекте как были, пользователь попросил убрать тени у календаря
        "shadow-[var(--bp-shadow-soft)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-black/5">
      <div
        className="h-2 rounded-full bg-[color:var(--bp-accent)]"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function ScenarioTabs({
  value,
  onChange,
}: {
  value: Scenario;
  onChange: (next: Scenario) => void;
}) {
  const tabs: Array<{ key: Scenario; label: string }> = [
    { key: "dateFirst", label: "Дата" },
    { key: "serviceFirst", label: "Услуга" },
    { key: "specialistFirst", label: "Специалист" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "rounded-2xl px-3 py-2 text-xs font-medium transition",
              "hover:-translate-y-[1px] hover:shadow-sm",
              active
                ? "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                : "bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// DatePickerLike (как на твоем примере) - БЕЗ ТЕНЕЙ, выбор - только обводка
// - expanded: сетка месяца (42)
// - collapsed: только неделя выбранной даты
// - month pill слева + стрелки справа
// - TZ-aware + можно отключать даты по availableDates и disabledBeforeYmd
// ============================================================================

function DatePickerLike({
  value,
  onChange,
  timeZone,
  disabledBeforeYmd,
  availableDates,
  onViewMonthChange,
  onUnavailableDateSelect,
}: {
  value: string; // YYYY-MM-DD (TZ account)
  onChange: (ymd: string) => void;
  timeZone: string;
  disabledBeforeYmd: string;
  availableDates: Set<string>;
  onViewMonthChange?: (monthStart: string) => void;
  onUnavailableDateSelect?: (ymd: string, reason: "past" | "unavailable") => void;
}) {
  const [expanded, setExpanded] = useState(false);


  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [viewMonth1, setViewMonth1] = useState(() => Number(value.slice(5, 7)));

  useEffect(() => {
    // синхронизируем хедер с выбранной датой
    setViewYear(Number(value.slice(0, 4)));
    setViewMonth1(Number(value.slice(5, 7)));
  }, [value]);

  useEffect(() => {
    if (!onViewMonthChange) return;
    onViewMonthChange(`${String(viewYear).padStart(4, "0")}-${String(viewMonth1).padStart(2, "0")}-01`);
  }, [onViewMonthChange, viewYear, viewMonth1]);

  const monthLabel = useMemo(
    () => monthLabelRu(viewYear, viewMonth1, timeZone),
    [viewYear, viewMonth1, timeZone]
  );

  const monthCells = useMemo(() => {
    const firstYmd = `${String(viewYear).padStart(4, "0")}-${String(viewMonth1).padStart(2, "0")}-01`;
    const firstMon0 = weekdayIndexMon0InTz(firstYmd, timeZone);

    const dim = daysInMonthUtc(viewYear, viewMonth1);
    void dim;

    const gridStart = ymdAddDays(firstYmd, -firstMon0);
    return Array.from({ length: 42 }, (_, i) => ymdAddDays(gridStart, i));
  }, [viewYear, viewMonth1, timeZone]);

  const weekStart = useMemo(() => mondayOfWeek(value, timeZone), [value, timeZone]);
  const weekRow = useMemo(() => Array.from({ length: 7 }, (_, i) => ymdAddDays(weekStart, i)), [weekStart]);

  const isDisabledDate = (ymd: string) => {
    if (isPastYmd(ymd, disabledBeforeYmd)) return true;
    if (availableDates.size > 0 && !availableDates.has(ymd)) return true;
    return false;
  };
  const disabledReason = (ymd: string): "past" | "unavailable" | null => {
    if (isPastYmd(ymd, disabledBeforeYmd)) return "past";
    if (availableDates.size > 0 && !availableDates.has(ymd)) return "unavailable";
    return null;
  };

  const goPrev = () => {
    if (expanded) {
      let y = viewYear;
      let m = viewMonth1 - 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      setViewYear(y);
      setViewMonth1(m);
      return;
    }
    const next = ymdAddDays(value, -7);
    onChange(next);
  };

  const goNext = () => {
    if (expanded) {
      let y = viewYear;
      let m = viewMonth1 + 1;
      if (m === 13) {
        m = 1;
        y += 1;
      }
      setViewYear(y);
      setViewMonth1(m);
      return;
    }
    const next = ymdAddDays(value, 7);
    onChange(next);
  };

  const DayCell = ({ ymd, inMonth }: { ymd: string; inMonth: boolean }) => {
    const selected = ymd === value;
    const disabled = isDisabledDate(ymd);
    const dayNum = Number(ymd.slice(8, 10));

    return (
      <button
        type="button"
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) {
            const reason = disabledReason(ymd);
            if (reason) onUnavailableDateSelect?.(ymd, reason);
            return;
          }
          onChange(ymd);
        }}
        className={cn(
          "relative h-9 rounded-full text-[14px] font-medium transition shadow-none",
          !selected && "booking-soft-accent-hover",
          "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 hover:shadow-none",
          selected
            ? "border border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] hover:translate-y-0"
            : "border border-transparent bg-transparent",
          selected
            ? "text-[color:var(--bp-button-text)]"
            : disabled
              ? "text-[color:var(--bp-muted)]"
              : inMonth
                ? "text-[color:var(--bp-ink)]"
                : "text-[color:var(--bp-ink)]",
          disabled && "opacity-30 hover:bg-transparent"
        )}
      >
        {dayNum}
      </button>
    );
  };

  return (
    <div className="w-full rounded-[18px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "booking-soft-accent-hover inline-flex items-center gap-2 rounded-[12px]",
            "border border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)] px-3 py-2",
            "shadow-none transition hover:-translate-y-[1px] hover:shadow-none",
            "focus:outline-none focus:ring-0 focus-visible:ring-0"
          )}
          aria-expanded={expanded}
        >
          <span className="text-[14px] font-semibold text-[color:var(--bp-ink)]">{monthLabel}</span>
          <span className="text-[14px] text-[color:var(--bp-muted)]">{expanded ? "▴" : "▾"}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className={cn(
              "booking-soft-accent-hover inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--bp-accent)] shadow-none",
              "bg-transparent transition hover:shadow-none",
              "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            )}
            aria-label={expanded ? "Предыдущий месяц" : "Предыдущая неделя"}
          >
            <span className="text-[16px] leading-none text-[color:var(--bp-accent)]">‹</span>
          </button>

          <button
            type="button"
            onClick={goNext}
            className={cn(
              "booking-soft-accent-hover inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--bp-accent)] shadow-none",
              "bg-transparent transition hover:shadow-none",
              "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            )}
            aria-label={expanded ? "Следующий месяц" : "Следующая неделя"}
          >
            <span className="text-[16px] leading-none text-[color:var(--bp-accent)]">›</span>
          </button>
        </div>
      </div>

      {/* Weekday names */}
      <div className="mt-3 grid grid-cols-7 gap-2 px-4 text-center">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div key={d} className="text-[12px] font-medium text-[color:var(--bp-muted)]">
            {d}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {expanded ? (
          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthCells.map((ymd) => {
              const inMonth =
                ymd.slice(0, 7) ===
                `${String(viewYear).padStart(4, "0")}-${String(viewMonth1).padStart(2, "0")}`;
              return <DayCell key={ymd} ymd={ymd} inMonth={inMonth} />;
            })}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-7 gap-2">
            {weekRow.map((ymd) => {
              const inMonth = ymd.slice(0, 7) === value.slice(0, 7);
              return <DayCell key={ymd} ymd={ymd} inMonth={inMonth} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeBucketPicker({
  value,
  onChange,
}: {
  value: TimeBucket;
  onChange: (next: TimeBucket) => void;
}) {
  const options: Array<{ key: TimeBucket; label: string }> = [
    { key: "all", label: "Все" },
    { key: "morning", label: "Утро" },
    { key: "day", label: "День" },
    { key: "evening", label: "Вечер" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-xs font-medium transition hover:-translate-y-[1px] hover:shadow-sm",
              !active && "booking-soft-accent-hover",
              active
                ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] hover:translate-y-0 hover:shadow-none"
                : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TimeGrid({
  times,
  selected,
  timeBucket,
  onBucket,
  onSelect,
  metaByTime,
}: {
  times: string[];
  selected: string | null;
  timeBucket: TimeBucket;
  onBucket: (b: TimeBucket) => void;
  onSelect: (time: string) => void;
  metaByTime?: Record<string, string>;
}) {
  const bucketForTime = (time: string) => {
    const minutes = timeToMinutes(time) ?? 0;
    if (minutes < 12 * 60) return "morning";
    if (minutes < 17 * 60) return "day";
    return "evening";
  };

  const visible = useMemo(() => {
    return timeBucket === "all"
      ? times
      : times.filter((t) => bucketForTime(t) === timeBucket);
  }, [times, timeBucket]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <TimeBucketPicker value={timeBucket} onChange={onBucket} />
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {visible.map((t) => {
          const active = t === selected;
          const meta = metaByTime?.[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                "flex min-h-10 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-1 text-sm font-medium transition",
                !active && "booking-soft-accent-hover",
                "hover:-translate-y-[1px] hover:shadow-sm",
                active
                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] hover:translate-y-0 hover:shadow-none"
                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
              )}
            >
              <span>{t}</span>
              {meta ? (
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-[color:var(--bp-button-text)]/80" : "text-[color:var(--bp-muted)]"
                  )}
                >
                  {meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs font-medium text-[color:var(--bp-muted)]">{label}</div>
      <div className="text-right text-sm font-semibold text-[color:var(--bp-ink)]">{value}</div>
    </div>
  );
}

async function runBatches<T>(
  tasks: Array<() => Promise<T>>,
  batchSize: number
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize);
    const res = await Promise.all(chunk.map((fn) => fn()));
    out.push(...res);
  }
  return out;
}

export default function BookingClient({
  accountSlug,
  accountPublicSlug,
  loaderConfig,
}: BookingClientProps) {
  const persistedStateRef = useRef<BookingPersistedState | null>(
    loadPersistedBookingState(accountSlug, accountPublicSlug)
  );
  const restoringFromStorageRef = useRef(false);
  const skipScenarioResetOnceRef = useRef(false);
  const skipLocationResetOnceRef = useRef(false);
  const skipServiceResetOnceRef = useRef(false);
  const skipDateResetOnceRef = useRef(false);
  const restoredFromStorageRef = useRef(false);
  const [scenario, setScenario] = useState<Scenario>("dateFirst");
  const [startScenario, setStartScenario] = useState(false);
  const [bookingSessionKey, setBookingSessionKey] = useState<string | null>(null);
  const [initialParams, setInitialParams] = useState<{
    locationId: number | null;
    serviceId: number | null;
    serviceIds: number[];
    specialistId: number | null;
    dateYmd: string | null;
    timeChoice: string | null;
    scenario: Scenario | null;
    startScenario: boolean;
    planJson: ChainItem[] | null;
  } | null>(null);
  const [hasAnyQueryParams, setHasAnyQueryParams] = useState(false);
  const [initialParamsApplied, setInitialParamsApplied] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<number | null>(null);
  const [pendingSpecialistId, setPendingSpecialistId] = useState<number | null>(null);
  const [initialNavApplied, setInitialNavApplied] = useState(false);
  const [pendingStepKey, setPendingStepKey] = useState<BookingUiStepKey | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = bookingSessionStorageKey(accountSlug, accountPublicSlug);
      let value = window.sessionStorage.getItem(key);
      if (!value) {
        value = makeIdempotencyKey();
        window.sessionStorage.setItem(key, value);
      }
      setBookingSessionKey(value);
    } catch {
      setBookingSessionKey(null);
    }
  }, [accountSlug, accountPublicSlug]);

  const groupBookedStorageKey = useMemo(
    () => groupSessionStorageKey(accountSlug, accountPublicSlug),
    [accountSlug, accountPublicSlug]
  );
  const [groupBookedIds, setGroupBookedIds] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(groupBookedStorageKey);
      if (!raw) {
        setGroupBookedIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setGroupBookedIds(parsed.filter((id) => Number.isInteger(id)));
      } else {
        setGroupBookedIds([]);
      }
    } catch {
      setGroupBookedIds([]);
    }
  }, [groupBookedStorageKey]);

  const markGroupSessionBooked = useCallback(
    (sessionId: number | null) => {
      if (!sessionId || typeof window === "undefined") return;
      setGroupBookedIds((prev) => {
        if (prev.includes(sessionId)) return prev;
        const next = [...prev, sessionId];
        try {
          window.sessionStorage.setItem(groupBookedStorageKey, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [groupBookedStorageKey]
  );

  const [context, setContext] = useState<ContextData | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<number | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [groupSessionsForDate, setGroupSessionsForDate] = useState<GroupSessionSlot[]>([]);
  const [groupSessionsLoading, setGroupSessionsLoading] = useState(false);
  const [groupSessionsError, setGroupSessionsError] = useState<string | null>(null);
  const [selectedGroupSessionId, setSelectedGroupSessionId] = useState<number | null>(null);
  const [groupSessionAvailableDates, setGroupSessionAvailableDates] = useState<Set<string>>(new Set());
  const [groupAvailabilityLoading, setGroupAvailabilityLoading] = useState(false);
  const [groupAvailabilityError, setGroupAvailabilityError] = useState<string | null>(null);

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [specialistsFetched, setSpecialistsFetched] = useState(false);
  const [specialistsError, setSpecialistsError] = useState<string | null>(null);

  // specialistFirst: только специалиста с рабочими днями
  const [workdaySpecialistIds, setWorkdaySpecialistIds] = useState<Set<number> | null>(null);
  const [loadingWorkdaySpecs, setLoadingWorkdaySpecs] = useState(false);
  const [workdaySpecsError, setWorkdaySpecsError] = useState<string | null>(null);

  // dateFirst: витрина времени time -> serviceIds[]
  const [offersByTime, setOffersByTime] = useState<Record<string, number[]>>({});
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [groupOffersByTime, setGroupOffersByTime] = useState<Record<string, number[]>>({});
  const [dateFirstAvailableDates, setDateFirstAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDateFirstAvailability, setLoadingDateFirstAvailability] = useState(false);
  const [dateFirstAvailabilityError, setDateFirstAvailabilityError] = useState<string | null>(null);

  // serviceFirst/specialistFirst: календарь доступности (у тебя уже есть endpoint)
  const [calendar, setCalendar] = useState<AvailabilityCalendar | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // dateFirst: слоты по выбранной услуге на дату (для выбора специалиста на timeChoice)
  const [dateFirstServiceSlots, setDateFirstServiceSlots] = useState<Slot[]>([]);
  const [loadingDateFirstServiceSlots, setLoadingDateFirstServiceSlots] = useState(false);
  const [dateFirstServiceSlotsError, setDateFirstServiceSlotsError] = useState<string | null>(null);
  const [singlePlanEligibleSpecialistIds, setSinglePlanEligibleSpecialistIds] = useState<Set<number> | null>(null);
  const [loadingSinglePlanSpecialists, setLoadingSinglePlanSpecialists] = useState(false);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [specialistId, setSpecialistId] = useState<number | null>(null);
  const prevServiceIdRef = useRef<number | null>(null);
  const prevServiceIdsKeyRef = useRef<string>("");

  const selectedServiceIds = useMemo(() => {
    const ids = new Set<number>();
    if (Number.isInteger(serviceId || 0) && serviceId) ids.add(serviceId);
    for (const id of serviceIds) {
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
    const list = Array.from(ids);
    if (serviceId && list.includes(serviceId)) {
      return [serviceId, ...list.filter((id) => id !== serviceId)];
    }
    return list;
  }, [serviceId, serviceIds]);

  const commonSpecialistIds = useMemo(() => {
    const selected = services.filter((s) => selectedServiceIds.includes(s.id));
    if (selected.length === 0) return new Set<number>();
    const lists = selected
      .map((s) => (Array.isArray(s.specialistIds) ? s.specialistIds : []))
      .filter((list) => list.length > 0);
    if (lists.length === 0) return new Set<number>();
    const first = new Set<number>(lists[0]);
    for (const list of lists.slice(1)) {
      for (const id of Array.from(first)) {
        if (!list.includes(id)) first.delete(id);
      }
    }
    return first;
  }, [services, selectedServiceIds]);

  const isVisitPlanMode = selectedServiceIds.length > 1;
  const isChainMode = isVisitPlanMode && commonSpecialistIds.size === 0;
  const isSingleSpecialistPlanMode = isVisitPlanMode && commonSpecialistIds.size > 0;
  const chainServiceIds = selectedServiceIds;
  const chainPrimaryServiceId = chainServiceIds[0] ?? null;

  const effectiveScenario: Scenario = isChainMode ? "serviceFirst" : scenario;
  const isDateFirst = effectiveScenario === "dateFirst";
  const isServiceFirst = effectiveScenario === "serviceFirst";
  const isSpecialistFirst = effectiveScenario === "specialistFirst";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setHasAnyQueryParams(params.toString().length > 0);
    const rawScenario = params.get("scenario");
    const scenarioValue: Scenario | null =
      rawScenario === "serviceFirst" || rawScenario === "service"
        ? "serviceFirst"
        : rawScenario === "specialistFirst" || rawScenario === "specialist"
          ? "specialistFirst"
          : rawScenario === "dateFirst" || rawScenario === "date"
            ? "dateFirst"
            : null;

    const locationParam = Number(params.get("locationId"));
    const serviceParam = Number(params.get("serviceId"));
    const serviceIdsParam = (params.get("serviceIds") || "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const specialistParam = Number(params.get("specialistId"));
    const rawDate = (params.get("date") || "").trim();
    const rawTime = (params.get("time") || "").trim();
    const rawPlan = params.get("plan");
    const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const timeParam = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : null;
    const startParam = params.get("start");
    const startScenarioValue = startParam === "scenario";
    let planJson: ChainItem[] | null = null;
    if (rawPlan) {
      try {
        const parsed = JSON.parse(rawPlan);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item: unknown) => {
              const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
              const serviceId = Number(obj.serviceId);
              const specialistIdRaw = Number(obj.specialistId);
              return {
                serviceId,
                specialistId: Number.isInteger(specialistIdRaw) ? specialistIdRaw : null,
                date: String(obj.date ?? ""),
                time: typeof obj.time === "string" ? obj.time : null,
              };
            })
            .filter(
              (item: ChainItem) =>
                Number.isInteger(item.serviceId) &&
                item.serviceId > 0 &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
                (item.time == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))
            );
          planJson = normalized.length ? normalized : null;
        }
      } catch {
        planJson = null;
      }
    }

    setInitialParams({
      locationId: Number.isFinite(locationParam) ? locationParam : null,
      serviceId: Number.isFinite(serviceParam) ? serviceParam : null,
      serviceIds: serviceIdsParam,
      specialistId: Number.isFinite(specialistParam) ? specialistParam : null,
      dateYmd: dateParam,
      timeChoice: timeParam,
      scenario: scenarioValue,
      startScenario: startScenarioValue,
      planJson,
    });
  }, []);

  // ✅ дата теперь в TZ аккаунта (YMD), и инициализируем после того, как узнаем TZ
  const [dateYmd, setDateYmd] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [calendarViewMonthStart, setCalendarViewMonthStart] = useState<string>(() =>
    monthStartYmd(`${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}-${pad2(new Date().getDate())}`)
  );

  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [chainItems, setChainItems] = useState<ChainItem[]>([]);
  const [chainError, setChainError] = useState<string | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainEditIndex, setChainEditIndex] = useState<number | null>(null);
  const [chainEditSpecialistId, setChainEditSpecialistId] = useState<number | null>(null);
  const [chainEditEligibleSpecialistIds, setChainEditEligibleSpecialistIds] = useState<Set<number> | null>(null);
  const [chainEditTimes, setChainEditTimes] = useState<string[]>([]);
  const [chainEditLoading, setChainEditLoading] = useState(false);
  const [chainEditConstraintMessage, setChainEditConstraintMessage] = useState<string | null>(null);
  const [chainTotals, setChainTotals] = useState<{ durationMin: number; price: number } | null>(null);
  const [chainItemDurations, setChainItemDurations] = useState<Record<number, number>>({});
  const [chainItemPrices, setChainItemPrices] = useState<Record<number, number>>({});
  const initialPlanRef = useRef<ChainItem[] | null>(null);
  const planSeededFromUrlRef = useRef(false);
  const planAppliedRef = useRef(false);

  useEffect(() => {
    if (!isVisitPlanMode) {
      setChainItems([]);
      setChainError(null);
      setChainEditIndex(null);
      setChainEditSpecialistId(null);
      setChainEditEligibleSpecialistIds(null);
      setChainEditTimes([]);
      return;
    }
    setChainItems((prev) =>
      chainServiceIds.map((id) => {
        const existing = prev.find((item) => item.serviceId === id);
        const seeded = initialPlanRef.current?.find((item) => item.serviceId === id) ?? null;
        const effectiveSpecialistId = isSingleSpecialistPlanMode
          ? specialistId ?? null
          : seeded?.specialistId ?? existing?.specialistId ?? null;
        return {
          serviceId: id,
          specialistId: effectiveSpecialistId,
          date: seeded?.date ?? dateYmd,
          time: seeded?.time ?? existing?.time ?? null,
        } as ChainItem;
      })
    );
    if (initialPlanRef.current?.length) {
      initialPlanRef.current = null;
      planSeededFromUrlRef.current = true;
    }
  }, [isVisitPlanMode, chainServiceIds, dateYmd, isSingleSpecialistPlanMode, specialistId]);

  useEffect(() => {
    if (!initialParamsApplied || !isVisitPlanMode) return;
    const seeded = initialPlanRef.current;
    if (!seeded || seeded.length === 0) return;
    setChainItems((prev) => {
      const hasAnyValue = prev.some((item) => item.time || item.specialistId);
      if (hasAnyValue) return prev;
      return chainServiceIds.map((id) => {
        const planItem = seeded.find((item) => item.serviceId === id) ?? null;
        return {
          serviceId: id,
          specialistId: planItem?.specialistId ?? null,
          date: planItem?.date ?? dateYmd,
          time: planItem?.time ?? null,
        } as ChainItem;
      });
    });
    initialPlanRef.current = null;
  }, [initialParamsApplied, isVisitPlanMode, chainServiceIds, dateYmd]);

  useEffect(() => {
    if (!initialParamsApplied || !isVisitPlanMode) return;
    if (planAppliedRef.current) return;
    const seeded = initialParams?.planJson ?? null;
    if (!seeded || seeded.length === 0) return;
    setChainItems((prev) => {
      const hasAnyValue = prev.some((item) => item.time || item.specialistId);
      if (hasAnyValue) return prev;
      return chainServiceIds.map((id) => {
        const planItem = seeded.find((item) => item.serviceId === id) ?? null;
        return {
          serviceId: id,
          specialistId: planItem?.specialistId ?? null,
          date: planItem?.date ?? dateYmd,
          time: planItem?.time ?? null,
        } as ChainItem;
      });
    });
    if (!timeChoice) {
      const firstPlan = seeded.find((item) => item.time) ?? null;
      if (firstPlan?.time) setTimeChoice(firstPlan.time);
    }
    planSeededFromUrlRef.current = true;
    planAppliedRef.current = true;
  }, [initialParamsApplied, isVisitPlanMode, chainServiceIds, initialParams?.planJson, dateYmd, timeChoice]);

  const [timeBucket, setTimeBucket] = useState<TimeBucket>("all");
  const [query, setQuery] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("all");
  const [specialistQuery, setSpecialistQuery] = useState("");
  const [selectedSpecialistCategory, setSelectedSpecialistCategory] = useState("all");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [comment, setComment] = useState("");
  const [legalConsents, setLegalConsents] = useState<Record<number, boolean>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeHold, setActiveHold] = useState<ActiveHold | null>(null);
  const activeHoldRef = useRef<ActiveHold | null>(null);
  const submitSuccessRef = useRef(false);

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loadingClientProfile, setLoadingClientProfile] = useState(false);
  const calendarKeyRef = useRef<string | null>(null);
  const calendarRequestIdRef = useRef(0);
  const fullscreenLoaderShownAtRef = useRef<number | null>(null);
  const [overlayNextDeadline, setOverlayNextDeadline] = useState<number | null>(null);

  const accountTz = context?.account.timeZone || "UTC";
  const slotStepMinutes = context?.account.slotStepMinutes ?? 15;
  const legalDocs = context?.legalDocuments ?? [];
  const platformLegalDocs = context?.platformLegalDocuments ?? [];
  const nowTz = useMemo(() => getNowInTimeZone(accountTz), [accountTz]);
  const todayYmdTz = nowTz.ymd;
  const holdOwnerMarker = clientProfile?.id ?? null;
  const effectiveInlineLoader =
    loaderConfig && loaderConfig.showBookingInline ? loaderConfig : null;

  const idempotencyKeyRef = useRef<string | null>(null);
  const holdRequestIdRef = useRef(0);
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [
    locationId,
    selectedServiceIds,
    specialistId,
    dateYmd,
    timeChoice,
    clientName,
    clientPhone,
    clientEmail,
    comment,
    legalConsents,
  ]);

  const getIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = makeIdempotencyKey();
    }
    return idempotencyKeyRef.current;
  };

  const serviceById = useMemo(
    () => new Map(services.map((srv) => [srv.id, srv])),
    [services]
  );

  const activeService = useMemo(
    () => (serviceId ? serviceById.get(serviceId) ?? null : null),
    [serviceById, serviceId]
  );

  const isGroupService = activeService?.bookingType === "GROUP";

  const holdSelection = useMemo(
    () =>
      !isGroupService &&
      !isChainMode &&
      locationId &&
      specialistId &&
      selectedServiceIds.length > 0 &&
      timeChoice
        ? {
            locationId,
            specialistId,
            serviceId: selectedServiceIds[0],
            serviceIds: selectedServiceIds,
            date: dateYmd,
            time: timeChoice,
          }
        : null,
    [isGroupService, locationId, specialistId, selectedServiceIds, dateYmd, timeChoice, isChainMode]
  );

  const isHoldStillFresh = (value: string, skewMs = 7000) =>
    Number.isFinite(new Date(value).getTime()) &&
    new Date(value).getTime() > Date.now() + skewMs;

  const sameServiceIds = (a: number[], b: number[]) =>
    a.length === b.length && a.every((id, idx) => id === b[idx]);

  const holdMatchesSelection = (hold: ActiveHold | null, selection: NonNullable<typeof holdSelection>) =>
    !!hold &&
    hold.locationId === selection.locationId &&
    hold.specialistId === selection.specialistId &&
    hold.serviceId === selection.serviceId &&
    sameServiceIds(hold.serviceIds, selection.serviceIds) &&
    hold.date === selection.date &&
    hold.time === selection.time;

  const reserveHold = async (selection: NonNullable<typeof holdSelection>, replaceHoldId?: number | null) => {
    const hold = await fetchJson<{ holdId: number; expiresAt: string }>(
      buildUrl("/api/v1/public/booking/holds", { account: accountSlug ?? "" }),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: selection.locationId,
          specialistId: selection.specialistId,
          serviceId: selection.serviceId,
          serviceIds: selection.serviceIds,
          date: selection.date,
          time: selection.time,
          ...(replaceHoldId ? { replaceHoldId } : {}),
        }),
      }
    );
    return hold;
  };

  const releaseHold = async (holdId: number) => {
    await fetchJson<{ ok: boolean }>(
      buildUrl("/api/v1/public/booking/holds", { account: accountSlug ?? "" }),
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ holdId }),
      }
    );
  };

  useEffect(() => {
    if (!holdSelection || submitSuccess) return;

    const sameSelection = holdMatchesSelection(activeHold, holdSelection);
    if (sameSelection && activeHold && isHoldStillFresh(activeHold.expiresAt, 45000)) return;

    const requestId = ++holdRequestIdRef.current;
    let cancelled = false;

    (async () => {
      try {
        const hold = await reserveHold(holdSelection, activeHold?.holdId ?? null);
        if (cancelled || requestId !== holdRequestIdRef.current) return;
        setActiveHold({
          holdId: hold.holdId,
          expiresAt: hold.expiresAt,
          ...holdSelection,
        });
      } catch (error) {
        if (cancelled || requestId !== holdRequestIdRef.current) return;
        setSubmitError(humanizeBookingError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [holdSelection, submitSuccess, activeHold]);

  useEffect(() => {
    activeHoldRef.current = activeHold;
  }, [activeHold]);

  useEffect(() => {
    submitSuccessRef.current = submitSuccess;
  }, [submitSuccess]);

  useEffect(() => {
    return () => {
      const hold = activeHoldRef.current;
      if (!hold || submitSuccessRef.current) return;

      const url = buildUrl("/api/v1/public/booking/holds", { account: accountSlug ?? "" });
      const body = JSON.stringify({ holdId: hold.holdId });

      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const payload = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(url, payload);
          return;
        }
        void fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      } catch {
        // ignore cleanup errors on unload
      }
    };
  }, [accountSlug]);
  // ✅ один раз синхронизируем дату с today в TZ аккаунта после загрузки контекста
  const didInitDateRef = useRef(false);
  useEffect(() => {
    if (!context?.account?.timeZone) return;
    if (didInitDateRef.current) return;
    didInitDateRef.current = true;

    setDateYmd((prev) => {
      if (!prev) return todayYmdTz;
      // если вдруг стартовая дата из браузера оказалась в прошлом относительно TZ аккаунта — нормализуем
      if (isPastYmd(prev, todayYmdTz)) return todayYmdTz;
      return prev;
    });
  }, [context?.account?.timeZone, todayYmdTz]);

  useEffect(() => {
    const next = monthStartYmd(dateYmd);
    setCalendarViewMonthStart((prev) => (prev === next ? prev : next));
  }, [dateYmd]);

  const CALENDAR_PREFETCH_MONTHS = 2;
  const visibleMonthStartYmd = useMemo(
    () => monthStartYmd(calendarViewMonthStart || dateYmd),
    [calendarViewMonthStart, dateYmd]
  );
  const calendarQueryStartYmd = useMemo(
    () => ymdAddDays(visibleMonthStartYmd, -7),
    [visibleMonthStartYmd]
  );
  const [debouncedCalendarQueryStartYmd, setDebouncedCalendarQueryStartYmd] =
    useState(calendarQueryStartYmd);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCalendarQueryStartYmd(calendarQueryStartYmd);
    }, 140);
    return () => clearTimeout(timer);
  }, [calendarQueryStartYmd]);
  const calendarQueryDays = useMemo(() => {
    const endExclusive = ymdAddDays(
      ymdAddMonths(visibleMonthStartYmd, CALENDAR_PREFETCH_MONTHS),
      7
    );
    return ymdDiffDays(debouncedCalendarQueryStartYmd, endExclusive);
  }, [debouncedCalendarQueryStartYmd, visibleMonthStartYmd]);

  useEffect(() => {
    if (!initialParams || initialParamsApplied) return;
    if (initialParams.scenario) {
      skipScenarioResetOnceRef.current = true;
    }
    if (initialParams.locationId) {
      skipLocationResetOnceRef.current = true;
    }
    if (initialParams.scenario) {
      setScenario(initialParams.scenario);
    }
    if (initialParams.startScenario) {
      setStartScenario(true);
    }
    if (initialParams.locationId) {
      setLocationId(initialParams.locationId);
    }
    if (initialParams.serviceIds?.length) {
      setServiceIds(initialParams.serviceIds);
      if (!initialParams.serviceId) {
        setPendingServiceId(initialParams.serviceIds[0] ?? null);
      }
    }
    if (initialParams.serviceId) setPendingServiceId(initialParams.serviceId);
    if (initialParams.specialistId) {
      // Для перехода из карточки специалиста нужен выбранный specialistId уже на шаге услуг.
      setSpecialistId(initialParams.specialistId);
      setPendingSpecialistId(initialParams.specialistId);
    }
    if (initialParams.dateYmd) {
      if (initialParams.timeChoice) {
        skipDateResetOnceRef.current = true;
      }
      setDateYmd(initialParams.dateYmd);
    }
    if (initialParams.timeChoice) {
      skipServiceResetOnceRef.current = true;
      setTimeChoice(initialParams.timeChoice);
    }
    if (initialParams.planJson?.length) {
      initialPlanRef.current = initialParams.planJson;
    }
    setInitialParamsApplied(true);
  }, [initialParams, initialParamsApplied, context?.locations]);

  useEffect(() => {
    if (!initialParamsApplied || restoredFromStorageRef.current) return;
    restoredFromStorageRef.current = true;

    // Для "чистого" входа на /booking (без query) всегда стартуем с выбора локации,
    // без восстановления прошлого шага/выборов из sessionStorage.
    if (!hasAnyQueryParams) return;

    const hasUrlState = Boolean(
      initialParams?.scenario ||
        initialParams?.locationId ||
        initialParams?.serviceId ||
        (initialParams?.serviceIds?.length ?? 0) > 0 ||
        initialParams?.specialistId ||
        initialParams?.dateYmd ||
        initialParams?.timeChoice ||
        initialParams?.startScenario ||
        (initialParams?.planJson?.length ?? 0) > 0
    );
    if (hasUrlState) return;

    const persisted = persistedStateRef.current;
    if (!persisted) return;

    restoringFromStorageRef.current = true;
    setScenario(persisted.scenario);
    // "Сценарий" должен включаться только явным URL-параметром start=scenario,
    // а не восстанавливаться из сохраненного состояния.
    setStartScenario(false);
    setLocationId(persisted.locationId ?? null);
    setPendingServiceId(persisted.serviceId ?? null);
    setServiceIds(
      Array.isArray(persisted.serviceIds)
        ? persisted.serviceIds
        : persisted.serviceId
          ? [persisted.serviceId]
          : []
    );
    setSpecialistId(persisted.specialistId ?? null);
    setPendingSpecialistId(persisted.specialistId ?? null);
    setDateYmd(persisted.dateYmd);
    setTimeChoice(persisted.timeChoice ?? null);
    setTimeBucket(persisted.timeBucket ?? "all");
    setQuery(persisted.query ?? "");
    setSpecialistQuery(persisted.specialistQuery ?? "");
    setSelectedServiceCategory(persisted.selectedServiceCategory ?? "all");
    setSelectedSpecialistCategory(persisted.selectedSpecialistCategory ?? "all");
    setPendingStepKey((persisted.stepKey as BookingUiStepKey | null) ?? null);
    skipScenarioResetOnceRef.current = true;
    skipLocationResetOnceRef.current = true;

    setTimeout(() => {
      restoringFromStorageRef.current = false;
    }, 0);
  }, [initialParamsApplied, initialParams, hasAnyQueryParams]);

  useEffect(() => {
    if (!locationId || !context?.locations?.length) return;
    const exists = context.locations.some((item) => item.id === locationId);
    if (!exists) setLocationId(null);
  }, [locationId, context?.locations]);

  useEffect(() => {
    if (!pendingServiceId) return;
    if (services.some((service) => service.id === pendingServiceId)) {
      setServiceId(pendingServiceId);
      setServiceIds((prev) => {
        if (prev.includes(pendingServiceId)) return prev;
        return [pendingServiceId, ...prev];
      });
      setPendingServiceId(null);
      return;
    }
    if (services.length > 0) {
      setPendingServiceId(null);
    }
  }, [pendingServiceId, services]);

  useEffect(() => {
    if (!pendingSpecialistId) return;
    if (specialists.some((sp) => sp.id === pendingSpecialistId)) {
      setSpecialistId(pendingSpecialistId);
      setPendingSpecialistId(null);
      return;
    }
    if (specialists.length > 0) {
      setPendingSpecialistId(null);
    }
  }, [pendingSpecialistId, specialists]);

  useEffect(() => {
    // Do not clear specialist during early bootstrap while services are still loading from URL params.
    if (services.length === 0) return;
    if (isChainMode && specialistId) {
      setSpecialistId(null);
    }
  }, [isChainMode, specialistId, services.length]);

  const steps = useMemo(() => {
    const common = [{ key: "location", title: "Локация" }];
    const dt = { key: "datetime", title: "Дата и время" };
    const chain = { key: "chain", title: "План визита" };
    const details = { key: "details", title: "Контакты" };

    if (isDateFirst) {
      return [
        ...common,
        dt,
        { key: "service", title: "Услуга" },
        ...(isVisitPlanMode
          ? (isSingleSpecialistPlanMode
              ? [{ key: "specialist", title: "Специалист" }, chain]
              : [chain])
          : [{ key: "specialist", title: "Специалист" }]),
        details,
      ];
    }
    if (isServiceFirst) {
      return [
        ...common,
        { key: "service", title: "Услуга" },
        dt,
        ...(isVisitPlanMode
          ? (isSingleSpecialistPlanMode
              ? [{ key: "specialist", title: "Специалист" }, chain]
              : [chain])
          : [{ key: "specialist", title: "Специалист" }]),
        details,
      ];
    }
    return [
      ...common,
      { key: "specialist", title: "Специалист" },
      { key: "service", title: "Услуга" },
      dt,
      ...(isVisitPlanMode ? [chain] : []),
      details,
    ];
  }, [isDateFirst, isServiceFirst, isVisitPlanMode, isSingleSpecialistPlanMode]);

  const stepsWithScenario = startScenario
    ? [{ key: "scenario", title: "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0439" }, ...steps]
    : steps;

  const lastTrackedStepRef = useRef<{ key: string; index: number } | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStepKey = stepsWithScenario[stepIndex]?.key;
  const prevStepsRef = useRef(stepsWithScenario);

  useEffect(() => {
    const prevSteps = prevStepsRef.current;
    const prevKey = prevSteps[stepIndex]?.key;
    if (!prevKey) {
      prevStepsRef.current = stepsWithScenario;
      return;
    }
    const idx = stepsWithScenario.findIndex((s) => s.key === prevKey);
    if (idx >= 0 && idx !== stepIndex) {
      setStepIndex(idx);
    }
    prevStepsRef.current = stepsWithScenario;
  }, [stepsWithScenario, stepIndex]);

  const logBookingStep = useCallback(
    (data: { stepKey: string; stepIndex: number; stepTitle?: string | null; payload?: unknown }) => {
      if (!bookingSessionKey) return;
      const body = {
        sessionKey: bookingSessionKey,
        stepKey: data.stepKey,
        stepIndex: data.stepIndex,
        stepTitle: data.stepTitle ?? null,
        scenario,
        locationId,
        serviceId,
        serviceIds: selectedServiceIds,
        specialistId,
        date: dateYmd,
        time: timeChoice,
        payload: data.payload ?? null,
      };
      void fetch(buildUrl("/api/v1/public/booking/steps", { account: accountSlug ?? "" }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    },
    [bookingSessionKey, scenario, locationId, serviceId, selectedServiceIds, specialistId, dateYmd, timeChoice, accountSlug]
  );
  const shouldLoadServices =
    (isDateFirst &&
      (currentStepKey === "datetime" ||
        currentStepKey === "service" ||
        currentStepKey === "specialist" ||
        currentStepKey === "chain" ||
        currentStepKey === "details")) ||
    (isServiceFirst &&
      (currentStepKey === "service" ||
        currentStepKey === "datetime" ||
        currentStepKey === "specialist" ||
        currentStepKey === "chain" ||
        currentStepKey === "details")) ||
    (isSpecialistFirst &&
      (currentStepKey === "service" ||
        currentStepKey === "datetime" ||
        currentStepKey === "chain" ||
        currentStepKey === "details"));
  const shouldLoadSpecialists =
    currentStepKey === "specialist" ||
    currentStepKey === "chain" ||
    currentStepKey === "details" ||
    (isSpecialistFirst && currentStepKey === "service");
  const shouldLoadCalendar =
    !isDateFirst && (currentStepKey === "datetime" || currentStepKey === "details");
  const shouldLoadDateFirstAvailability =
    isDateFirst &&
    (currentStepKey === "datetime" ||
      currentStepKey === "service" ||
      currentStepKey === "specialist" ||
      currentStepKey === "details");
  const shouldLoadDateFirstServiceSlots =
    isDateFirst &&
    (currentStepKey === "specialist" || currentStepKey === "chain" || currentStepKey === "details");

  useEffect(() => {
    if (!specialistId) return;
    if (isGroupService) return;
    if (!shouldLoadSpecialists) return;
    if (loadingSpecialists) return;
    if (!specialistsFetched) return;
    if (!specialists.some((sp) => sp.id === specialistId)) {
      setSpecialistId(null);
    }
  }, [specialistId, isGroupService, specialists, loadingSpecialists, shouldLoadSpecialists, specialistsFetched]);

  const gotoKey = (key: string) => {
    const idx = stepsWithScenario.findIndex((s) => s.key === key);
    if (idx >= 0) setStepIndex(idx);
  };

  useEffect(() => {
    if (!bookingSessionKey || !currentStepKey) return;
    const prev = lastTrackedStepRef.current;
    if (prev && prev.key === currentStepKey && prev.index === stepIndex) return;
    lastTrackedStepRef.current = { key: currentStepKey, index: stepIndex };
    logBookingStep({
      stepKey: currentStepKey,
      stepIndex,
      stepTitle: stepsWithScenario[stepIndex]?.title ?? null,
      payload: { startScenario, isDateFirst, isServiceFirst, isSpecialistFirst },
    });
  }, [
    bookingSessionKey,
    currentStepKey,
    stepIndex,
    stepsWithScenario,
    startScenario,
    isDateFirst,
    isGroupService,
    isServiceFirst,
    isSpecialistFirst,
    logBookingStep,
  ]);

  useEffect(() => {
    if (!pendingStepKey) return;
    const idx = stepsWithScenario.findIndex((s) => s.key === pendingStepKey);
    if (idx >= 0) setStepIndex(idx);
    setPendingStepKey(null);
  }, [pendingStepKey, stepsWithScenario]);

  useEffect(() => {
    if (!initialParamsApplied || initialNavApplied) return;
    const hasUrlState = Boolean(
      initialParams?.locationId ||
        initialParams?.serviceId ||
        initialParams?.specialistId ||
        initialParams?.dateYmd ||
        initialParams?.timeChoice ||
        (initialParams?.planJson?.length ?? 0) > 0
    );
    if (!hasUrlState) {
      setInitialNavApplied(true);
      return;
    }

    const knownLocation = Boolean(initialParams?.locationId);
    const hasService = Boolean(initialParams?.serviceId || (initialParams?.serviceIds?.length ?? 0) > 0);
    const hasSpecialist = Boolean(initialParams?.specialistId);
    const hasDate = Boolean(initialParams?.dateYmd);
    const hasTime = Boolean(initialParams?.timeChoice);
    const plan = initialParams?.planJson ?? [];
    const hasPlan = plan.length > 0;
    const hasCompletePlan = hasPlan && plan.every((item) => Boolean(item.specialistId) && Boolean(item.time));
    let nextStep: BookingUiStepKey = "location";
    if (knownLocation) {
      if (hasCompletePlan) {
        nextStep = "details";
      } else if (hasPlan) {
        nextStep = "chain";
      } else if (hasService && hasSpecialist && hasDate && hasTime) {
        nextStep = "details";
      } else if (hasService) {
        nextStep = "datetime";
      } else if (hasSpecialist) {
        nextStep = "service";
      } else {
        nextStep = "datetime";
      }
    }

    setPendingStepKey(nextStep);
    setInitialNavApplied(true);
  }, [initialParamsApplied, initialNavApplied, initialParams]);

  // Auto-advance is disabled: переходы только по кнопке "Далее".

  // ---------- resets
  useEffect(() => {
    if (skipScenarioResetOnceRef.current) {
      skipScenarioResetOnceRef.current = false;
      return;
    }
    if (restoringFromStorageRef.current) return;
    setServiceId(null);
    setServiceIds([]);
    setSpecialistId(null);
    setTimeChoice(null);
    setSelectedGroupSessionId(null);
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
    calendarKeyRef.current = null;
    setWorkdaySpecialistIds(null);
    setWorkdaySpecsError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    setStepIndex(0);
  }, [scenario]);

  useEffect(() => {
    if (skipLocationResetOnceRef.current) {
      skipLocationResetOnceRef.current = false;
      return;
    }
    if (restoringFromStorageRef.current) return;
    setServiceId(null);
    setServiceIds([]);
    setSpecialistId(null);
    setTimeChoice(null);
    setSelectedGroupSessionId(null);
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
    calendarKeyRef.current = null;
    setWorkdaySpecialistIds(null);
    setWorkdaySpecsError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    setStepIndex(0);
  }, [locationId]);

  useEffect(() => {
    if (skipDateResetOnceRef.current) {
      skipDateResetOnceRef.current = false;
      return;
    }
    setTimeChoice(null);
    setSelectedGroupSessionId(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    if (isDateFirst) setOffersByTime({});
  }, [dateYmd, isDateFirst]);

  useEffect(() => {
    const key = selectedServiceIds.join(",");
    const prevKey = prevServiceIdsKeyRef.current;
    if (prevKey == key) return;
    prevServiceIdsKeyRef.current = key;
    prevServiceIdRef.current = serviceId;

    if (skipServiceResetOnceRef.current) {
      skipServiceResetOnceRef.current = false;
      return;
    }
    if (!selectedServiceIds.length) return;
    // ✅ В dateFirst время выбрано раньше — его НЕ сбрасываем при выборе услуги
    if (isDateFirst) {
      if (isGroupService) {
        setSelectedGroupSessionId(null);
      }
      return;
    }

    // ✅ Для serviceFirst/specialistFirst смена услуги меняет доступность времени
    setTimeChoice(null);
    if (isGroupService) {
      setSelectedGroupSessionId(null);
    }

    setSubmitError(null);
    setSubmitSuccess(false);

    // serviceFirst: специалист выбирается после времени, поэтому при смене услуги лучше сбросить специалиста
  }, [selectedServiceIds, serviceId, isDateFirst, isGroupService]);

  // ---------- context
  useEffect(() => {
    let mounted = true;
    setLoadingContext(true);
    setContextError(null);

    fetchJson<ContextData>(
      buildUrl("/api/v1/public/booking/context", { account: accountSlug ?? "" })
    )
      .then((data) => {
        if (!mounted) return;
        setContext(data);
        if (data.locations.length === 1) {
          const firstId = Number(data.locations[0].id);
          setLocationId(Number.isInteger(firstId) ? firstId : null);
        }
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setContextError(error.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingContext(false);
      });

    return () => {
      mounted = false;
    };
  }, [accountSlug]);

  useEffect(() => {
    let mounted = true;
    setLoadingClientProfile(true);
    const url = accountSlug
      ? `/api/v1/auth/client/me?account=${encodeURIComponent(accountSlug)}`
      : "/api/v1/auth/client/me";

    fetch(url, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted) return;
        const data = payload?.data ?? null;
        let next = data?.client ?? null;
        if (!next && Array.isArray(data?.clients)) {
          next =
            (accountSlug
              ? data.clients.find((item: { accountSlug?: string }) => item.accountSlug === accountSlug)
              : null) ??
            data.clients[0] ??
            null;
        }
        if (!next && data?.user) {
          next = {
            id: null,
            firstName: data.user.firstName ?? null,
            lastName: data.user.lastName ?? null,
            phone: data.user.phone ?? null,
            email: data.user.email ?? null,
            avatarUrl: null,
          };
        }
        setClientProfile(next);
      })
      .catch(() => {
        if (!mounted) return;
        setClientProfile(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingClientProfile(false);
      });

    return () => {
      mounted = false;
    };
  }, [accountSlug]);

  useEffect(() => {
    if (!clientProfile) return;

    setClientName((prev) => {
      if (prev.trim()) return prev;
      const composed = `${clientProfile.firstName ?? ""} ${clientProfile.lastName ?? ""}`.trim();
      return composed;
    });
    setClientPhone((prev) => (prev.trim() ? prev : clientProfile.phone ?? ""));
    setClientEmail((prev) => (prev.trim() ? prev : clientProfile.email ?? ""));
  }, [clientProfile]);

  // ---------- specialists (full list for location)
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadSpecialists) {
      setLoadingSpecialists(false);
      setSpecialistsFetched(false);
      setSpecialistsError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setSpecialists([]);
      setSpecialistsFetched(false);
      setLoadingSpecialists(false);
      setSpecialistsError(null);
      return;
    }

    let mounted = true;
    setLoadingSpecialists(true);
    setSpecialistsFetched(false);
    setSpecialistsError(null);

    const specialistParams = isChainMode
      ? { account: accountSlug ?? "" }
      : {
          serviceId: serviceId ?? "",
          serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds.join(",") : "",
          account: accountSlug ?? "",
        };

    fetchJson<SpecialistsData>(
      buildUrl(`/api/v1/public/booking/locations/${safeLocationId}/specialists`, specialistParams)
    )
      .then((data) => {
        if (!mounted) return;
        setSpecialists(data.specialists);
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setSpecialistsError(error.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingSpecialists(false);
        setSpecialistsFetched(true);
      });

    return () => {
      mounted = false;
    };
  }, [locationId, accountSlug, serviceId, selectedServiceIds, shouldLoadSpecialists, isChainMode]);

  // ---------- specialistFirst: load “has workdays” specialist ids
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!isSpecialistFirst) {
      setWorkdaySpecialistIds(null);
      setWorkdaySpecsError(null);
      setLoadingWorkdaySpecs(false);
      return;
    }
    if (!shouldLoadSpecialists) {
      setLoadingWorkdaySpecs(false);
      setWorkdaySpecsError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setWorkdaySpecialistIds(new Set());
      setLoadingWorkdaySpecs(false);
      setWorkdaySpecsError(null);
      return;
    }

    let mounted = true;
    setLoadingWorkdaySpecs(true);
    setWorkdaySpecsError(null);

    fetchJson<AvailabilitySpecialists>(
      buildUrl("/api/v1/public/booking/availability/specialists", {
        locationId: safeLocationId,
        start: todayYmdTz,
        days: 45,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        const ids = Array.isArray(data.specialistIds) ? data.specialistIds : [];
        setWorkdaySpecialistIds(new Set(ids));
      })
      .catch((e: Error) => {
        if (!mounted) return;
        setWorkdaySpecsError(e.message);
        setWorkdaySpecialistIds(new Set());
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingWorkdaySpecs(false);
      });

    return () => {
      mounted = false;
    };
  }, [isSpecialistFirst, locationId, accountSlug, todayYmdTz, shouldLoadSpecialists]);

  // ---------- services
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadServices) {
      setLoadingServices(false);
      setServicesError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setServices([]);
      setLoadingServices(false);
      setServicesError(null);
      return;
    }

    let mounted = true;
    setLoadingServices(true);
    setServicesError(null);

    // При выбранном специалисте всегда возвращаем computedPrice/duration под него
    const specialistForPricing = specialistId ?? null;

    fetchJson<ServicesData>(
      buildUrl(`/api/v1/public/booking/locations/${safeLocationId}/services`, {
        specialistId: specialistForPricing,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        const raw = Array.isArray(data.services) ? data.services : [];
        setServices(raw);
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setServicesError(error.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingServices(false);
      });

    return () => {
      mounted = false;
    };
  }, [locationId, accountSlug, specialistId, shouldLoadServices]);

  // ---------- serviceFirst/specialistFirst: availability calendar
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadCalendar) {
      setLoadingCalendar(false);
      setCalendarError(null);
      return;
    }
    if (isGroupService) {
      setLoadingCalendar(false);
      setCalendarError(null);
      setCalendar(null);
      return;
    }
    const calendarServiceId = isChainMode ? chainPrimaryServiceId ?? "" : serviceId ?? "";
    const calendarServiceIds = isChainMode
      ? ""
      : selectedServiceIds.length > 0
        ? selectedServiceIds.join(",")
        : "";
    const calendarKey = [
      isDateFirst ? "date" : "other",
      isServiceFirst ? "service" : "",
      isSpecialistFirst ? "specialist" : "",
      safeLocationId,
      calendarServiceId,
      calendarServiceIds,
      isSpecialistFirst ? specialistId ?? "" : "",
      accountSlug ?? "",
      accountTz,
      todayYmdTz,
      holdOwnerMarker ?? "",
      debouncedCalendarQueryStartYmd,
      calendarQueryDays,
      currentStepKey ?? "",
    ].join("|");

    if (calendarKeyRef.current === calendarKey) {
      // тот же набор параметров: не оставляем UI в состоянии бесконечной загрузки
      setLoadingCalendar(false);
      return;
    }
    calendarKeyRef.current = calendarKey;

    setCalendarError(null);

    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setCalendar(null);
      return;
    }
    if (isDateFirst) {
      setCalendar(null);
      return;
    }

    if (isServiceFirst && selectedServiceIds.length === 0) {
      setCalendar(null);
      return;
    }
    if (isSpecialistFirst && (selectedServiceIds.length === 0 || !specialistId)) {
      setCalendar(null);
      return;
    }

    let mounted = true;
    const requestId = calendarRequestIdRef.current + 1;
    calendarRequestIdRef.current = requestId;
    setLoadingCalendar(true);
    setCalendarError(null);

    fetchJson<AvailabilityCalendar>(
      buildUrl("/api/v1/public/booking/availability/calendar", {
        locationId: safeLocationId,
        serviceId: calendarServiceId,
        serviceIds: calendarServiceIds,
        specialistId: isSpecialistFirst ? specialistId ?? "" : "",
        start: debouncedCalendarQueryStartYmd,
        days: calendarQueryDays,
        holdOwnerMarker,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted || calendarRequestIdRef.current !== requestId) return;

        const cleanedDays = (data?.days ?? [])
          .filter((d) => !isPastYmd(d.date, todayYmdTz))
          .map((d) => ({
            ...d,
            times: (d.times ?? []).filter((x) => !isPastTimeOnDate(d.date, x.time, nowTz)),
          }))
          .filter((d) => d.times.length > 0);

        const next: AvailabilityCalendar = { start: data?.start ?? todayYmdTz, days: cleanedDays };
        setCalendar(next);

      })
      .catch((e: Error) => {
        if (!mounted || calendarRequestIdRef.current !== requestId) return;
        setCalendarError(e.message);
        setCalendar(null);
        calendarKeyRef.current = null;
      })
      .finally(() => {
        if (calendarRequestIdRef.current === requestId) {
          setLoadingCalendar(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    isDateFirst,
    isServiceFirst,
    isSpecialistFirst,
    isChainMode,
    locationId,
    serviceId,
    selectedServiceIds,
    chainPrimaryServiceId,
    specialistId,
    accountSlug,
    holdOwnerMarker,
    todayYmdTz,
    nowTz,
    dateYmd,
    debouncedCalendarQueryStartYmd,
    calendarQueryDays,
    shouldLoadCalendar,
    currentStepKey,
  ]);

  // ---------- dateFirst: offersByTime (time -> serviceIds)
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadDateFirstAvailability) {
      setOffersByTime({});
      setOffersError(null);
      setLoadingOffers(false);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setOffersByTime({});
      setOffersError(null);
      setLoadingOffers(false);
      return;
    }
    if (!dateYmd || isPastYmd(dateYmd, todayYmdTz)) {
      setOffersByTime({});
      setOffersError(null);
      setLoadingOffers(false);
      return;
    }
    if (!services.length) {
      setOffersByTime({});
      setOffersError(null);
      setLoadingOffers(false);
      return;
    }
    const activeLocation = context?.locations?.find((loc) => loc.id === safeLocationId);
    if (activeLocation && dateYmd === todayYmdTz) {
      const todayRange = getTodayWorkRange(activeLocation, todayYmdTz, accountTz);
      if (todayRange?.isClosed) {
        setOffersByTime({});
        setOffersError(null);
        setLoadingOffers(false);
        setDateYmd(ymdAddDays(todayYmdTz, 1));
        return;
      }
      if (todayRange && todayRange.endMinutes !== null && nowTz.minutes >= todayRange.endMinutes) {
        setOffersByTime({});
        setOffersError(null);
        setLoadingOffers(false);
        setDateYmd(ymdAddDays(todayYmdTz, 1));
        return;
      }
    }

    let mounted = true;
    setLoadingOffers(true);
    setOffersError(null);

    const tasks = services.map((s) => () =>
      fetchJson<SlotsData>(
        buildUrl("/api/v1/public/booking/slots", {
          locationId: safeLocationId,
          date: dateYmd,
          serviceId: s.id,
          holdOwnerMarker,
          account: accountSlug ?? "",
        })
      ).then((d) => ({
        serviceId: s.id,
        slots: Array.isArray(d.slots) ? d.slots : [],
      }))
    );

    (async () => {
      try {
        const results = await runBatches(tasks, 6);
        if (!mounted) return;

        const map: Record<string, Set<number>> = {};
        for (const item of results) {
          const times = uniqSortedTimes(item.slots.map((x) => x.time));
          const filtered = filterPastTimes(dateYmd, times, nowTz);
          for (const t of filtered) {
            if (!map[t]) map[t] = new Set<number>();
            map[t].add(item.serviceId);
          }
        }

        const plain: Record<string, number[]> = {};
        Object.entries(map).forEach(([t, set]) => {
          plain[t] = Array.from(set).sort((a, b) => a - b);
        });

        setOffersByTime(plain);
      } catch (e: unknown) {
        if (!mounted) return;
        const message = e instanceof Error ? e.message : "Ошибка загрузки времени";
        setOffersError(message);
        setOffersByTime({});
      } finally {
        if (!mounted) return;
        setLoadingOffers(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    shouldLoadDateFirstAvailability,
    locationId,
    dateYmd,
    services,
    accountSlug,
    holdOwnerMarker,
    todayYmdTz,
    nowTz,
    context?.locations,
    accountTz,
  ]);

  // ---------- dateFirst: available dates (any service) for next 31 days
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadDateFirstAvailability) {
      setDateFirstAvailableDates(new Set());
      setLoadingDateFirstAvailability(false);
      setDateFirstAvailabilityError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setDateFirstAvailableDates(new Set());
      setDateFirstAvailabilityError(null);
      setLoadingDateFirstAvailability(false);
      return;
    }
    const servicesForDateFirst = services.filter((service) => service.bookingType !== "GROUP");
    if (!servicesForDateFirst.length) {
      setDateFirstAvailableDates(new Set());
      setDateFirstAvailabilityError(null);
      setLoadingDateFirstAvailability(false);
      return;
    }

    let mounted = true;
    setLoadingDateFirstAvailability(true);
    setDateFirstAvailabilityError(null);

    const tasks = servicesForDateFirst.map((s) => () =>
      fetchJson<AvailabilityCalendar>(
        buildUrl("/api/v1/public/booking/availability/calendar", {
          locationId: safeLocationId,
          serviceId: s.id,
          start: debouncedCalendarQueryStartYmd,
          days: calendarQueryDays,
          holdOwnerMarker,
          account: accountSlug ?? "",
        })
      ).then((d) => d.days ?? [])
    );

    (async () => {
      try {
        const results = await runBatches(tasks, 4);
        if (!mounted) return;

        const set = new Set<string>();
        for (const days of results) {
          for (const day of days) {
            if (day?.date) set.add(day.date);
          }
        }
        setDateFirstAvailableDates(set);
      } catch (e: unknown) {
        if (!mounted) return;
        setDateFirstAvailableDates(new Set());
        const message = e instanceof Error ? e.message : "Не удалось загрузить доступные даты.";
        setDateFirstAvailabilityError(message);
      } finally {
        if (!mounted) return;
        setLoadingDateFirstAvailability(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    shouldLoadDateFirstAvailability,
    locationId,
    services,
    accountSlug,
    holdOwnerMarker,
    debouncedCalendarQueryStartYmd,
    calendarQueryDays,
  ]);

  // ---------- dateFirst: group offers by time (time -> group serviceIds)
  useEffect(() => {
    if (!isDateFirst || !locationId || !dateYmd) {
      setGroupOffersByTime({});
      return;
    }

    let mounted = true;
    fetchJson<{
      sessions: Array<{
        serviceId: number;
        startAt: string;
        capacity: number;
        bookedCount: number;
        availableSeats?: number;
      }>;
    }>(
      buildUrl("/api/v1/public/booking/group-sessions", {
        locationId,
        date: dateYmd,
        specialistId: specialistId ?? "",
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        const map: Record<string, Set<number>> = {};
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
        for (const session of sessions) {
          const availableSeats =
            typeof session.availableSeats === "number"
              ? session.availableSeats
              : Math.max(0, session.capacity - session.bookedCount);
          if (availableSeats <= 0) continue;
          const time = formatTimeInTz(session.startAt, accountTz);
          if (isPastTimeOnDate(dateYmd, time, nowTz)) continue;
          if (!map[time]) map[time] = new Set<number>();
          map[time].add(session.serviceId);
        }

        const plain: Record<string, number[]> = {};
        Object.entries(map).forEach(([t, set]) => {
          plain[t] = Array.from(set).sort((a, b) => a - b);
        });
        setGroupOffersByTime(plain);
      })
      .catch(() => {
        if (!mounted) return;
        setGroupOffersByTime({});
      });

    return () => {
      mounted = false;
    };
  }, [isDateFirst, locationId, dateYmd, specialistId, accountSlug, accountTz, nowTz]);

  // ---------- group sessions: available dates (by sessions)
  useEffect(() => {
    if (!isGroupService || !locationId || !serviceId) {
      setGroupSessionAvailableDates(new Set());
      setGroupAvailabilityError(null);
      setGroupAvailabilityLoading(false);
      return;
    }

    let mounted = true;
    setGroupAvailabilityLoading(true);
    setGroupAvailabilityError(null);

    fetchJson<{ days: Array<{ date: string }> }>(
      buildUrl("/api/v1/public/booking/group-sessions/availability", {
        locationId,
        serviceId,
        start: debouncedCalendarQueryStartYmd,
        days: calendarQueryDays,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        const dates = Array.isArray(data?.days) ? data.days : [];
        setGroupSessionAvailableDates(new Set(dates.map((d) => d.date)));
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setGroupAvailabilityError(error.message);
        setGroupSessionAvailableDates(new Set());
      })
      .finally(() => {
        if (!mounted) return;
        setGroupAvailabilityLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    isGroupService,
    locationId,
    serviceId,
    debouncedCalendarQueryStartYmd,
    calendarQueryDays,
    accountSlug,
  ]);

  // ---------- dateFirst: slots by chosen service to filter specialists by timeChoice
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!shouldLoadDateFirstServiceSlots) {
      setDateFirstServiceSlots([]);
      setLoadingDateFirstServiceSlots(false);
      setDateFirstServiceSlotsError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setDateFirstServiceSlots([]);
      return;
    }
    if (!selectedServiceIds.length || !dateYmd || !timeChoice) {
      setDateFirstServiceSlots([]);
      return;
    }
    if (isPastYmd(dateYmd, todayYmdTz)) {
      setDateFirstServiceSlots([]);
      return;
    }
    if (isPastTimeOnDate(dateYmd, timeChoice, nowTz)) {
      setDateFirstServiceSlots([]);
      return;
    }

    let mounted = true;
    setLoadingDateFirstServiceSlots(true);
    setDateFirstServiceSlotsError(null);
    const slotServiceId = isChainMode ? chainPrimaryServiceId : serviceId;
    const slotServiceIds = isChainMode
      ? ""
      : selectedServiceIds.length > 0
        ? selectedServiceIds.join(",")
        : "";

    fetchJson<SlotsData>(
      buildUrl("/api/v1/public/booking/slots", {
        locationId: safeLocationId,
        date: dateYmd,
        serviceId: slotServiceId ?? "",
        serviceIds: slotServiceIds,
        holdOwnerMarker,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data.slots) ? data.slots : [];
        const filtered =
          dateYmd === nowTz.ymd ? list.filter((s) => !isPastTimeOnDate(dateYmd, s.time, nowTz)) : list;
        setDateFirstServiceSlots(filtered);
      })
      .catch((e: Error) => {
        if (!mounted) return;
        setDateFirstServiceSlotsError(e.message);
        setDateFirstServiceSlots([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingDateFirstServiceSlots(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    shouldLoadDateFirstServiceSlots,
    locationId,
    dateYmd,
    timeChoice,
    serviceId,
    selectedServiceIds,
    isChainMode,
    chainPrimaryServiceId,
    accountSlug,
    holdOwnerMarker,
    todayYmdTz,
    nowTz,
  ]);

  // ---------- derived selections
  const selectedLocation = useMemo(
    () => context?.locations.find((item) => item.id === locationId) ?? null,
    [context, locationId]
  );

  const selectedServices = useMemo(
    () => services.filter((item) => selectedServiceIds.includes(item.id)),
    [services, selectedServiceIds]
  );

  const specialistById = useMemo(
    () => new Map(specialists.map((sp) => [sp.id, sp])),
    [specialists]
  );

  useEffect(() => {
    if (!isGroupService) return;
    const holdId = activeHold?.holdId ?? null;
    if (!holdId) return;
    setActiveHold(null);
    void releaseHold(holdId).catch(() => {});
  }, [isGroupService, activeHold]);

  const specialistMetricsCacheRef = useRef(
    new Map<number, Map<number, { durationMin: number; price: number }>>()
  );

  useEffect(() => {
    specialistMetricsCacheRef.current.clear();
  }, [locationId]);

  useEffect(() => {
    if (!isGroupService || !locationId || !serviceId || !dateYmd) {
      setGroupSessionsForDate([]);
      setGroupSessionsError(null);
      setGroupSessionsLoading(false);
      setSelectedGroupSessionId(null);
      return;
    }

    let mounted = true;
    setGroupSessionsLoading(true);
    setGroupSessionsError(null);

    const params: Record<string, string> = {
      account: accountSlug ?? "",
      locationId: String(locationId),
      serviceId: String(serviceId),
      date: dateYmd,
    };

    fetchJson<{
      sessions: Array<{
        id: number;
        specialistId: number;
        startAt: string;
        endAt: string;
        capacity: number;
        bookedCount: number;
        availableSeats: number;
        pricePerClient: string | null;
      }>;
    }>(buildUrl("/api/v1/public/booking/group-sessions", params))
      .then((data) => {
        if (!mounted) return;
        const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
        const mapped: GroupSessionSlot[] = sessions
          .map((s) => ({
            id: s.id,
            specialistId: s.specialistId,
            time: formatTimeInTz(s.startAt, accountTz),
            startAt: s.startAt,
            endAt: s.endAt,
            capacity: s.capacity,
            bookedCount: s.bookedCount,
            availableSeats: s.availableSeats ?? Math.max(0, s.capacity - s.bookedCount),
            pricePerClient: s.pricePerClient != null ? Number(s.pricePerClient) : null,
          }))
          .filter((s) => s.availableSeats > 0);
        mapped.sort((a, b) => (timeToMinutes(a.time) ?? 0) - (timeToMinutes(b.time) ?? 0));
        setGroupSessionsForDate(mapped);
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setGroupSessionsError(error.message);
        setGroupSessionsForDate([]);
      })
      .finally(() => {
        if (!mounted) return;
        setGroupSessionsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isGroupService, locationId, serviceId, dateYmd, accountSlug, accountTz]);

  useEffect(() => {
    if (!isGroupService) {
      setSelectedGroupSessionId(null);
      return;
    }
    if (groupSessionsLoading) return;
    const match = groupSessionsForDate.find((s) => {
      if (s.time !== timeChoice) return false;
      if (specialistId) return s.specialistId === specialistId;
      return true;
    });
    setSelectedGroupSessionId(match?.id ?? null);
    if (!match && timeChoice && !(isDateFirst && isGroupService)) {
      setTimeChoice(null);
    }
  }, [
    isGroupService,
    isDateFirst,
    groupSessionsForDate,
    groupSessionsLoading,
    timeChoice,
    specialistId,
  ]);

  const loadSpecialistMetrics = useCallback(
    async (spId: number) => {
      if (!Number.isInteger(spId) || spId <= 0) return new Map();
      const cached = specialistMetricsCacheRef.current.get(spId);
      if (cached) return cached;
      if (!locationId) return new Map();

      const data = await fetchJson<ServicesData>(
        buildUrl(`/api/v1/public/booking/locations/${locationId}/services`, {
          specialistId: spId,
          account: accountSlug ?? "",
        })
      );

      const map = new Map<number, { durationMin: number; price: number }>();
      for (const service of data.services ?? []) {
        map.set(service.id, {
          durationMin: Number.isFinite(service.computedDurationMin ?? service.baseDurationMin)
            ? Number(service.computedDurationMin ?? service.baseDurationMin)
            : 0,
          price: Number.isFinite(service.computedPrice ?? service.basePrice)
            ? Number(service.computedPrice ?? service.basePrice)
            : 0,
        });
      }
      specialistMetricsCacheRef.current.set(spId, map);
      return map;
    },
    [locationId, accountSlug]
  );

  const getServiceDurationMin = useCallback(
    async (serviceId: number, spId: number | null) => {
      if (spId && Number.isInteger(spId)) {
        const map = await loadSpecialistMetrics(spId);
        const cached = map.get(serviceId);
        if (cached && Number.isFinite(cached.durationMin)) return cached.durationMin;
      }
      const base = serviceById.get(serviceId)?.baseDurationMin ?? 0;
      return Number.isFinite(base) ? Number(base) : 0;
    },
    [loadSpecialistMetrics, serviceById]
  );

  const getServicePrice = useCallback(
    async (serviceId: number, spId: number | null) => {
      if (spId && Number.isInteger(spId)) {
        const map = await loadSpecialistMetrics(spId);
        const cached = map.get(serviceId);
        if (cached && Number.isFinite(cached.price)) return cached.price;
      }
      const base = serviceById.get(serviceId)?.basePrice ?? 0;
      return Number.isFinite(base) ? Number(base) : 0;
    },
    [loadSpecialistMetrics, serviceById]
  );

  const loadSlotsForService = useCallback(
    async (serviceId: number, spId?: number | null) => {
      if (!locationId || !dateYmd) return [] as Slot[];
      const data = await fetchJson<SlotsData>(
        buildUrl("/api/v1/public/booking/slots", {
          locationId,
          date: dateYmd,
          serviceId,
          specialistId: spId ?? "",
          holdOwnerMarker,
          account: accountSlug ?? "",
        })
      );
      const list = Array.isArray(data.slots) ? data.slots : [];
      return list.sort((a, b) => {
        const aMin = timeToMinutes(a.time) ?? 0;
        const bMin = timeToMinutes(b.time) ?? 0;
        return aMin - bMin;
      });
    },
    [locationId, dateYmd, holdOwnerMarker, accountSlug]
  );

  const getChainMinStartMinutes = useCallback(
    async (targetIndex: number) => {
      if (targetIndex <= 0) return 0;
      let cursorMinutes = 0;
      for (let i = 0; i < targetIndex; i += 1) {
        const prev = chainItems[i];
        if (!prev?.time) return null;
        const prevStart = timeToMinutes(prev.time);
        if (prevStart == null) return null;
        const prevDuration = await getServiceDurationMin(prev.serviceId, prev.specialistId ?? null);
        cursorMinutes = prevStart + Math.max(0, prevDuration);
      }
      return cursorMinutes;
    },
    [chainItems, getServiceDurationMin]
  );

  const buildChainFromFixed = useCallback(
    async (fixedItems: ChainItem[]) => {
      if (!isVisitPlanMode) return null;
      if (!chainServiceIds.length) return null;
      if (!dateYmd) return null;

      setChainLoading(true);
      setChainError(null);

      try {
        const nextItems: ChainItem[] = [];
        let cursorMinutes = 0;

        for (let i = 0; i < chainServiceIds.length; i += 1) {
          const serviceId = chainServiceIds[i];
          const fixed = fixedItems[i];

          if (fixed && fixed.time) {
            const chosenSpecialistId = isSingleSpecialistPlanMode
              ? specialistId ?? null
              : fixed.specialistId ?? null;
            if (isSingleSpecialistPlanMode && !chosenSpecialistId) {
              throw new Error("Сначала выберите специалиста.");
            }
            const slots = await loadSlotsForService(serviceId, chosenSpecialistId);
            const fixedMinutes = timeToMinutes(fixed.time);
            if (fixedMinutes == null || fixedMinutes < cursorMinutes) {
              throw new Error("Время услуги должно быть позже окончания предыдущей услуги.");
            }

            const hasSlot = chosenSpecialistId
              ? slots.some((s) => s.time === fixed.time && s.specialistId === chosenSpecialistId)
              : slots.some((s) => s.time === fixed.time);

            if (!hasSlot) {
              throw new Error("Для выбранного времени нет доступного специалиста.");
            }

            nextItems.push({
              serviceId,
              specialistId: chosenSpecialistId,
              date: dateYmd,
              time: fixed.time,
            });

            const dur = await getServiceDurationMin(serviceId, chosenSpecialistId);
            cursorMinutes = (timeToMinutes(fixed.time) ?? 0) + dur;
            continue;
          }

          const chosenSpecialistId = isSingleSpecialistPlanMode ? specialistId ?? null : null;
          if (isSingleSpecialistPlanMode && !chosenSpecialistId) {
            throw new Error("Сначала выберите специалиста.");
          }
          if (!isSingleSpecialistPlanMode) {
            nextItems.push({
              serviceId,
              specialistId: null,
              date: dateYmd,
              time: null,
            });
            continue;
          }

          const slots = await loadSlotsForService(serviceId, chosenSpecialistId);
          const candidate = slots.find((s) => {
            const tMin = timeToMinutes(s.time);
            return tMin != null && tMin >= cursorMinutes;
          });
          if (!candidate) {
            throw new Error("Нет последовательных слотов для выбранных услуг.");
          }

          nextItems.push({
            serviceId,
            specialistId: chosenSpecialistId ?? candidate.specialistId,
            date: dateYmd,
            time: candidate.time,
          });

          const dur = await getServiceDurationMin(
            serviceId,
            chosenSpecialistId ?? candidate.specialistId
          );
          cursorMinutes = (timeToMinutes(candidate.time) ?? 0) + dur;
        }

        setChainItems(nextItems);
        setTimeChoice(nextItems[0]?.time ?? null);
        return nextItems;
      } catch (error) {
        setChainError((error as Error).message);
        return null;
      } finally {
        setChainLoading(false);
      }
    },
    [
      isVisitPlanMode,
      chainServiceIds,
      dateYmd,
      loadSlotsForService,
      getServiceDurationMin,
      isSingleSpecialistPlanMode,
      specialistId,
    ]
  );

  const handleServiceToggle = useCallback(
    (service: Service) => {
      const id = service.id;
      const allowMulti = !!service.allowMultiServiceBooking;
      const currentMultiAllowed = selectedServices.every((s) => s.allowMultiServiceBooking);

      if (isDateFirst && timeChoice) {
        const allowed = new Set<number>(offersByTime[timeChoice] ?? []);
        const allowedGroup = new Set<number>(groupOffersByTime[timeChoice] ?? []);
        if (service.bookingType === "GROUP") {
          if (!allowedGroup.has(id)) {
            setSubmitError("Выберите групповую услугу, доступную на выбранное время.");
            return;
          }
        } else if (!allowed.has(id)) {
          setSubmitError("Выберите услугу, доступную на выбранное время.");
          return;
        }
      }

      setSubmitError(null);
      setSubmitSuccess(false);

      if (service.bookingType === "GROUP") {
        setServiceId(id);
        setServiceIds([]);
        if (!isSpecialistFirst) {
          setSpecialistId(null);
        }
        if (!isDateFirst || !timeChoice) {
          setTimeChoice(null);
        }
        setSelectedGroupSessionId(null);
        return;
      }

      if (!allowMulti || !currentMultiAllowed) {
        setServiceId(id);
        setServiceIds([]);
        return;
      }

      const alreadySelected = selectedServiceIds.includes(id);
      if (!alreadySelected) {
        if (!serviceId) {
          setServiceId(id);
          setServiceIds([]);
        } else {
          const next = Array.from(new Set([...selectedServiceIds, id]));
          setServiceId(serviceId);
          setServiceIds(next.filter((x) => x !== serviceId));
        }
        return;
      }

      const next = selectedServiceIds.filter((x) => x !== id);
      if (!next.length) {
        setServiceId(null);
        setServiceIds([]);
        return;
      }

      const primary = serviceId === id ? next[0] : serviceId;
      setServiceId(primary ?? next[0] ?? null);
      setServiceIds(next.filter((x) => x !== (primary ?? next[0])));
    },
    [
      isDateFirst,
      isSpecialistFirst,
      timeChoice,
      offersByTime,
      groupOffersByTime,
      selectedServiceIds,
      selectedServices,
      serviceId,
    ]
  );


  const chainComplete = isVisitPlanMode &&
    chainItems.length > 0 &&
    chainItems.every((item) => !!item.time && !!item.specialistId);

  useEffect(() => {
    if (!isVisitPlanMode) {
      setChainItemDurations({});
      setChainItemPrices({});
      setChainTotals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const nextDurations: Record<number, number> = {};
      const nextPrices: Record<number, number> = {};
      let durationMin = 0;
      let price = 0;
      for (let index = 0; index < chainItems.length; index += 1) {
        const item = chainItems[index];
        const fallbackPrice = Number(
          serviceById.get(item.serviceId)?.minPrice ??
            serviceById.get(item.serviceId)?.basePrice ??
            0
        );
        const fallbackDuration = Number(
          serviceById.get(item.serviceId)?.minDurationMin ??
            serviceById.get(item.serviceId)?.baseDurationMin ??
            0
        );
        const durationForItem = item.specialistId
          ? await getServiceDurationMin(item.serviceId, item.specialistId)
          : fallbackDuration;
        nextDurations[index] =
          Number.isFinite(durationForItem) && durationForItem > 0
            ? Number(durationForItem)
            : 0;
        const priceForItem = item.specialistId
          ? await getServicePrice(item.serviceId, item.specialistId)
          : fallbackPrice;
        nextPrices[index] =
          Number.isFinite(priceForItem) && priceForItem > 0 ? Number(priceForItem) : 0;

        if (!item.specialistId || !item.time) continue;
        durationMin += nextDurations[index];
        price += nextPrices[index];
      }
      if (cancelled) return;
      setChainItemDurations(nextDurations);
      setChainItemPrices(nextPrices);
      setChainTotals(chainComplete ? { durationMin, price } : null);
    })().catch(() => {
      if (cancelled) return;
      setChainItemDurations({});
      setChainItemPrices({});
      setChainTotals(null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    isVisitPlanMode,
    chainComplete,
    chainItems,
    getServiceDurationMin,
    getServicePrice,
    serviceById,
  ]);

  useEffect(() => {
    if (chainEditIndex == null) {
      setChainEditEligibleSpecialistIds(null);
      setChainEditTimes([]);
      setChainEditLoading(false);
      setChainEditConstraintMessage(null);
      return;
    }
    const item = chainItems[chainEditIndex];
    if (!item) {
      setChainEditEligibleSpecialistIds(null);
      setChainEditTimes([]);
      setChainEditConstraintMessage(null);
      return;
    }

    let mounted = true;
    setChainEditLoading(true);
    setChainEditConstraintMessage(null);

    (async () => {
      const minStartMinutes = await getChainMinStartMinutes(chainEditIndex);
      if (!mounted) return;
      if (chainEditIndex > 0 && minStartMinutes == null) {
        setChainEditEligibleSpecialistIds(new Set());
        setChainEditTimes([]);
        setChainEditConstraintMessage("Сначала выберите время для предыдущей услуги.");
        return;
      }

      const allSpecialistIds = isSingleSpecialistPlanMode
        ? (specialistId ? [specialistId] : [])
        : serviceById.get(item.serviceId)?.specialistIds ?? [];
      const eligiblePairs = await runBatches(
        allSpecialistIds.map((candidateSpId) => async () => {
          const slots = await loadSlotsForService(item.serviceId, candidateSpId);
          const hasValid = slots.some((slot) => {
            if (minStartMinutes == null) return true;
            const minutes = timeToMinutes(slot.time);
            return minutes != null && minutes >= minStartMinutes;
          });
          return { candidateSpId, hasValid };
        }),
        4
      );
      if (!mounted) return;
      const eligibleSet = new Set(
        eligiblePairs.filter((x) => x.hasValid).map((x) => x.candidateSpId)
      );
      setChainEditEligibleSpecialistIds(eligibleSet);

      const spId = isSingleSpecialistPlanMode
        ? specialistId ?? item.specialistId
        : chainEditSpecialistId ?? item.specialistId;
      if (!spId || !eligibleSet.has(spId)) {
        setChainEditTimes([]);
        setChainEditConstraintMessage(
          eligibleSet.size > 0
            ? "Сначала выберите специалиста."
            : "Нет доступных специалистов для этой услуги после предыдущей."
        );
        return;
      }

      const slots = await loadSlotsForService(item.serviceId, spId);
      if (!mounted) return;
      const times = slots
        .map((s) => s.time)
        .filter((time) => {
          if (minStartMinutes == null) return true;
          const minutes = timeToMinutes(time);
          return minutes != null && minutes >= minStartMinutes;
        });
      const normalizedTimes = uniqSortedTimes(times);
      setChainEditTimes(normalizedTimes);
      if (normalizedTimes.length === 0) {
        setChainEditConstraintMessage("Нет доступного времени после предыдущей услуги.");
      } else {
        setChainEditConstraintMessage(null);
      }

      const currentTime = item.time ?? null;
      if (currentTime && normalizedTimes.includes(currentTime) && item.specialistId !== spId) {
        const fixed = chainItems
          .slice(0, chainEditIndex)
          .concat([{ serviceId: item.serviceId, specialistId: spId, date: dateYmd, time: currentTime }]);
        void buildChainFromFixed(fixed);
      }
    })()
      .catch(() => {
        if (!mounted) return;
        setChainEditEligibleSpecialistIds(new Set());
        setChainEditTimes([]);
        setChainEditConstraintMessage("Не удалось загрузить доступное время.");
      })
      .finally(() => {
        if (!mounted) return;
        setChainEditLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    chainEditIndex,
    chainEditSpecialistId,
    chainItems,
    loadSlotsForService,
    getChainMinStartMinutes,
    serviceById,
    dateYmd,
    buildChainFromFixed,
    isSingleSpecialistPlanMode,
    specialistId,
  ]);

  useEffect(() => {
    if (!isVisitPlanMode || !chainPrimaryServiceId || !timeChoice) return;
    if (isSingleSpecialistPlanMode && !specialistId) return;
    const firstItem = chainItems[0] ?? null;
    const seededPlanReady =
      planSeededFromUrlRef.current &&
      chainComplete &&
      firstItem?.time === timeChoice;
    if (seededPlanReady) return;
    if (!firstItem) return;
    const expectedSpecialist = isSingleSpecialistPlanMode ? specialistId ?? null : firstItem.specialistId ?? null;
    if (firstItem.time === timeChoice && firstItem.specialistId === expectedSpecialist) return;
    void buildChainFromFixed([
      {
        serviceId: chainPrimaryServiceId,
        specialistId: expectedSpecialist,
        date: dateYmd,
        time: timeChoice,
      },
    ]);
  }, [
    isVisitPlanMode,
    chainPrimaryServiceId,
    timeChoice,
    chainComplete,
    isSingleSpecialistPlanMode,
    specialistId,
    chainItems,
    dateYmd,
    buildChainFromFixed,
  ]);

  const selectedSpecialist = useMemo(
    () => specialists.find((item) => item.id === specialistId) ?? null,
    [specialists, specialistId]
  );

  const servicesForSpecialistFirst = useMemo(() => {
    if (!isSpecialistFirst) return services;
    if (!specialistId) return [];
    return services.filter((s) =>
      Array.isArray(s.specialistIds) ? s.specialistIds.includes(specialistId) : true
    );
  }, [isSpecialistFirst, services, specialistId]);

  useEffect(() => {
    if (!isSpecialistFirst) return;
    if (loadingServices) return;
    // Если выбранные услуги больше недоступны у текущего специалиста, очищаем выбор.
    if (!selectedServiceIds.length) return;

    const allowed = new Set(servicesForSpecialistFirst.map((s) => s.id));
    const nextIds = selectedServiceIds.filter((id) => allowed.has(id));
    if (nextIds.length === selectedServiceIds.length) return;

    const primary = nextIds[0] ?? null;
    setServiceId(primary);
    setServiceIds(primary ? nextIds.filter((id) => id !== primary) : []);
    setTimeChoice(null);
    setCalendar(null);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [isSpecialistFirst, selectedServiceIds, servicesForSpecialistFirst, loadingServices]);

  const servicesThatFitPickedTime = useMemo(() => {
    if (!isDateFirst) return services;
    if (!timeChoice) return isGroupService ? services : [];
    const allowedIds = new Set<number>(offersByTime[timeChoice] ?? []);
    const allowedGroupIds = new Set<number>(groupOffersByTime[timeChoice] ?? []);
    return services.filter((s) =>
      s.bookingType === "GROUP" ? allowedGroupIds.has(s.id) : allowedIds.has(s.id)
    );
  }, [isDateFirst, isGroupService, services, timeChoice, offersByTime, groupOffersByTime]);

  const baseServicesForServiceStep = useMemo(() => {
    if (isDateFirst) return servicesThatFitPickedTime;
    if (isSpecialistFirst) return servicesForSpecialistFirst;
    return services;
  }, [isDateFirst, isSpecialistFirst, servicesThatFitPickedTime, servicesForSpecialistFirst, services]);

  const serviceCategoryTabs = useMemo(() => {
    const categories = new Map<string, string>();
    for (const service of baseServicesForServiceStep) {
      const key = service.categorySlug?.trim() || "__uncategorized";
      const label = service.categoryName?.trim() || "Без категории";
      if (!categories.has(key)) categories.set(key, label);
    }
    return [{ key: "all", label: "Все" }, ...Array.from(categories, ([key, label]) => ({ key, label }))];
  }, [baseServicesForServiceStep]);

  useEffect(() => {
    if (selectedServiceCategory === "all") return;
    if (!serviceCategoryTabs.some((tab) => tab.key === selectedServiceCategory)) {
      setSelectedServiceCategory("all");
    }
  }, [selectedServiceCategory, serviceCategoryTabs]);

  const servicesByCategory = useMemo(() => {
    if (selectedServiceCategory === "all") return baseServicesForServiceStep;
    return baseServicesForServiceStep.filter((service) => {
      const key = service.categorySlug?.trim() || "__uncategorized";
      return key === selectedServiceCategory;
    });
  }, [baseServicesForServiceStep, selectedServiceCategory]);

  const servicesForServiceStep = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return servicesByCategory;
    return servicesByCategory.filter((service) => service.name.toLowerCase().includes(value));
  }, [servicesByCategory, query]);

  // calendar map
  const calendarByDate = useMemo(() => {
    const map = new Map<string, Map<string, number[]>>();
    (calendar?.days ?? []).forEach((d) => {
      const tmap = new Map<string, number[]>();
      d.times.forEach((t) => tmap.set(t.time, t.specialistIds ?? []));
      map.set(d.date, tmap);
    });
    return map;
  }, [calendar]);

  const calendarAvailableDates = useMemo(() => {
    return new Set((calendar?.days ?? []).map((d) => d.date));
  }, [calendar]);
  const activeAvailableDates = useMemo(() => {
    if (isGroupService) return groupSessionAvailableDates;
    if (isDateFirst) return dateFirstAvailableDates;
    return calendarAvailableDates;
  }, [isGroupService, isDateFirst, groupSessionAvailableDates, dateFirstAvailableDates, calendarAvailableDates]);
  const nearestAvailableDateYmd = useMemo(() => {
    const sorted = Array.from(activeAvailableDates)
      .filter((d) => !isPastYmd(d, todayYmdTz))
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    if (sorted.length === 0) return null;
    if (sorted.includes(dateYmd)) return null;
    const next = sorted.find((d) => d >= dateYmd);
    return next ?? sorted[0] ?? null;
  }, [activeAvailableDates, dateYmd, todayYmdTz]);

  const availableTimesForCurrentStep = useMemo(() => {
    if (!dateYmd || isPastYmd(dateYmd, todayYmdTz)) return [];
    if (isGroupService) {
      const times = groupSessionsForDate.map((s) => s.time);
      const sorted = uniqSortedTimes(times);
      return filterPastTimes(dateYmd, sorted, nowTz);
    }

    if (isDateFirst) {
      const times = uniqSortedTimes(Object.keys(offersByTime));
      return filterPastTimes(dateYmd, times, nowTz);
    }

    const dayMap = calendarByDate.get(dateYmd);
    const times = dayMap ? Array.from(dayMap.keys()) : [];
    const sorted = uniqSortedTimes(times);
    return filterPastTimes(dateYmd, sorted, nowTz);
  }, [
    isGroupService,
    groupSessionsForDate,
    isDateFirst,
    dateYmd,
    offersByTime,
    calendarByDate,
    todayYmdTz,
    nowTz,
  ]);

  const groupTimeMeta = useMemo(() => {
    if (!isGroupService) return null;
    const map = new Map<
      string,
      { seats: number; prices: number[] }
    >();
    for (const session of groupSessionsForDate) {
      const slot = map.get(session.time) ?? { seats: 0, prices: [] };
      slot.seats += session.availableSeats;
      if (session.pricePerClient != null && Number.isFinite(session.pricePerClient)) {
        slot.prices.push(Number(session.pricePerClient));
      }
      map.set(session.time, slot);
    }
    const out: Record<string, string> = {};
    for (const [time, info] of map.entries()) {
      const parts: string[] = [];
      if (info.seats > 0) {
        parts.push(`мест: ${info.seats}`);
      }
      if (info.prices.length > 0) {
        const minPrice = Math.min(...info.prices);
        parts.push(`от ${formatMoneyRub(minPrice)}`);
      }
      if (parts.length > 0) {
        out[time] = parts.join(" · ");
      }
    }
    return out;
  }, [isGroupService, groupSessionsForDate]);

  const isCalendarWindowTransitioning = !isDateFirst && loadingCalendar;
  const isTimesPanelLoading = isGroupService
    ? groupSessionsLoading
    : isDateFirst
    ? loadingOffers
    : isCalendarWindowTransitioning && availableTimesForCurrentStep.length === 0;
  const isStepLoadingOverlay =
    (currentStepKey === "location" && loadingContext) ||
    (currentStepKey === "service" && loadingServices) ||
    (currentStepKey === "specialist" &&
      (loadingSpecialists || loadingWorkdaySpecs || loadingDateFirstServiceSlots || loadingSinglePlanSpecialists)) ||
    (currentStepKey === "datetime" && (isTimesPanelLoading || groupAvailabilityLoading));
  const shouldShowFullscreenLoaderOverlay =
    Boolean(effectiveInlineLoader?.showBookingInline) &&
    (((overlayNextDeadline !== null) && isStepLoadingOverlay) ||
      (currentStepKey === "datetime" && isTimesPanelLoading));
  const [showFullscreenLoaderOverlay, setShowFullscreenLoaderOverlay] = useState(false);
  useEffect(() => {
    if (overlayNextDeadline === null) return;
    const now = Date.now();
    if (overlayNextDeadline <= now) {
      setOverlayNextDeadline(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setOverlayNextDeadline(null);
    }, overlayNextDeadline - now);
    return () => window.clearTimeout(timer);
  }, [overlayNextDeadline]);
  useEffect(() => {
    if (shouldShowFullscreenLoaderOverlay) {
      if (!showFullscreenLoaderOverlay) {
        fullscreenLoaderShownAtRef.current = Date.now();
        setShowFullscreenLoaderOverlay(true);
      }
      return;
    }
    if (!showFullscreenLoaderOverlay) return;
    const shownAt = fullscreenLoaderShownAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const configuredMinVisibleMs =
      effectiveInlineLoader?.fixedDurationEnabled && Number.isFinite(effectiveInlineLoader.fixedDurationSec)
        ? Math.max(1, Math.round(effectiveInlineLoader.fixedDurationSec)) * 1000
        : 240;
    const minVisibleMs = configuredMinVisibleMs;
    const hideDelay = Math.max(0, minVisibleMs - elapsed);
    const timer = window.setTimeout(() => {
      setShowFullscreenLoaderOverlay(false);
      fullscreenLoaderShownAtRef.current = null;
    }, hideDelay);
    return () => window.clearTimeout(timer);
  }, [shouldShowFullscreenLoaderOverlay, showFullscreenLoaderOverlay, effectiveInlineLoader]);
  const shouldShowNoSlotsNotice =
    !isTimesPanelLoading &&
    !isCalendarWindowTransitioning &&
    availableTimesForCurrentStep.length === 0;
  const [showNoSlotsNotice, setShowNoSlotsNotice] = useState(false);
  useEffect(() => {
    if (!shouldShowNoSlotsNotice) {
      setShowNoSlotsNotice(false);
      return;
    }
    const timer = setTimeout(() => setShowNoSlotsNotice(true), 180);
    return () => clearTimeout(timer);
  }, [shouldShowNoSlotsNotice, dateYmd]);
  const nearestAvailableDateLabel = useMemo(
    () => (nearestAvailableDateYmd ? formatDateRu(nearestAvailableDateYmd) : ""),
    [nearestAvailableDateYmd]
  );

  const specialistsByChosenDateTime = useMemo(() => {
    if (isSpecialistFirst) {
      const set = workdaySpecialistIds;
      if (!set) return specialists;
      return specialists.filter((s) => set.has(s.id));
    }

    if (isGroupService) {
      const sessions = groupSessionsForDate;
      if (!sessions.length) return [];
      const filtered = timeChoice ? sessions.filter((s) => s.time === timeChoice) : sessions;
      const ids = filtered.map((s) => s.specialistId);
      const set = new Set(ids);
      return specialists.filter((s) => set.has(s.id));
    }

    if (!selectedServiceIds.length || !dateYmd || !timeChoice) return [];

    if (isDateFirst) {
      const ids = dateFirstServiceSlots
        .filter((s) => s.time === timeChoice)
        .map((s) => s.specialistId);
      const set = new Set(ids);
      return specialists.filter((s) => set.has(s.id));
    }

    const ids = calendarByDate.get(dateYmd)?.get(timeChoice) ?? [];
    const set = new Set(ids);
    return specialists.filter((s) => set.has(s.id));
  }, [
    isSpecialistFirst,
    isGroupService,
    groupSessionsForDate,
    isDateFirst,
    specialists,
    workdaySpecialistIds,
    selectedServiceIds,
    dateYmd,
    timeChoice,
    dateFirstServiceSlots,
    calendarByDate,
  ]);

  useEffect(() => {
    if (!isSingleSpecialistPlanMode || !dateYmd || !timeChoice || chainServiceIds.length === 0) {
      setSinglePlanEligibleSpecialistIds(null);
      setLoadingSinglePlanSpecialists(false);
      return;
    }

    const candidateIds = isSpecialistFirst && specialistId
      ? [specialistId]
      : specialistsByChosenDateTime.map((s) => s.id);
    if (candidateIds.length === 0) {
      setSinglePlanEligibleSpecialistIds(new Set());
      setLoadingSinglePlanSpecialists(false);
      return;
    }

    const selectedTimeMin = timeToMinutes(timeChoice);
    if (selectedTimeMin == null) {
      setSinglePlanEligibleSpecialistIds(new Set());
      setLoadingSinglePlanSpecialists(false);
      return;
    }

    let mounted = true;
    setLoadingSinglePlanSpecialists(true);

    runBatches(
      candidateIds.map((spId) => async () => {
        let cursor = selectedTimeMin;
        for (let i = 0; i < chainServiceIds.length; i += 1) {
          const chainServiceId = chainServiceIds[i];
          const slots = await loadSlotsForService(chainServiceId, spId);
          const matchedSlot =
            i === 0
              ? slots.find((slot) => slot.time === timeChoice)
              : slots.find((slot) => {
                  const tMin = timeToMinutes(slot.time);
                  return tMin != null && tMin >= cursor;
                });
          if (!matchedSlot) return { spId, ok: false };

          const startMin = timeToMinutes(matchedSlot.time);
          if (startMin == null) return { spId, ok: false };

          const durationMin = await getServiceDurationMin(chainServiceId, spId);
          cursor = startMin + Math.max(0, durationMin);
        }
        return { spId, ok: true };
      }),
      4
    )
      .then((result) => {
        if (!mounted) return;
        const eligible = new Set(result.filter((item) => item.ok).map((item) => item.spId));
        setSinglePlanEligibleSpecialistIds(eligible);
      })
      .catch(() => {
        if (!mounted) return;
        setSinglePlanEligibleSpecialistIds(new Set());
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingSinglePlanSpecialists(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    isSingleSpecialistPlanMode,
    isSpecialistFirst,
    specialistId,
    dateYmd,
    timeChoice,
    chainServiceIds,
    specialistsByChosenDateTime,
    loadSlotsForService,
    getServiceDurationMin,
  ]);

  useEffect(() => {
    if (!isSingleSpecialistPlanMode || !specialistId) return;
    if (isSpecialistFirst) return;
    if (loadingSinglePlanSpecialists) return;
    if (!singlePlanEligibleSpecialistIds) return;
    // Avoid destructive reset on transient empty state while eligibility is still stabilizing.
    if (singlePlanEligibleSpecialistIds.size === 0) return;
    if (singlePlanEligibleSpecialistIds.has(specialistId)) return;
    setSpecialistId(null);
  }, [isSingleSpecialistPlanMode, isSpecialistFirst, specialistId, singlePlanEligibleSpecialistIds, loadingSinglePlanSpecialists]);

  const specialistsForSpecialistStep = useMemo(() => {
    if (!isSingleSpecialistPlanMode || !singlePlanEligibleSpecialistIds) {
      return specialistsByChosenDateTime;
    }
    return specialistsByChosenDateTime.filter((s) => singlePlanEligibleSpecialistIds.has(s.id));
  }, [
    specialistsByChosenDateTime,
    isSingleSpecialistPlanMode,
    singlePlanEligibleSpecialistIds,
  ]);

  const specialistCategoryTabs = useMemo(() => {
    const categories = new Map<string, string>();
    for (const specialist of specialistsForSpecialistStep) {
      for (const category of specialist.categories ?? []) {
        if (!categories.has(category.slug)) {
          categories.set(category.slug, category.name);
        }
      }
    }
    return [{ key: "all", label: "Все" }, ...Array.from(categories, ([key, label]) => ({ key, label }))];
  }, [specialistsForSpecialistStep]);

  useEffect(() => {
    if (selectedSpecialistCategory === "all") return;
    if (!specialistCategoryTabs.some((tab) => tab.key === selectedSpecialistCategory)) {
      setSelectedSpecialistCategory("all");
    }
  }, [selectedSpecialistCategory, specialistCategoryTabs]);

  const specialistsByCategory = useMemo(() => {
    if (selectedSpecialistCategory === "all") return specialistsForSpecialistStep;
    return specialistsForSpecialistStep.filter((specialist) =>
      (specialist.categories ?? []).some(
        (category) => category.slug === selectedSpecialistCategory
      )
    );
  }, [specialistsForSpecialistStep, selectedSpecialistCategory]);

  const specialistsForSpecialistStepFiltered = useMemo(() => {
    const value = specialistQuery.trim().toLowerCase();
    if (!value) return specialistsByCategory;
    return specialistsByCategory.filter((specialist) => {
      const haystack = `${specialist.name} ${specialist.role ?? ""}`.toLowerCase();
      return haystack.includes(value);
    });
  }, [specialistsByCategory, specialistQuery]);

  const showFromServiceMetrics =
    !isChainMode && !specialistId && (isServiceFirst || isDateFirst);

  const serviceDuration =
    selectedServices.length === 0
      ? null
      : selectedServices.reduce((sum, s) => {
          const duration = showFromServiceMetrics
            ? s.minDurationMin ?? s.baseDurationMin ?? 0
            : s.computedDurationMin ?? s.baseDurationMin ?? 0;
          return sum + (Number.isFinite(duration) ? duration : 0);
        }, 0);

  const servicePrice =
    selectedServices.length === 0
      ? null
      : selectedServices.reduce((sum, s) => {
          const price = showFromServiceMetrics
            ? s.minPrice ?? s.basePrice ?? 0
            : s.computedPrice ?? s.basePrice ?? 0;
          return sum + (Number.isFinite(price) ? price : 0);
        }, 0);
  const groupSummaryDurationMin = useMemo(() => {
    if (!isGroupService) return null;
    const source =
      specialistId != null
        ? specialistsByChosenDateTime.filter((sp) => sp.id === specialistId)
        : specialistsByChosenDateTime;
    const values = source
      .map((sp) => Number(sp.serviceDurationMin))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length === 0) return null;
    return Math.min(...values);
  }, [isGroupService, specialistId, specialistsByChosenDateTime]);

  const groupSummaryPriceMin = useMemo(() => {
    if (!isGroupService) return null;
    const source =
      specialistId != null
        ? specialistsByChosenDateTime.filter((sp) => sp.id === specialistId)
        : specialistsByChosenDateTime;
    const values = source
      .map((sp) => Number(sp.servicePrice))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length === 0) return null;
    return Math.min(...values);
  }, [isGroupService, specialistId, specialistsByChosenDateTime]);

  const effectiveServiceDuration =
    isVisitPlanMode && chainComplete && chainTotals
      ? chainTotals.durationMin
      : isGroupService
        ? groupSummaryDurationMin ?? serviceDuration
        : serviceDuration;
  const effectiveServicePrice =
    isVisitPlanMode && chainComplete && chainTotals
      ? chainTotals.price
      : isGroupService
        ? groupSummaryPriceMin ?? servicePrice
        : servicePrice;
  const chainSpecialistsReady =
    isVisitPlanMode &&
    chainItems.length > 0 &&
    chainItems.every((item) => !!item.specialistId);
  const showApproxTotals =
    (!isVisitPlanMode && showFromServiceMetrics) ||
    (isVisitPlanMode && !chainSpecialistsReady) ||
    (isGroupService && !specialistId);
  const servicePriceLabel =
    effectiveServicePrice != null
      ? `${showApproxTotals ? "от " : ""}${formatMoneyRub(effectiveServicePrice)}`
      : "—";
  const serviceDurationLabel =
    effectiveServiceDuration != null
      ? `${showApproxTotals ? "от " : ""}${effectiveServiceDuration} мин`
      : "—";
  const summaryDateLabel = formatDateRu(dateYmd);
  const selectedServiceNames = selectedServices.map((s) => s.name).join(", ");
  const summaryServiceLabel = selectedServiceNames || "—";
  const chainSummaryItems = isVisitPlanMode
    ? chainServiceIds.map((serviceId, index) => {
        const item = chainItems[index] ?? null;
        const serviceName = serviceById.get(serviceId)?.name ?? `#${serviceId}`;
        const specialistName =
          item?.specialistId != null
            ? specialistById.get(item.specialistId)?.name ?? "—"
            : "—";
        const time = item?.specialistId != null ? item?.time ?? "—" : "—";
        const durationMin = chainItemDurations[index] ?? 0;
        const durationLabel =
          durationMin > 0
            ? `${item?.specialistId != null ? "" : "от "}${durationMin} мин`
            : "—";
        const price = chainItemPrices[index] ?? 0;
        const priceLabel =
          price > 0
            ? `${item?.specialistId != null ? "" : "от "}${formatMoneyRub(price)}`
            : "—";
        return {
          serviceName,
          specialistName,
          time,
          durationLabel,
          priceLabel,
          showSpecialist: isChainMode,
        };
      })
    : [];

  const slotEnd = useMemo(() => {
    if (!timeChoice || !effectiveServiceDuration) return "";
    return addMinutes(timeChoice, effectiveServiceDuration);
  }, [timeChoice, effectiveServiceDuration]);

  const nameReady = clientName.trim().length >= 2;
  const isRuPhoneValid = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11) return digits.startsWith("7") || digits.startsWith("8");
    if (digits.length === 10) return digits.startsWith("9");
    return false;
  };
  const phoneNormalized = normalizeRuPhone(clientPhone.trim());
  const phoneReady = Boolean(phoneNormalized) && isRuPhoneValid(clientPhone);
  const timeSelectionReady = isGroupService
    ? !!timeChoice && !!selectedGroupSessionId && !!specialistId
    : isVisitPlanMode
      ? chainComplete
      : !!specialistId && !!timeChoice;

  const requiredLegalDocs = useMemo(
    () => legalDocs.filter((doc) => doc.isRequired),
    [legalDocs]
  );

  const missingRequiredLegalDocs = useMemo(
    () => requiredLegalDocs.filter((doc) => !legalConsents[doc.versionId]),
    [requiredLegalDocs, legalConsents]
  );

  const submitBlockingReasons = useMemo(() => {
    if (submitSuccess) return [] as string[];

    const nextStepKey =
      stepIndex + 1 < stepsWithScenario.length
        ? (stepsWithScenario[stepIndex + 1]?.key as BookingUiStepKey | undefined) ?? null
        : null;
    const nextStepHint = () => {
      if (!nextStepKey) return "перейдите к следующему шагу.";
      if (nextStepKey === "details") return "перейдите к контактам.";
      const target =
        nextStepKey === "location"
          ? "локации"
          : nextStepKey === "datetime"
            ? "даты и времени"
            : nextStepKey === "service"
              ? "услуги"
              : nextStepKey === "specialist"
                ? "специалиста"
                : nextStepKey === "chain"
                  ? "плана визита"
                  : "следующего шага";
      return `перейдите к выбору ${target}.`;
    };

    if (currentStepKey === "location") {
      if (!locationId) return ["Выберите локацию."];
      return [`Локация выбрана, ${nextStepHint()}`];
    }
    if (!locationId) {
      return ["Выберите локацию."];
    }

    if (currentStepKey === "datetime") {
      if (!timeChoice) return ["Выберите дату и время."];
      return [`Дата и время выбраны, ${nextStepHint()}`];
    }

    if (currentStepKey === "service") {
      if (selectedServiceIds.length === 0) return ["Выберите услугу."];
      return [`Услуга выбрана, ${nextStepHint()}`];
    }

    if (currentStepKey === "specialist") {
      if (!specialistId) return ["Выберите специалиста."];
      return [`Специалист выбран, ${nextStepHint()}`];
    }

    if (currentStepKey === "chain") {
      if (!chainComplete) return ["Выберите специалистов и время для всех услуг."];
      return [`План визита заполнен, ${nextStepHint()}`];
    }

    if (currentStepKey !== "details") {
      return ["Перейдите к следующему шагу."];
    }

    if (selectedServiceIds.length === 0) return ["Выберите услугу."];
    if (!timeSelectionReady) {
      return [
        isChainMode
          ? "Выберите специалистов и время для всех услуг."
          : isVisitPlanMode
            ? "Выберите специалиста и время для всех услуг."
            : "Выберите специалиста и время.",
      ];
    }
    if (isGroupService && !selectedGroupSessionId) {
      return ["Выберите групповой сеанс."];
    }

    const reasons: string[] = [];

    if (!nameReady) reasons.push("Заполните имя (минимум 2 символа).");
    if (!phoneReady) reasons.push("Введите корректный номер телефона (например: +7 9XX XXX-XX-XX или 8 9XX XXX-XX-XX).");

    if (missingRequiredLegalDocs.length > 0) {
      if (missingRequiredLegalDocs.length === 1) {
        reasons.push(
          `Подтвердите обязательное согласие: «${missingRequiredLegalDocs[0].title}».`
        );
      } else {
        reasons.push(
          `Подтвердите обязательные согласия (${missingRequiredLegalDocs.length}).`
        );
      }
    }

    return reasons;
  }, [
    submitSuccess,
    locationId,
    stepIndex,
    stepsWithScenario,
    selectedServiceIds,
    timeSelectionReady,
    isChainMode,
    isVisitPlanMode,
    currentStepKey,
    isGroupService,
    selectedGroupSessionId,
    specialistId,
    timeChoice,
    chainComplete,
    nameReady,
    phoneReady,
    missingRequiredLegalDocs,
  ]);

  const groupAlreadyBooked = useMemo(() => {
    if (!isGroupService || !selectedGroupSessionId) return false;
    return groupBookedIds.includes(selectedGroupSessionId);
  }, [groupBookedIds, isGroupService, selectedGroupSessionId]);

  const canSubmit = submitBlockingReasons.length === 0;

  const summaryHint = useMemo(() => {
    if (submitSuccess || canSubmit) return "";
    return submitBlockingReasons[0] ?? "Проверьте обязательные поля.";
  }, [
    submitSuccess,
    canSubmit,
    submitBlockingReasons,
  ]);

  useEffect(() => {
    if (!submitError) return;
    const stillRelevant = submitBlockingReasons.includes(submitError);
    if (!stillRelevant) setSubmitError(null);
  }, [submitError, submitBlockingReasons]);

  const canNext = useMemo(() => {
    switch (currentStepKey) {
      case "scenario":
        return true;
      case "location":
        return !!locationId;
      case "datetime":
        if (isDateFirst && selectedServiceIds.length === 0) return true;
        return isGroupService ? !!selectedGroupSessionId : !!timeChoice;
      case "service":
        if (isDateFirst && isGroupService && !timeChoice) return true;
        return selectedServiceIds.length > 0;
      case "specialist":
        if (!specialistId) return false;
        if (isSingleSpecialistPlanMode && singlePlanEligibleSpecialistIds) {
          return singlePlanEligibleSpecialistIds.has(specialistId);
        }
        return true;
      case "chain":
        return chainComplete;
      case "details":
        return canSubmit;
      default:
        return true;
    }
  }, [
    currentStepKey,
    canSubmit,
    locationId,
    selectedServiceIds,
    specialistId,
    timeChoice,
    isGroupService,
    isDateFirst,
    selectedGroupSessionId,
    chainComplete,
    isSingleSpecialistPlanMode,
    singlePlanEligibleSpecialistIds,
  ]);

  const goNext = () => {
    if (currentStepKey === "service" && isDateFirst && isGroupService && !timeChoice) {
      setPendingStepKey("datetime");
      return;
    }
    setOverlayNextDeadline(Date.now() + 900);
    setStepIndex((v) => Math.min(stepsWithScenario.length - 1, v + 1));
  };
  const goPrev = () => {
    setOverlayNextDeadline(null);
    setStepIndex((v) => Math.max(0, v - 1));
  };

  useEffect(() => {
    if (!initialParamsApplied) return;
    if (typeof window === "undefined") return;
    const stepKey =
      (stepsWithScenario[stepIndex]?.key as BookingUiStepKey | undefined) ?? null;
    const payload: BookingPersistedState = {
      scenario,
      // Не сохраняем флаг шага сценария между сессиями.
      // Он должен приходить только из текущего URL (?start=scenario).
      startScenario: false,
      locationId,
      serviceId,
      serviceIds,
      specialistId,
      dateYmd,
      timeChoice,
      timeBucket,
      query,
      specialistQuery,
      selectedServiceCategory,
      selectedSpecialistCategory,
      stepKey,
      updatedAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(
        bookingStateStorageKey(accountSlug, accountPublicSlug),
        JSON.stringify(payload)
      );
    } catch {
      // ignore storage errors
    }
  }, [
    initialParamsApplied,
    scenario,
    startScenario,
    locationId,
    serviceId,
    serviceIds,
    specialistId,
    dateYmd,
    timeChoice,
    timeBucket,
    query,
    specialistQuery,
    selectedServiceCategory,
    selectedSpecialistCategory,
    stepIndex,
    stepsWithScenario,
    accountSlug,
    accountPublicSlug,
  ]);

  const getContactDefaults = () => {
    if (!clientProfile) {
      return { name: "", phone: "", email: "" };
    }
    const name = `${clientProfile.firstName ?? ""} ${clientProfile.lastName ?? ""}`.trim();
    return {
      name,
      phone: clientProfile.phone ?? "",
      email: clientProfile.email ?? "",
    };
  };

  const clearBrowserBookingState = () => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.removeItem(
        bookingStateStorageKey(accountSlug, accountPublicSlug)
      );
      persistedStateRef.current = null;
    } catch {
      // ignore storage errors
    }

    try {
      const u = new URL(window.location.href);
      const paramsToDrop = [
        "locationId",
        "serviceId",
        "specialistId",
        "date",
        "time",
        "scenario",
        "start",
      ];
      let changed = false;
      for (const key of paramsToDrop) {
        if (!u.searchParams.has(key)) continue;
        u.searchParams.delete(key);
        changed = true;
      }
      if (changed) {
        const next = u.pathname + (u.search ? u.search : "") + u.hash;
        window.history.replaceState(null, "", next);
      }
    } catch {
      // ignore URL rewrite errors
    }
  };

  const resetAll = () => {
    clearBrowserBookingState();

    const holdToRelease = activeHold?.holdId ?? null;
    const defaults = getContactDefaults();
    setServiceId(null);
    setServiceIds([]);
    setSpecialistId(null);
    setTimeChoice(null);
    setSelectedGroupSessionId(null);
    setClientName(defaults.name);
    setClientPhone(defaults.phone);
    setClientEmail(defaults.email);
    setComment("");
    setLegalConsents({});
    setSubmitError(null);
    setSubmitSuccess(false);
    setActiveHold(null);
    setDateYmd(todayYmdTz);
    setTimeBucket("all");
    setQuery("");
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
    calendarKeyRef.current = null;
    setStepIndex(0);
    if (holdToRelease) {
      void releaseHold(holdToRelease).catch(() => {});
    }
  };

  const submitAppointment = async () => {
    if (isGroupService) {
      if (!canSubmit) {
        setSubmitError(summaryHint || submitBlockingReasons[0] || "Проверьте обязательные поля.");
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        const { participantId } = await fetchJson<{ participantId: number }>(
          buildUrl(`/api/v1/public/booking/group-sessions/${selectedGroupSessionId}/book`, {
            account: accountSlug ?? "",
          }),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": getIdempotencyKey(),
            },
            body: JSON.stringify({
              clientName: clientName.trim(),
              clientPhone: clientPhone.trim(),
              clientEmail: clientEmail.trim() || undefined,
              legalVersionIds: Object.entries(legalConsents)
                .filter(([, checked]) => checked)
                .map(([id]) => Number(id)),
            }),
          }
        );
        logBookingStep({
          stepKey: "completed",
          stepIndex: stepsWithScenario.length,
          stepTitle: "Завершено записью",
          payload: { participantId, groupSessionId: selectedGroupSessionId },
        });
        setSubmitSuccess(true);
        markGroupSessionBooked(selectedGroupSessionId);
        idempotencyKeyRef.current = null;
      } catch (error) {
        setSubmitError(humanizeBookingError(error));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!canSubmit) {
      setSubmitError(summaryHint || submitBlockingReasons[0] || "Проверьте обязательные поля.");
      return;
    }
    if (!isChainMode && (isPastYmd(dateYmd, todayYmdTz) || isPastTimeOnDate(dateYmd, timeChoice!, nowTz))) {
      setSubmitError("Выберите корректные дату и время.");
      return;
    }

    if (isChainMode) {
      if (!chainComplete) {
        setSubmitError("Заполните специалиста и время для всех услуг.");
        return;
      }

      const groupBookingId = makeIdempotencyKey();
      const createdHoldIds: number[] = [];
      const appointmentIds: number[] = [];

      setSubmitting(true);
      setSubmitError(null);

      try {
        for (const item of chainItems) {
          if (!item.time || !item.specialistId) {
            throw new Error("Заполните специалиста и время для всех услуг.");
          }
          if (isPastTimeOnDate(item.date, item.time, nowTz)) {
            throw new Error("Выберите корректные дату и время.");
          }

          const selection = {
            locationId: locationId!,
            specialistId: item.specialistId,
            serviceId: item.serviceId,
            serviceIds: [item.serviceId],
            date: item.date,
            time: item.time,
          };

          const hold = await reserveHold(selection, null);
          createdHoldIds.push(hold.holdId);

          const { appointmentId } = await fetchJson<{ appointmentId: number }>(
            buildUrl("/api/v1/public/booking/appointments", { account: accountSlug ?? "" }),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": makeIdempotencyKey(),
              },
              body: JSON.stringify({
                locationId,
                specialistId: item.specialistId,
                serviceId: item.serviceId,
                date: item.date,
                time: item.time,
                clientName: clientName.trim(),
                clientPhone: clientPhone.trim(),
                clientEmail: clientEmail.trim() || undefined,
                comment: comment.trim() || undefined,
                holdId: hold.holdId,
                sessionKey: bookingSessionKey || undefined,
                groupBookingId,
                legalVersionIds: Object.entries(legalConsents)
                  .filter(([, checked]) => checked)
                  .map(([id]) => Number(id)),
              }),
            }
          );
          appointmentIds.push(appointmentId);
        }

        logBookingStep({
          stepKey: "completed",
          stepIndex: stepsWithScenario.length,
          stepTitle: "Ð—Ð°Ð²ÐµÑ€ÑˆÐµÐ½Ð¾ Ð·Ð°Ð¿Ð¸ÑÑŒÑŽ",
          payload: { appointmentIds, groupBookingId },
        });

        setSubmitSuccess(true);
        idempotencyKeyRef.current = null;
        return;
      } catch (error) {
        for (const holdId of createdHoldIds) {
          void releaseHold(holdId).catch(() => {});
        }
        setSubmitError(humanizeBookingError(error));
        return;
      } finally {
        setSubmitting(false);
      }
    }

    if (isDateFirst) {
      const allowedServiceIds = new Set<number>(offersByTime[timeChoice!] ?? []);
      if (
        !selectedServiceIds.length ||
        selectedServiceIds.some((id) => !allowedServiceIds.has(id))
      ) {
        setSubmitError("Выберите услуги, доступные на выбранное время.");
        return;
      }

      const specialistStillAvailable = dateFirstServiceSlots.some(
        (slot) => slot.time === timeChoice && slot.specialistId === specialistId
      );
      if (!specialistStillAvailable) {
        setSubmitError("Выберите специалиста, доступного на выбранное время.");
        return;
      }
    } else {
      const specialistIdsAtTime = calendarByDate.get(dateYmd)?.get(timeChoice!) ?? [];
      if (!specialistIdsAtTime.includes(specialistId!)) {
        setSubmitError("Выберите специалиста, доступного на выбранное время.");
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!holdSelection) {
        setSubmitError("Выберите корректные дату и время.");
        return;
      }

      const hold =
        holdMatchesSelection(activeHold, holdSelection) && activeHold && isHoldStillFresh(activeHold.expiresAt)
          ? { holdId: activeHold.holdId, expiresAt: activeHold.expiresAt }
          : await reserveHold(holdSelection, activeHold?.holdId ?? null);

      if (!activeHold || activeHold.holdId !== hold.holdId || activeHold.expiresAt !== hold.expiresAt) {
        setActiveHold({
          holdId: hold.holdId,
          expiresAt: hold.expiresAt,
          ...holdSelection,
        });
      }

      const { appointmentId } = await fetchJson<{ appointmentId: number }>(
        buildUrl("/api/v1/public/booking/appointments", { account: accountSlug ?? "" }),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": getIdempotencyKey(),
          },
          body: JSON.stringify({
            locationId,
            specialistId,
            serviceId,
            serviceIds: selectedServiceIds,
            date: dateYmd,
            time: timeChoice,
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            clientEmail: clientEmail.trim() || undefined,
            comment: comment.trim() || undefined,
            holdId: hold.holdId,
            sessionKey: bookingSessionKey || undefined,
            legalVersionIds: Object.entries(legalConsents)
              .filter(([, checked]) => checked)
              .map(([id]) => Number(id)),
          }),
        }
      );
      logBookingStep({
        stepKey: "completed",
        stepIndex: stepsWithScenario.length,
        stepTitle: "Завершено записью",
        payload: { appointmentId },
      });
      setSubmitSuccess(true);
      idempotencyKeyRef.current = null;
    } catch (error) {
      setSubmitError(humanizeBookingError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = clientName.trim() ? clientName.trim() : "Гость";
  const displayPhone = clientPhone.trim() ? clientPhone.trim() : "—";
  const progress =
    stepsWithScenario.length <= 1
      ? 0
      : stepIndex / (stepsWithScenario.length - 1);
  return (
    <div className="booking-root min-h-dvh w-full bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]">
      <div className="mx-auto w-full p-0" style={{ maxWidth: "var(--bp-content-width, 1024px)" }}>
        <div className="h-0" />

        <div
          className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_auto]"
          style={{ marginTop: "var(--booking-top-gap, 1rem)" }}
        >
          <SoftPanel className="min-w-0 p-4 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-4">
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-[110px] text-right text-xs text-[color:var(--bp-muted)]">Сценарий записи</div>
                  <div className="text-[11px] text-[color:var(--bp-muted)]">Можно переключить</div>
                </div>
                <div className="flex flex-wrap justify-start lg:justify-end">
                  <div className="flex w-full flex-wrap gap-1 rounded-2xl bg-[color:var(--bp-paper)] p-1">
                    {[
                      { key: "dateFirst", label: "Дата" },
                      { key: "serviceFirst", label: "Услуга" },
                      { key: "specialistFirst", label: "Специалист" },
                    ].map((item) => {
                      const active = scenario === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setScenario(item.key as Scenario)}
                          className={cn(
                            "flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition",
                            active
                              ? "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                              : "text-[color:var(--bp-muted)] hover:bg-black/5"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar value={progress} />
                  </div>
                  <div className="w-[120px] shrink-0 text-right text-xs text-[color:var(--bp-muted)]">
                    Шаг {stepIndex + 1} из {stepsWithScenario.length}
                  </div>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="w-[120px] shrink-0 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-xs transition hover:-translate-y-[1px] hover:shadow-sm"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

            </div>
          </SoftPanel>

          <SoftPanel className="min-w-0 p-4 sm:p-6 lg:col-start-1 lg:row-start-2 lg:flex lg:h-[600px] lg:flex-col">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">
                  {stepsWithScenario[stepIndex]?.title}
                </div>
              </div>

              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  className="min-w-[70px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-xs transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
                >
                  Назад
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext || stepIndex === stepsWithScenario.length - 1}
                  className="min-w-[70px] rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-button-text)] transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
                >
                  Далее
                </button>
              </div>
            </div>

            <div className="sticky top-[132px] z-30 -mt-9 mb-3 flex justify-end gap-2 sm:hidden">
              <button
                type="button"
                onClick={goPrev}
                disabled={stepIndex === 0}
                className="min-w-[70px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-xs transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
              >
                Назад
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={!canNext || stepIndex === stepsWithScenario.length - 1}
                className="min-w-[70px] rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-button-text)] transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
              >
                Далее
              </button>
            </div>

            <div className="mt-4 border-t border-[color:var(--bp-stroke)] pt-4 lg:min-h-0 lg:flex-1">
              <div className="min-h-[620px] px-1 lg:h-full lg:min-h-0 lg:overflow-y-auto [scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:var(--bp-accent)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--bp-accent)]">
                {currentStepKey === "scenario" && (
                  <div className="space-y-3">
                    <ScenarioTabs value={scenario} onChange={setScenario} />
                  </div>
                )}
                {currentStepKey === "location" && (
                  <div className="space-y-3">
                    {contextError && <div className="text-sm text-red-600">{contextError}</div>}

                    {!loadingContext && !contextError && (
                      <div className="space-y-3">
                        <div
                          className={cn(
                            "grid gap-3 [grid-auto-rows:1fr]",
                            (context?.locations?.length ?? 0) === 1
                              ? "grid-cols-1"
                              : "grid-cols-1 sm:grid-cols-2"
                          )}
                        >
                          {(context?.locations ?? []).map((location) => {
                            const active = location.id === locationId;
                            const openStatus = getLocationOpenStatus(
                              location,
                              nowTz,
                              accountTz
                            );
                            const locationProfileHref = accountPublicSlug
                              ? `/${accountPublicSlug}/locations/${location.id}`
                              : "#";
                            return (
                              <article
                                key={location.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setLocationId(location.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setLocationId(location.id);
                                  }
                                }}
                                className={cn(
                                  "h-full cursor-pointer rounded-3xl border p-4 text-left transition",
                                  "hover:-translate-y-[1px] hover:shadow-sm",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                                )}
                              >
                                <div className="flex h-full flex-col gap-3">
                                  <div className="relative">
                                    {location.coverUrl ? (
                                      <div className="overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)]">
                                        <img
                                          src={location.coverUrl}
                                          alt={location.name}
                                          className="aspect-video w-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex aspect-video items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                        <div className="text-2xl font-semibold text-[color:var(--bp-muted)]">
                                          {initials(location.name)}
                                        </div>
                                      </div>
                                    )}

                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute -right-2 -top-2 z-[1] h-8 w-8 rounded-full bg-[color:var(--bp-paper)]"
                                    />

                                    <a
                                      href={locationProfileHref}
                                      onClick={(event) => event.stopPropagation()}
                                      className={cn(
                                        "absolute -right-1 -top-1 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-full",
                                        "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] transition hover:opacity-90"
                                      )}
                                      aria-label={`Информация о локации ${location.name}`}
                                      title="Информация о локации"
                                    >
                                      <span className="inline-flex items-center justify-center text-[11px] font-semibold leading-none">
                                        i
                                      </span>
                                    </a>
                                  </div>

                                  <div className="mt-auto relative pb-9">
                                    <div>
                                      <div className="text-base font-semibold leading-snug break-words">
                                        {location.name}
                                      </div>
                                      <div className="mt-1 text-sm text-[color:var(--bp-muted)] break-words">
                                        {location.address || "Адрес не указан"}
                                      </div>
                                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                                        {openStatus.label}
                                      </div>
                                    </div>
                                    <div
                                      className={cn(
                                        "absolute bottom-0 right-0 rounded-2xl border px-2 py-1 text-xs",
                                        active
                                          ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                      )}
                                    >
                                      {active ? "Выбрано" : "Выбрать"}
                                    </div>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStepKey === "datetime" && (
                  <div className="space-y-4">
                    {/* ✅ Новый календарь как на примере (без теней, выбор — черная обводка) */}
                    <DatePickerLike
                      value={dateYmd}
                      timeZone={accountTz}
                      disabledBeforeYmd={todayYmdTz}
                      availableDates={activeAvailableDates}
                      onViewMonthChange={(monthStart) => {
                        setCalendarViewMonthStart((prev) =>
                          prev === monthStart ? prev : monthStart
                        );
                      }}
                      onChange={(ymd) => {
                        if (isPastYmd(ymd, todayYmdTz)) return;
                        setDateYmd(ymd);
                      }}
                      onUnavailableDateSelect={(ymd, reason) => {
                        if (reason === "past") return;
                        setDateYmd(ymd);
                      }}
                    />

                    {isDateFirst && (
                      <>
                        {dateFirstAvailabilityError && <div className="text-sm text-red-600">{dateFirstAvailabilityError}</div>}
                        {offersError && <div className="text-sm text-red-600">{offersError}</div>}
                      </>
                    )}

                    {!isDateFirst && (
                      <>
                        {calendarError && <div className="text-sm text-red-600">{calendarError}</div>}
                      </>
                    )}
                    {isGroupService && groupAvailabilityError && (
                      <div className="text-sm text-red-600">{groupAvailabilityError}</div>
                    )}
                    {isGroupService && groupSessionsError && (
                      <div className="text-sm text-red-600">{groupSessionsError}</div>
                    )}

                    {((isDateFirst) ||
                      (isServiceFirst && selectedServiceIds.length > 0) ||
                      (isSpecialistFirst && !!specialistId && selectedServiceIds.length > 0)) && (
                      <div className="space-y-3">
                        {showNoSlotsNotice && (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
                            <div>Нет доступных слотов на выбранную дату.</div>
                            {nearestAvailableDateYmd && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span>Ближайшая свободная дата: {nearestAvailableDateLabel}.</span>
                                <button
                                  type="button"
                                  onClick={() => setDateYmd(nearestAvailableDateYmd)}
                                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] px-3 py-1.5 text-xs font-medium text-[color:var(--bp-button-text)] transition hover:opacity-90"
                                >
                                  Перейти
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {!isTimesPanelLoading && availableTimesForCurrentStep.length > 0 && (
                          <TimeGrid
                            times={availableTimesForCurrentStep}
                            selected={timeChoice}
                            timeBucket={timeBucket}
                            onBucket={setTimeBucket}
                            metaByTime={isGroupService ? groupTimeMeta ?? undefined : undefined}
                            onSelect={(t) => {
                              if (isPastTimeOnDate(dateYmd, t, nowTz)) return;
                              const changed = t !== timeChoice;
                              setTimeChoice(t);
                              if (!changed) return;

                              setSubmitError(null);
                              setSubmitSuccess(false);

                              if (isGroupService) {
                                const session =
                                  groupSessionsForDate.find((s) => s.time === t && (!specialistId || s.specialistId === specialistId)) ??
                                  groupSessionsForDate.find((s) => s.time === t) ??
                                  null;
                                setSelectedGroupSessionId(session?.id ?? null);
                                return;
                              }

                              if (isVisitPlanMode && chainPrimaryServiceId) {
                                if (isSingleSpecialistPlanMode && !specialistId) {
                                  return;
                                }
                                void buildChainFromFixed([
                                  {
                                    serviceId: chainPrimaryServiceId,
                                    specialistId: isSingleSpecialistPlanMode ? specialistId ?? null : null,
                                    date: dateYmd,
                                    time: t,
                                  },
                                ]);
                                return;
                              }

                              if (isDateFirst && selectedServiceIds.length) {
                                const allowedServiceIds = new Set<number>(offersByTime[t] ?? []);
                                const nextIds = selectedServiceIds.filter((id) => allowedServiceIds.has(id));
                                if (!nextIds.length) {
                                  setServiceId(null);
                                  setServiceIds([]);
                                } else {
                                  const primary = nextIds[0];
                                  setServiceId(primary);
                                  setServiceIds(nextIds.filter((id) => id !== primary));
                                }
                              }
                            }}
                          />
                        )}

                      </div>
                    )}
                  </div>
                )}

                {currentStepKey === "service" && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="-mx-1 overflow-hidden px-1 sm:mx-0 sm:px-0">
                          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:var(--bp-accent)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--bp-accent)]">
                          {serviceCategoryTabs.map((tab) => {
                            const active = selectedServiceCategory === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSelectedServiceCategory(tab.key)}
                                className={cn(
                                  "whitespace-nowrap rounded-2xl border px-3 py-1.5 text-xs transition",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                )}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск услуги"
                        className="h-10 w-full rounded-2xl border-2 border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm placeholder:text-[color:var(--bp-muted)] focus:outline-none sm:w-[280px] sm:flex-none"
                      />
                    </div>

                    {servicesError && <div className="text-sm text-red-600">{servicesError}</div>}

                    {!loadingServices && !servicesError && (
                      <div className="grid grid-cols-1 gap-3 [grid-auto-rows:1fr] sm:[grid-template-columns:repeat(var(--bp-cards-cols,2),minmax(0,1fr))]">
                        {servicesForServiceStep.map((service) => {
                          const price = showFromServiceMetrics
                            ? service.minPrice ?? service.basePrice ?? 0
                            : service.computedPrice ?? service.basePrice ?? 0;
                          const duration = showFromServiceMetrics
                            ? service.minDurationMin ?? service.baseDurationMin ?? 0
                            : service.computedDurationMin ?? service.baseDurationMin ?? 0;
                          const active = selectedServiceIds.includes(service.id);
                          const serviceProfileHref = accountPublicSlug
                            ? `/${accountPublicSlug}/services/${service.id}`
                            : "#";

                          return (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => handleServiceToggle(service)}
                                className={cn(
                                "h-full rounded-3xl border p-4 text-left transition",
                                "hover:-translate-y-[1px] hover:shadow-sm",
                                active
                                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                                )}
                            >
                              <div className="flex h-full flex-col gap-3">
                                <div className="relative">
                                  {service.coverUrl ? (
                                    <div className="aspect-[8.5/9] overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                      <img
                                        src={service.coverUrl}
                                        alt={service.name}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex aspect-[8.5/9] items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                      <div className="text-2xl font-semibold text-[color:var(--bp-muted)]">
                                        {initials(service.name)}
                                      </div>
                                    </div>
                                  )}

                                  <span
                                    aria-hidden
                                    className="pointer-events-none absolute -right-2 -top-2 z-[1] h-8 w-8 rounded-full bg-[color:var(--bp-paper)]"
                                  />

                                  <a
                                    href={serviceProfileHref}
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "absolute -right-1 -top-1 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-full",
                                      "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] transition hover:opacity-90"
                                    )}
                                    aria-label={`Информация об услуге ${service.name}`}
                                    title="Информация об услуге"
                                  >
                                    <span className="inline-flex items-center justify-center text-[11px] font-semibold leading-none">
                                      i
                                    </span>
                                  </a>
                                </div>

                                <div className="mt-auto relative pb-9">
                                  <div>
                                    <div className="text-base font-semibold leading-snug break-words">
                                      {service.name}
                                    </div>
                                    <div className="mt-1 text-sm font-semibold">
                                      {showFromServiceMetrics
                                        ? `от ${formatMoneyRub(price)}`
                                        : formatMoneyRub(price)}
                                    </div>
                                    <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                                      {showFromServiceMetrics ? `от ${duration} мин` : `${duration} мин`}
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      "absolute bottom-0 right-0 rounded-2xl border px-2 py-1 text-xs",
                                      active
                                        ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                        : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                    )}
                                  >
                                    {active ? "Выбрано" : "Выбрать"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {!servicesForServiceStep.length && (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)] sm:col-span-2">
                            {isDateFirst && timeChoice
                              ? "Нет услуг, которые помещаются в выбранное время."
                              : isSpecialistFirst && specialistId
                                ? "У выбранного специалиста нет услуг (или они не найдены)."
                                : "Услуги не найдены."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {currentStepKey === "specialist" && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="-mx-1 overflow-hidden px-1 sm:mx-0 sm:px-0">
                          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:var(--bp-accent)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--bp-accent)]">
                          {specialistCategoryTabs.map((tab) => {
                            const active = selectedSpecialistCategory === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSelectedSpecialistCategory(tab.key)}
                                className={cn(
                                  "whitespace-nowrap rounded-2xl border px-3 py-1.5 text-xs transition",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                )}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                      <input
                        value={specialistQuery}
                        onChange={(event) => setSpecialistQuery(event.target.value)}
                        placeholder="Поиск специалиста"
                        className="h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm sm:w-[280px] sm:flex-none"
                      />
                    </div>

                    {specialistsError && <div className="text-sm text-red-600">{specialistsError}</div>}

                    {isSpecialistFirst && (
                      <>
                        {workdaySpecsError && <div className="text-sm text-red-600">{workdaySpecsError}</div>}
                      </>
                    )}

                    {isDateFirst && (
                      <>
                        {selectedServiceIds.length === 0 || !timeChoice ? (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
                            Чтобы выбрать Специалиста, сначала выберите дату+время и услугу.
                          </div>
                        ) : (
                          <>
                            {dateFirstServiceSlotsError && (
                              <div className="text-sm text-red-600">{dateFirstServiceSlotsError}</div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {!loadingSpecialists &&
                      !specialistsError &&
                      (isSpecialistFirst || (!isSpecialistFirst && selectedServiceIds.length > 0 && !!timeChoice)) &&
                      (!isDateFirst || (!loadingDateFirstServiceSlots && selectedServiceIds.length > 0 && !!timeChoice)) && (
                        <div className="grid grid-cols-1 gap-3 [grid-auto-rows:1fr] sm:[grid-template-columns:repeat(var(--bp-cards-cols,2),minmax(0,1fr))]">
                          {specialistsForSpecialistStepFiltered.map((sp) => {
                            const active = sp.id === specialistId;
                            const specialistProfileHref = accountPublicSlug
                              ? `/${accountPublicSlug}/specialists/${sp.id}`
                              : "#";
                            const specialistServiceDuration =
                              sp.serviceDurationMin ?? serviceDuration ?? null;
                            const specialistServicePrice =
                              sp.servicePrice ?? servicePrice ?? null;
                            return (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => setSpecialistId(sp.id)}
                                className={cn(
                                  "h-full rounded-3xl border p-4 text-left transition",
                                  "hover:-translate-y-[1px] hover:shadow-sm",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                                )}
                              >
                                <div className="flex h-full flex-col gap-3">
                                  <div className="relative">
                                    {sp.coverUrl || sp.avatarUrl ? (
                                      <div className="aspect-[8.5/9] overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                        <img
                                          src={sp.coverUrl ?? sp.avatarUrl ?? ""}
                                          alt={sp.name}
                                          className="h-full w-full object-cover object-top"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex aspect-[8.5/9] items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                        <div className="text-2xl font-semibold text-[color:var(--bp-muted)]">
                                          {initials(sp.name)}
                                        </div>
                                      </div>
                                    )}

                                    <span
                                      aria-hidden
                                      className="pointer-events-none absolute -right-2 -top-2 z-[1] h-8 w-8 rounded-full bg-[color:var(--bp-paper)]"
                                    />

                                    <a
                                      href={specialistProfileHref}
                                      onClick={(event) => event.stopPropagation()}
                                      className={cn(
                                        "absolute -right-1 -top-1 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-full",
                                        "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] transition hover:opacity-90"
                                      )}
                                      aria-label={`Информация о специалисте ${sp.name}`}
                                      title="Информация о специалисте"
                                    >
                                      <span className="inline-flex items-center justify-center text-[11px] font-semibold leading-none">
                                        i
                                      </span>
                                    </a>
                                  </div>

                                  <div className="mt-auto relative pb-9">
                                    <div>
                                      <div className="text-base font-semibold leading-snug break-words">
                                        {sp.name}
                                      </div>
                                      <div className="mt-1 text-sm text-[color:var(--bp-muted)] break-words">
                                        {sp.role || "Специалист"}
                                      </div>
                                      {selectedServices.length > 0 && (
                                        <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                                          {specialistServiceDuration != null
                                            ? `${specialistServiceDuration} мин`
                                            : "—"}
                                          {" · "}
                                          {specialistServicePrice != null
                                            ? formatMoneyRub(specialistServicePrice)
                                            : "—"}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "absolute bottom-0 right-0 rounded-2xl border px-2 py-1 text-xs",
                                        active
                                          ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                      )}
                                    >
                                      {active ? "Выбрано" : "Выбрать"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {specialistsForSpecialistStepFiltered.length === 0 && (
                            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)] sm:col-span-2">
                              Нет специалистов по выбранным условиям.
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                )}

                
                {currentStepKey === "chain" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3 text-sm text-[color:var(--bp-muted)]">
                      {isSingleSpecialistPlanMode
                        ? "Для каждой услуги выберите время. Специалист выбирается один раз на шаге «Специалист»."
                        : "Для каждой услуги выберите специалиста и время."} После подтверждения всех услуг кнопка
                      «Далее» станет активной.
                    </div>
                    {chainError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {chainError}
                      </div>
                    )}
                    {chainLoading && (
                      <div className="text-sm text-[color:var(--bp-muted)]">Загрузка плана визита</div>
                    )}

                    <div className="space-y-3">
                      {chainItems.map((item, idx) => {
                        const service = serviceById.get(item.serviceId);
                        const serviceName = service?.name ?? `Service #${item.serviceId}`;
                        const availableSpecialists = (service?.specialistIds ?? [])
                          .map((id) => specialistById.get(id))
                          .filter(Boolean) as Specialist[];
                        const selectedSpId = isSingleSpecialistPlanMode
                          ? specialistId ?? item.specialistId ?? null
                          : item.specialistId ?? null;
                        const selectedSp = selectedSpId
                          ? specialistById.get(selectedSpId)
                          : null;

                        const isEditing = chainEditIndex === idx;
                        const currentSpId = isSingleSpecialistPlanMode
                          ? specialistId ?? item.specialistId ?? null
                          : chainEditSpecialistId ?? item.specialistId ?? null;
                        const currentTime = item.time ?? null;
                        const eligibleSpecialists =
                          isEditing && chainEditEligibleSpecialistIds
                            ? availableSpecialists.filter((sp) =>
                                chainEditEligibleSpecialistIds.has(sp.id)
                              )
                            : availableSpecialists;
                        const selectSpecialistValue =
                          currentSpId &&
                          eligibleSpecialists.some((sp) => sp.id === currentSpId)
                            ? currentSpId
                            : "";

                        return (
                          <div
                            key={item.serviceId}
                            className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm text-[color:var(--bp-muted)]">
                                  Услуга №{idx + 1}: {serviceName}
                                </div>
                                <div className="mt-1 text-sm">
                                  Специалист: {selectedSp?.name ?? "Выберите специалиста"}
                                </div>
                                <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                                  Время: {selectedSp ? currentTime ?? "Выберите время" : "Выберите специалиста"}
                                </div>
                              </div>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                                  "border border-[color:var(--bp-stroke)] hover:-translate-y-[1px] hover:shadow-sm",
                                  selectedSp && currentTime
                                    ? "bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
                                    : "bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                )}
                                onClick={() => {
                                  setChainEditIndex(idx);
                                  setChainEditSpecialistId(
                                    isSingleSpecialistPlanMode
                                      ? specialistId ?? item.specialistId ?? null
                                      : item.specialistId ?? null
                                  );
                                }}
                              >
                                {selectedSp && currentTime ? "Изменить" : "Выбрать"}
                              </button>
                            </div>

                            {isEditing && (
                              <div className="mt-4 space-y-3">
                                {!isSingleSpecialistPlanMode ? (
                                  <div className="grid grid-cols-1 gap-2">
                                    <label className="text-xs text-[color:var(--bp-muted)]">Специалист</label>
                                    <select
                                      className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm"
                                      value={selectSpecialistValue}
                                      onChange={async (event) => {
                                      const nextId = Number(event.target.value) || null;
                                      setChainEditSpecialistId(nextId);
                                      setChainEditTimes([]);
                                      if (!nextId) {
                                        setChainItems((prev) =>
                                          prev.map((entry, entryIndex) => {
                                            if (entryIndex < idx) return entry;
                                            if (entryIndex === idx) {
                                              return { ...entry, specialistId: null, time: null };
                                            }
                                            return { ...entry, specialistId: null, time: null };
                                          })
                                        );
                                        return;
                                      }

                                      const currentItemTime = item.time;
                                      if (!currentItemTime) {
                                        setChainItems((prev) =>
                                          prev.map((entry, entryIndex) => {
                                            if (entryIndex < idx) return entry;
                                            if (entryIndex === idx) {
                                              return { ...entry, specialistId: nextId, time: null };
                                            }
                                            return { ...entry, specialistId: null, time: null };
                                          })
                                        );
                                        return;
                                      }

                                      try {
                                        const minStartMinutes = await getChainMinStartMinutes(idx);
                                        const slots = await loadSlotsForService(item.serviceId, nextId);
                                        const times = uniqSortedTimes(
                                          slots
                                            .map((s) => s.time)
                                            .filter((time) => {
                                              if (minStartMinutes == null) return false;
                                              const timeMinutes = timeToMinutes(time);
                                              return (
                                                timeMinutes != null &&
                                                timeMinutes >= minStartMinutes
                                              );
                                            })
                                        );

                                        const canKeepCurrentTime = times.includes(currentItemTime);
                                        if (times.length === 0) {
                                          setChainEditConstraintMessage(
                                            "У этого специалиста нет времени после предыдущей услуги. Выберите другого специалиста."
                                          );
                                          setChainItems((prev) =>
                                            prev.map((entry, entryIndex) => {
                                              if (entryIndex < idx) return entry;
                                              if (entryIndex === idx) {
                                                return { ...entry, specialistId: null, time: null };
                                              }
                                              return { ...entry, specialistId: null, time: null };
                                            })
                                          );
                                          return;
                                        }
                                        if (canKeepCurrentTime) {
                                          const fixed = chainItems
                                            .slice(0, idx)
                                            .concat([
                                              {
                                                serviceId: item.serviceId,
                                                specialistId: nextId,
                                                date: dateYmd,
                                                time: currentItemTime,
                                              },
                                            ]);
                                          void buildChainFromFixed(fixed);
                                          setChainEditIndex(null);
                                          return;
                                        }
                                      } catch {
                                        // noop, fallback to clearing time below
                                      }

                                      setChainItems((prev) =>
                                        prev.map((entry, entryIndex) => {
                                          if (entryIndex < idx) return entry;
                                          if (entryIndex === idx) {
                                            return { ...entry, specialistId: nextId, time: null };
                                          }
                                          return { ...entry, specialistId: null, time: null };
                                        })
                                      );
                                      }}
                                    >
                                      <option value="">
                                        {eligibleSpecialists.length > 0
                                          ? "Выберите специалиста"
                                          : "Нет доступных специалистов"}
                                      </option>
                                      {eligibleSpecialists.map((sp) => (
                                        <option key={sp.id} value={sp.id}>
                                          {sp.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm">
                                    Специалист: {selectedSpecialist?.name ?? "—"}
                                  </div>
                                )}

                                {chainEditLoading && (
                                  <div className="text-xs text-[color:var(--bp-muted)]">Загрузка слотов</div>
                                )}

                                {!chainEditLoading && chainEditConstraintMessage && (
                                  <div className="text-xs text-[color:var(--bp-muted)]">
                                    {chainEditConstraintMessage}
                                  </div>
                                )}

                                {!chainEditLoading && chainEditTimes.length > 0 && (
                                  <TimeGrid
                                    times={chainEditTimes}
                                    selected={currentTime}
                                    timeBucket={timeBucket}
                                    onBucket={setTimeBucket}
                                    onSelect={(t) => {
                                      if (!currentSpId) return;
                                      const fixed = chainItems
                                        .slice(0, idx)
                                        .concat([
                                          {
                                            serviceId: item.serviceId,
                                            specialistId: currentSpId,
                                            date: dateYmd,
                                            time: t,
                                          },
                                        ]);
                                      void buildChainFromFixed(fixed);
                                      setChainEditIndex(null);
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentStepKey === "details" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4">
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-medium text-[color:var(--bp-muted)]">Имя</div>
                            <input
                              value={clientName}
                              onChange={(event) => setClientName(event.target.value)}
                              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm"
                              placeholder="Например, Надежда"
                            />
                          </div>

                          <div>
                            <div className="text-xs font-medium text-[color:var(--bp-muted)]">Телефон</div>
                            <input
                              value={clientPhone}
                              onChange={(event) => setClientPhone(event.target.value)}
                              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm"
                              placeholder="+7 …"
                            />
                          </div>

                          <div>
                            <div className="text-xs font-medium text-[color:var(--bp-muted)]">Email</div>
                            <input
                              value={clientEmail}
                              onChange={(event) => setClientEmail(event.target.value)}
                              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm"
                              placeholder="Необязательно"
                            />
                          </div>

                          <div>
                            <div className="text-xs font-medium text-[color:var(--bp-muted)]">Комментарий</div>
                            <input
                              value={comment}
                              onChange={(event) => setComment(event.target.value)}
                              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm"
                              placeholder="Например, нужно снятие"
                            />
                          </div>

                          {legalDocs.length > 0 && (
                            <div className="space-y-3 text-xs text-[color:var(--bp-muted)]">
                              <div className="text-xs font-medium text-[color:var(--bp-muted)]">
                                Документы и согласия
                              </div>
                              {legalDocs
                                .filter((doc) => doc.isRequired)
                                .map((doc) => {
                                  const checked = !!legalConsents[doc.versionId];
                                  const accountParam =
                                    context?.account?.slug || accountSlug || "";
                                  const publicSlug = accountPublicSlug;
                                  const legalLink = publicSlug
                                    ? `/${publicSlug}/legal/${doc.versionId}`
                                    : accountParam
                                      ? `/booking/legal/${doc.versionId}?account=${accountParam}`
                                      : `/booking/legal/${doc.versionId}`;

                                  return (
                                    <div
                                      key={doc.versionId}
                                      className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3"
                                    >
                                      <label className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(event) =>
                                            setLegalConsents((prev) => ({
                                              ...prev,
                                              [doc.versionId]: event.target.checked,
                                            }))
                                          }
                                          className="mt-1"
                                        />
                                        <span className="text-[color:var(--bp-ink)]">
                                          {doc.title} (обязательно)
                                        </span>
                                      </label>
                                      <div className="mt-2 text-[11px] text-[color:var(--bp-muted)]">
                                        <a
                                          href={legalLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[color:var(--bp-accent)] underline"
                                        >
                                          Прочитать
                                        </a>
                                      </div>
                                    </div>
                                  );
                                })}

                              {(legalDocs.some((doc) => !doc.isRequired) ||
                                platformLegalDocs.length > 0) && (
                                <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
                                  <div className="text-[11px] text-[color:var(--bp-muted)]">
                                    Дополнительные документы
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                    {legalDocs
                                      .filter((doc) => !doc.isRequired)
                                      .map((doc) => {
                                        const accountParam =
                                          context?.account?.slug || accountSlug || "";
                                        const publicSlug = accountPublicSlug;
                                        const legalLink = publicSlug
                                          ? `/${publicSlug}/legal/${doc.versionId}`
                                          : accountParam
                                            ? `/booking/legal/${doc.versionId}?account=${accountParam}`
                                            : `/booking/legal/${doc.versionId}`;
                                        return (
                                          <a
                                            key={doc.versionId}
                                            href={legalLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[color:var(--bp-ink)] underline"
                                          >
                                            {doc.title}
                                          </a>
                                        );
                                      })}
                                    {platformLegalDocs.map((doc) => (
                                      <a
                                        key={doc.versionId}
                                        href={`/legal/platform/${doc.versionId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[color:var(--bp-ink)] underline"
                                      >
                                        {doc.title}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </SoftPanel>

          <SoftPanel className="min-w-0 p-4 sm:p-6 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:h-full lg:self-stretch">
            <div className="space-y-4">
              <div className="text-base font-semibold">Сводка</div>
              <div className="space-y-2">
                <SummaryRow label="Локация" value={selectedLocation?.name || "—"} />
                <SummaryRow label="Дата" value={summaryDateLabel || "—"} />
                {!isVisitPlanMode ? (
                  <SummaryRow label="Услуга" value={summaryServiceLabel || "—"} />
                ) : null}
                {isVisitPlanMode ? (
                  <div className="space-y-3">
                    {chainSummaryItems.length === 0 ? (
                      <SummaryRow label="План визита" value="—" />
                    ) : null}
                    {isSingleSpecialistPlanMode ? (
                      <SummaryRow label="Специалист" value={selectedSpecialist?.name || "—"} />
                    ) : null}
                    {chainSummaryItems.map((item, index) => (
                      <div
                        key={`${item.serviceName}-${index}`}
                        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3"
                      >
                        <div className="text-xs font-semibold text-[color:var(--bp-muted)]">
                          Услуга №{index + 1}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[color:var(--bp-ink)]">
                          {item.serviceName}
                        </div>
                        <div className="mt-2 space-y-1">
                          {item.showSpecialist ? (
                            <SummaryRow label="Специалист" value={item.specialistName || "—"} />
                          ) : null}
                          <SummaryRow label="Время" value={item.time || "—"} />
                          <SummaryRow label="Длительность" value={item.durationLabel} />
                          <SummaryRow label="Стоимость" value={item.priceLabel} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <SummaryRow label="Специалист" value={selectedSpecialist?.name || "—"} />
                    <SummaryRow
                      label="Время"
                      value={
                        timeChoice
                          ? `${timeChoice}${slotEnd ? `–${slotEnd}` : ""}`
                          : "—"
                      }
                    />
                  </>
                )}
                <SummaryRow
                  label={isVisitPlanMode ? "Общая длительность" : "Длительность"}
                  value={serviceDurationLabel}
                />
                <SummaryRow
                  label={isVisitPlanMode ? "Общая стоимость" : "Стоимость"}
                  value={servicePriceLabel}
                />
              </div>

              {submitError && <div className="text-sm text-red-600">{submitError}</div>}
              {submitSuccess && (
                <div className="text-sm text-green-700">Запись оформлена</div>
              )}
              {groupAlreadyBooked && !submitSuccess && (
                <div className="text-xs text-amber-600">
                  Вы уже бронировали этот групповой сеанс с этого устройства.
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (submitSuccess) {
                    resetAll();
                    return;
                  }
                  if (!canSubmit) {
                    setSubmitError(
                      summaryHint || submitBlockingReasons[0] || "Проверьте обязательные поля."
                    );
                    return;
                  }
                  void submitAppointment();
                }}
                disabled={submitSuccess ? false : submitting}
                aria-disabled={!submitSuccess && !canSubmit}
                className={`w-full rounded-2xl bg-[color:var(--bp-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--bp-button-text)] transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40${
                  !submitSuccess && !canSubmit ? " opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {submitSuccess ? "Новая запись" : submitting ? "Отправляем..." : "Записаться"}
              </button>

              {!submitSuccess && !canSubmit && summaryHint && (
                <div className="space-y-1 text-xs text-[color:var(--bp-muted)]">
                  {submitBlockingReasons.map((reason, index) => (
                    <div key={`${reason}-${index}`}>{reason}</div>
                  ))}
                </div>
              )}
            </div>
          </SoftPanel>

        </div>
      </div>
      {showFullscreenLoaderOverlay && effectiveInlineLoader ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center"
          style={
            effectiveInlineLoader.backdropEnabled
              ? { backgroundColor: effectiveInlineLoader.backdropColor }
              : { backgroundColor: "transparent" }
          }
        >
          <SiteLoader config={effectiveInlineLoader} />
          <span className="sr-only">Загрузка</span>
        </div>
      ) : null}
    </div>
  );
}












