"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SiteLoaderConfig } from "@/lib/site-builder";
import SiteLoader from "@/components/site-loader";

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
type BookingUiStepKey = "scenario" | "location" | "service" | "specialist" | "datetime" | "details";
type BookingPersistedState = {
  scenario: Scenario;
  startScenario: boolean;
  locationId: number | null;
  serviceId: number | null;
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

const addMinutes = (time: string, minutes: number) => {
  const start = timeToMinutes(time);
  if (start === null) return "";
  return minutesToTime(start + minutes);
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || "Ошибка запроса";
    throw new Error(message);
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

const bookingStateStorageKey = (accountSlug?: string, accountPublicSlug?: string) =>
  `booking-state:v${BOOKING_STATE_VERSION}:${accountSlug || accountPublicSlug || "public"}`;

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
              "rounded-2xl border px-3 py-2 text-xs font-medium transition",
              "hover:-translate-y-[1px] hover:shadow-sm",
              active
                ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
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
// DatePickerLike (как на твоём примере) — БЕЗ ТЕНЕЙ, выбор — ?????? ОБВОДКА
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
}: {
  value: string; // YYYY-MM-DD (TZ account)
  onChange: (ymd: string) => void;
  timeZone: string;
  disabledBeforeYmd: string;
  availableDates: Set<string>;
  onViewMonthChange?: (monthStart: string) => void;
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
    if (!availableDates.has(ymd)) return true;
    return false;
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
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
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
}: {
  times: string[];
  selected: string | null;
  timeBucket: TimeBucket;
  onBucket: (b: TimeBucket) => void;
  onSelect: (time: string) => void;
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
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                "h-10 rounded-2xl border text-sm font-medium transition",
                !active && "booking-soft-accent-hover",
                "hover:-translate-y-[1px] hover:shadow-sm",
                active
                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)] hover:translate-y-0 hover:shadow-none"
                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs font-medium text-[color:var(--bp-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{value}</div>
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
  const restoredFromStorageRef = useRef(false);
  const [scenario, setScenario] = useState<Scenario>("dateFirst");
  const [startScenario, setStartScenario] = useState(false);
  const [initialParams, setInitialParams] = useState<{
    locationId: number | null;
    serviceId: number | null;
    specialistId: number | null;
    scenario: Scenario | null;
    startScenario: boolean;
  } | null>(null);
  const [initialParamsApplied, setInitialParamsApplied] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<number | null>(null);
  const [pendingSpecialistId, setPendingSpecialistId] = useState<number | null>(null);
  const [initialNavApplied, setInitialNavApplied] = useState(false);
  const [pendingStepKey, setPendingStepKey] = useState<BookingUiStepKey | null>(null);
  const isDateFirst = scenario === "dateFirst";
  const isServiceFirst = scenario === "serviceFirst";
  const isSpecialistFirst = scenario === "specialistFirst";

  const [context, setContext] = useState<ContextData | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<number | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [specialistsError, setSpecialistsError] = useState<string | null>(null);

  // specialistFirst: только специалиста с рабочими днями
  const [workdaySpecialistIds, setWorkdaySpecialistIds] = useState<Set<number> | null>(null);
  const [loadingWorkdaySpecs, setLoadingWorkdaySpecs] = useState(false);
  const [workdaySpecsError, setWorkdaySpecsError] = useState<string | null>(null);

  // dateFirst: витрина времени time -> serviceIds[]
  const [offersByTime, setOffersByTime] = useState<Record<string, number[]>>({});
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
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

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [specialistId, setSpecialistId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
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
    const specialistParam = Number(params.get("specialistId"));
    const startParam = params.get("start");
    const startScenarioValue = startParam === "scenario";

    setInitialParams({
      locationId: Number.isFinite(locationParam) ? locationParam : null,
      serviceId: Number.isFinite(serviceParam) ? serviceParam : null,
      specialistId: Number.isFinite(specialistParam) ? specialistParam : null,
      scenario: scenarioValue,
      startScenario: startScenarioValue,
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

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [loadingClientProfile, setLoadingClientProfile] = useState(false);
  const calendarKeyRef = useRef<string | null>(null);
  const fullscreenLoaderShownAtRef = useRef<number | null>(null);
  const [overlayNextDeadline, setOverlayNextDeadline] = useState<number | null>(null);

  const accountTz = context?.account.timeZone || "UTC";
  const slotStepMinutes = context?.account.slotStepMinutes ?? 15;
  const legalDocs = context?.legalDocuments ?? [];
  const platformLegalDocs = context?.platformLegalDocuments ?? [];
  const nowTz = useMemo(() => getNowInTimeZone(accountTz), [accountTz]);
  const todayYmdTz = nowTz.ymd;
  const effectiveInlineLoader =
    loaderConfig && loaderConfig.showBookingInline ? loaderConfig : null;

  const idempotencyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [
    locationId,
    serviceId,
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
      setScenario(initialParams.scenario);
    }
    if (initialParams.startScenario) {
      setStartScenario(true);
    }
    if (initialParams.locationId) {
      setLocationId(initialParams.locationId);
    }
    if (initialParams.serviceId) setPendingServiceId(initialParams.serviceId);
    if (initialParams.specialistId) setPendingSpecialistId(initialParams.specialistId);
    setInitialParamsApplied(true);
  }, [initialParams, initialParamsApplied, context?.locations]);

  useEffect(() => {
    if (!initialParamsApplied || restoredFromStorageRef.current) return;
    restoredFromStorageRef.current = true;

    const hasUrlState = Boolean(
      initialParams?.scenario ||
        initialParams?.locationId ||
        initialParams?.serviceId ||
        initialParams?.specialistId ||
        initialParams?.startScenario
    );
    if (hasUrlState) return;

    const persisted = persistedStateRef.current;
    if (!persisted) return;

    restoringFromStorageRef.current = true;
    setScenario(persisted.scenario);
    setStartScenario(Boolean(persisted.startScenario));
    setLocationId(persisted.locationId ?? null);
    setPendingServiceId(persisted.serviceId ?? null);
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
  }, [initialParamsApplied, initialParams]);

  useEffect(() => {
    if (!locationId || !context?.locations?.length) return;
    const exists = context.locations.some((item) => item.id === locationId);
    if (!exists) setLocationId(null);
  }, [locationId, context?.locations]);

  useEffect(() => {
    if (!pendingServiceId) return;
    if (services.some((service) => service.id === pendingServiceId)) {
      setServiceId(pendingServiceId);
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

  const steps = useMemo(() => {
    const common = [{ key: "location", title: "Локация" }];
    const dt = { key: "datetime", title: "Дата и время" };
    const details = { key: "details", title: "Контакты" };

    if (isDateFirst) {
      return [
        ...common,
        dt,
        { key: "service", title: "Услуга" },
        { key: "specialist", title: "Специалист" },
        details,
      ];
    }
    if (isServiceFirst) {
      return [
        ...common,
        { key: "service", title: "Услуга" },
        dt,
        { key: "specialist", title: "Специалист" },
        details,
      ];
    }
    return [
      ...common,
      { key: "specialist", title: "Специалист" },
      { key: "service", title: "Услуга" },
      dt,
      details,
    ];
  }, [isDateFirst, isServiceFirst]);

  const stepsWithScenario = startScenario
    ? [{ key: "scenario", title: "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0439" }, ...steps]
    : steps;

  const [stepIndex, setStepIndex] = useState(0);
  const currentStepKey = stepsWithScenario[stepIndex]?.key;
  const shouldLoadServices =
    (isDateFirst &&
      (currentStepKey === "datetime" ||
        currentStepKey === "service" ||
        currentStepKey === "specialist" ||
        currentStepKey === "details")) ||
    (isServiceFirst &&
      (currentStepKey === "service" ||
        currentStepKey === "datetime" ||
        currentStepKey === "specialist" ||
        currentStepKey === "details")) ||
    (isSpecialistFirst &&
      (currentStepKey === "service" ||
        currentStepKey === "datetime" ||
        currentStepKey === "details"));
  const shouldLoadSpecialists =
    currentStepKey === "specialist" || currentStepKey === "details";
  const shouldLoadCalendar =
    !isDateFirst && (currentStepKey === "datetime" || currentStepKey === "details");
  const shouldLoadDateFirstAvailability =
    isDateFirst &&
    (currentStepKey === "datetime" ||
      currentStepKey === "service" ||
      currentStepKey === "specialist" ||
      currentStepKey === "details");
  const shouldLoadDateFirstServiceSlots =
    isDateFirst && (currentStepKey === "specialist" || currentStepKey === "details");

  const gotoKey = (key: string) => {
    const idx = stepsWithScenario.findIndex((s) => s.key === key);
    if (idx >= 0) setStepIndex(idx);
  };

  useEffect(() => {
    if (!pendingStepKey) return;
    const idx = stepsWithScenario.findIndex((s) => s.key === pendingStepKey);
    if (idx >= 0) setStepIndex(idx);
    setPendingStepKey(null);
  }, [pendingStepKey, stepsWithScenario]);

  // Auto-advance is disabled: переходы только по кнопке "Далее".

  // ---------- resets
  useEffect(() => {
    if (skipScenarioResetOnceRef.current) {
      skipScenarioResetOnceRef.current = false;
      return;
    }
    if (restoringFromStorageRef.current) return;
    setServiceId(null);
    setSpecialistId(null);
    setTimeChoice(null);
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
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
    setSpecialistId(null);
    setTimeChoice(null);
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
    setWorkdaySpecialistIds(null);
    setWorkdaySpecsError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    setStepIndex(0);
  }, [locationId]);

  useEffect(() => {
    setTimeChoice(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    if (isDateFirst) setOffersByTime({});
  }, [dateYmd, isDateFirst]);

  useEffect(() => {
    // ✅ Р’ dateFirst время выбрано раньше — его НЕ сбрасываем при выборе услуги
    if (isDateFirst) return;

    // ✅ Для serviceFirst/specialistFirst смена услуги меняет доступность времени
    setTimeChoice(null);

    setSubmitError(null);
    setSubmitSuccess(false);

    // serviceFirst: специалист выбирается после времени, поэтому при смене услуги лучше сбросить специалиста
    if (isServiceFirst) setSpecialistId(null);
  }, [serviceId, isDateFirst, isServiceFirst]);

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

    fetch(url)
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
        if (!next && data?.user?.email) {
          next = {
            firstName: null,
            lastName: null,
            phone: null,
            email: data.user.email,
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
      setSpecialistsError(null);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setSpecialists([]);
      return;
    }

    let mounted = true;
    setLoadingSpecialists(true);
    setSpecialistsError(null);

    fetchJson<SpecialistsData>(
      buildUrl(`/api/v1/public/booking/locations/${safeLocationId}/specialists`, {
        serviceId: serviceId ?? "",
        account: accountSlug ?? "",
      })
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
      });

    return () => {
      mounted = false;
    };
  }, [locationId, accountSlug, serviceId, shouldLoadSpecialists]);

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
        setServices(Array.isArray(data.services) ? data.services : []);
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
    const calendarKey = [
      isDateFirst ? "date" : "other",
      isServiceFirst ? "service" : "",
      isSpecialistFirst ? "specialist" : "",
      safeLocationId,
      serviceId ?? "",
      isSpecialistFirst ? specialistId ?? "" : "",
      accountSlug ?? "",
      debouncedCalendarQueryStartYmd,
      calendarQueryDays,
      currentStepKey ?? "",
    ].join("|");

    if (calendarKeyRef.current === calendarKey) return;
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

    if (isServiceFirst && !serviceId) {
      setCalendar(null);
      return;
    }
    if (isSpecialistFirst && (!serviceId || !specialistId)) {
      setCalendar(null);
      return;
    }

    let mounted = true;
    setLoadingCalendar(true);
    setCalendarError(null);

    fetchJson<AvailabilityCalendar>(
      buildUrl("/api/v1/public/booking/availability/calendar", {
        locationId: safeLocationId,
        serviceId: serviceId ?? "",
        specialistId: isSpecialistFirst ? specialistId ?? "" : "",
        start: debouncedCalendarQueryStartYmd,
        days: calendarQueryDays,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;

        const cleanedDays = (data?.days ?? [])
          .filter((d) => !isPastYmd(d.date, todayYmdTz))
          .map((d) => ({
            ...d,
            times: (d.times ?? []).filter((x) => !isPastTimeOnDate(d.date, x.time, nowTz)),
          }))
          .filter((d) => d.times.length > 0);

        const next: AvailabilityCalendar = { start: data?.start ?? todayYmdTz, days: cleanedDays };
        setCalendar(next);

        const availableDates = new Set(next.days.map((d) => d.date));
        if (
          next.days.length > 0 &&
          (!dateYmd || isPastYmd(dateYmd, todayYmdTz) || !availableDates.has(dateYmd))
        ) {
          const first = next.days[0]?.date ?? todayYmdTz;
          setDateYmd(first);
        }
      })
      .catch((e: Error) => {
        if (!mounted) return;
        setCalendarError(e.message);
        setCalendar(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingCalendar(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    isDateFirst,
    isServiceFirst,
    isSpecialistFirst,
    locationId,
    serviceId,
    specialistId,
    accountSlug,
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
      return;
    }
    if (!dateYmd || isPastYmd(dateYmd, todayYmdTz)) {
      setOffersByTime({});
      return;
    }
    if (!services.length) {
      setOffersByTime({});
      return;
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
      } catch (e: any) {
        if (!mounted) return;
        setOffersError(e?.message || "Ошибка загрузки времени");
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
    todayYmdTz,
    nowTz,
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
      return;
    }
    if (!services.length) {
      setDateFirstAvailableDates(new Set());
      setDateFirstAvailabilityError(null);
      return;
    }

    let mounted = true;
    setLoadingDateFirstAvailability(true);
    setDateFirstAvailabilityError(null);

    const tasks = services.map((s) => () =>
      fetchJson<AvailabilityCalendar>(
        buildUrl("/api/v1/public/booking/availability/calendar", {
          locationId: safeLocationId,
          serviceId: s.id,
          start: debouncedCalendarQueryStartYmd,
          days: calendarQueryDays,
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
      } catch (e: any) {
        if (!mounted) return;
        setDateFirstAvailableDates(new Set());
        setDateFirstAvailabilityError(e?.message || "Failed to load available dates.");
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
    debouncedCalendarQueryStartYmd,
    calendarQueryDays,
  ]);

  useEffect(() => {
    if (!isDateFirst) return;
    if (!dateFirstAvailableDates.size) return;
    if (!dateYmd || isPastYmd(dateYmd, todayYmdTz) || !dateFirstAvailableDates.has(dateYmd)) {
      const first = Array.from(dateFirstAvailableDates).sort((a, b) =>
        a > b ? 1 : a < b ? -1 : 0
      )[0];
      if (first) setDateYmd(first);
    }
  }, [isDateFirst, dateFirstAvailableDates, dateYmd, todayYmdTz]);

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
    if (!serviceId || !dateYmd || !timeChoice) {
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

    fetchJson<SlotsData>(
      buildUrl("/api/v1/public/booking/slots", {
        locationId: safeLocationId,
        date: dateYmd,
        serviceId,
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
    accountSlug,
    todayYmdTz,
    nowTz,
  ]);

  // ---------- derived selections
  const selectedLocation = useMemo(
    () => context?.locations.find((item) => item.id === locationId) ?? null,
    [context, locationId]
  );

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [services, serviceId]
  );

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
    if (serviceId && servicesForSpecialistFirst.some((s) => s.id === serviceId)) return;
    setServiceId(null);
    setTimeChoice(null);
    setCalendar(null);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [isSpecialistFirst, specialistId, serviceId, servicesForSpecialistFirst, loadingServices]);

  const servicesThatFitPickedTime = useMemo(() => {
    if (!isDateFirst) return services;
    if (!timeChoice) return [];
    const allowedIds = new Set<number>(offersByTime[timeChoice] ?? []);
    return services.filter((s) => allowedIds.has(s.id));
  }, [isDateFirst, services, timeChoice, offersByTime]);

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

  const availableTimesForCurrentStep = useMemo(() => {
    if (!dateYmd || isPastYmd(dateYmd, todayYmdTz)) return [];

    if (isDateFirst) {
      const times = uniqSortedTimes(Object.keys(offersByTime));
      return filterPastTimes(dateYmd, times, nowTz);
    }

    const dayMap = calendarByDate.get(dateYmd);
    const times = dayMap ? Array.from(dayMap.keys()) : [];
    const sorted = uniqSortedTimes(times);
    return filterPastTimes(dateYmd, sorted, nowTz);
  }, [isDateFirst, dateYmd, offersByTime, calendarByDate, todayYmdTz, nowTz]);

  const isCalendarWindowTransitioning = !isDateFirst && loadingCalendar;
  const isTimesPanelLoading = isDateFirst
    ? loadingOffers || (loadingDateFirstAvailability && dateFirstAvailableDates.size === 0)
    : isCalendarWindowTransitioning && availableTimesForCurrentStep.length === 0;
  const isStepLoadingOverlay =
    (currentStepKey === "location" && loadingContext) ||
    (currentStepKey === "service" && loadingServices) ||
    (currentStepKey === "specialist" &&
      (loadingSpecialists || loadingWorkdaySpecs || loadingDateFirstServiceSlots)) ||
    (currentStepKey === "datetime" && isTimesPanelLoading);
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

  const specialistsForSpecialistStep = useMemo(() => {
    if (isSpecialistFirst) {
      const set = workdaySpecialistIds;
      if (!set) return specialists;
      return specialists.filter((s) => set.has(s.id));
    }

    if (!serviceId || !dateYmd || !timeChoice) return [];

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
    isDateFirst,
    specialists,
    workdaySpecialistIds,
    serviceId,
    dateYmd,
    timeChoice,
    dateFirstServiceSlots,
    calendarByDate,
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

  const showFromServiceMetrics = !specialistId && (isServiceFirst || isDateFirst);

  const serviceDuration =
    selectedService == null
      ? null
      : showFromServiceMetrics
        ? selectedService.minDurationMin ?? selectedService.baseDurationMin ?? null
        : selectedService.computedDurationMin ?? selectedService.baseDurationMin ?? null;

  const servicePrice =
    selectedService == null
      ? null
      : showFromServiceMetrics
        ? selectedService.minPrice ?? selectedService.basePrice ?? null
        : selectedService.computedPrice ?? selectedService.basePrice ?? null;
  const servicePriceLabel =
    servicePrice != null
      ? `${showFromServiceMetrics ? "от " : ""}${formatMoneyRub(servicePrice)}`
      : "—";
  const serviceDurationLabel =
    serviceDuration != null ? `${showFromServiceMetrics ? "от " : ""}${serviceDuration} мин` : "—";
  const summaryDateLabel = formatDateRu(dateYmd);

  const slotEnd = useMemo(() => {
    if (!timeChoice || !serviceDuration) return "";
    return addMinutes(timeChoice, serviceDuration);
  }, [timeChoice, serviceDuration]);

  const canSubmit = useMemo(() => {
    const requiredLegalIds = legalDocs
      .filter((doc) => doc.isRequired)
      .map((doc) => doc.versionId);
    const legalOk =
      requiredLegalIds.length === 0 ||
      requiredLegalIds.every((id) => legalConsents[id]);

    return (
      clientName.trim().length >= 2 &&
      clientPhone.trim().length >= 8 &&
      !!locationId &&
      !!serviceId &&
      !!specialistId &&
      !!timeChoice &&
      legalOk
    );
  }, [
    legalDocs,
    legalConsents,
    clientName,
    clientPhone,
    locationId,
    serviceId,
    specialistId,
    timeChoice,
  ]);

  const canNext = useMemo(() => {
    switch (currentStepKey) {
      case "scenario":
        return true;
      case "location":
        return !!locationId;
      case "datetime":
        return !!timeChoice;
      case "service":
        return !!serviceId;
      case "specialist":
        return !!specialistId;
      case "details":
        return canSubmit;
      default:
        return true;
    }
  }, [
    currentStepKey,
    canSubmit,
    locationId,
    serviceId,
    specialistId,
    timeChoice,
  ]);

  const goNext = () => {
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
      startScenario,
      locationId,
      serviceId,
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

  const resetAll = () => {
    const defaults = getContactDefaults();
    setServiceId(null);
    setSpecialistId(null);
    setTimeChoice(null);
    setClientName(defaults.name);
    setClientPhone(defaults.phone);
    setClientEmail(defaults.email);
    setComment("");
    setLegalConsents({});
    setSubmitError(null);
    setSubmitSuccess(false);
    setDateYmd(todayYmdTz);
    setTimeBucket("all");
    setQuery("");
    setOffersByTime({});
    setDateFirstAvailableDates(new Set());
    setCalendar(null);
    setStepIndex(0);
  };

  const submitAppointment = async () => {
    if (!canSubmit) {
      setSubmitError("Fill required fields and accept required agreements.");
      return;
    }
    if (isPastYmd(dateYmd, todayYmdTz) || isPastTimeOnDate(dateYmd, timeChoice!, nowTz)) {
      setSubmitError("Choose a valid date and time.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const hold = await fetchJson<{ holdId: number; expiresAt: string }>(
        buildUrl("/api/v1/public/booking/holds", { account: accountSlug ?? "" }),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locationId,
            specialistId,
            serviceId,
            date: dateYmd,
            time: timeChoice,
          }),
        }
      );

      await fetchJson<{ appointmentId: number }>(
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
            date: dateYmd,
            time: timeChoice,
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            clientEmail: clientEmail.trim() || undefined,
            comment: comment.trim() || undefined,
            holdId: hold.holdId,
            legalVersionIds: Object.entries(legalConsents)
              .filter(([, checked]) => checked)
              .map(([id]) => Number(id)),
          }),
        }
      );
      setSubmitSuccess(true);
      idempotencyKeyRef.current = null;
    } catch (error) {
      setSubmitError((error as Error).message);
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
                  <div className="flex w-full flex-wrap gap-1 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-1">
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
                            "grid gap-3",
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

                                  <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-base font-semibold leading-snug">{location.name}</div>
                                      <div className="mt-1 line-clamp-2 text-sm text-[color:var(--bp-muted)]">
                                        {location.address || "Адрес не указан"}
                                      </div>
                                      <div
                                        className={cn(
                                          "mt-1 text-xs text-[color:var(--bp-muted)]"
                                        )}
                                      >
                                        {openStatus.label}
                                      </div>
                                    </div>
                                    <div
                                      className={cn(
                                        "shrink-0 rounded-2xl border px-2 py-1 text-xs",
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
                      availableDates={
                        isDateFirst ? dateFirstAvailableDates : calendarAvailableDates
                      }
                      onViewMonthChange={(monthStart) => {
                        setCalendarViewMonthStart((prev) =>
                          prev === monthStart ? prev : monthStart
                        );
                      }}
                      onChange={(ymd) => {
                        if (isPastYmd(ymd, todayYmdTz)) return;
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

                    {((isDateFirst) ||
                      (isServiceFirst && !!serviceId) ||
                      (isSpecialistFirst && !!specialistId && !!serviceId)) && (
                      <div className="space-y-3">
                        {showNoSlotsNotice && (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
                            Нет доступных слотов на выбранную дату.
                          </div>
                        )}

                        {!isTimesPanelLoading && availableTimesForCurrentStep.length > 0 && (
                          <TimeGrid
                            times={availableTimesForCurrentStep}
                            selected={timeChoice}
                            timeBucket={timeBucket}
                            onBucket={setTimeBucket}
                            onSelect={(t) => {
                              if (isPastTimeOnDate(dateYmd, t, nowTz)) return;
                              setTimeChoice(t);
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
                        className="h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm sm:w-[280px] sm:flex-none"
                      />
                    </div>

                    {servicesError && <div className="text-sm text-red-600">{servicesError}</div>}

                    {!loadingServices && !servicesError && (
                      <div className="grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(var(--bp-cards-cols,2),minmax(0,1fr))]">
                        {servicesForServiceStep.map((service) => {
                          const price = showFromServiceMetrics
                            ? service.minPrice ?? service.basePrice ?? 0
                            : service.computedPrice ?? service.basePrice ?? 0;
                          const duration = showFromServiceMetrics
                            ? service.minDurationMin ?? service.baseDurationMin ?? 0
                            : service.computedDurationMin ?? service.baseDurationMin ?? 0;
                          const active = service.id === serviceId;
                          const serviceProfileHref = accountPublicSlug
                            ? `/${accountPublicSlug}/services/${service.id}`
                            : "#";

                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => setServiceId(service.id)}
                              className={cn(
                                "rounded-3xl border p-4 text-left transition",
                                "hover:-translate-y-[1px] hover:shadow-sm",
                                active
                                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                              )}
                            >
                              <div className="space-y-3">
                                <div className="relative">
                                  {service.coverUrl ? (
                                    <div className="aspect-video overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                                      <img
                                        src={service.coverUrl}
                                        alt={service.name}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex aspect-video items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
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

                                <div className="flex items-end justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-base font-semibold">{service.name}</div>
                                    <div className="mt-1 text-sm font-semibold">
                                      {showFromServiceMetrics
                                        ? `от ${formatMoneyRub(price)}`
                                        : formatMoneyRub(price)}
                                    </div>
                                    <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                                      {showFromServiceMetrics ? `от ${duration} мин` : `${duration} мин`}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div
                                      className={cn(
                                        "rounded-2xl border px-2 py-1 text-xs",
                                        active
                                          ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-[color:var(--bp-button-text)]"
                                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                      )}
                                    >
                                      {active ? "Выбрано" : "Выбрать"}
                                    </div>
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
                        {!serviceId || !timeChoice ? (
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
                      (isSpecialistFirst || (!isSpecialistFirst && !!serviceId && !!timeChoice)) &&
                      (!isDateFirst || (!loadingDateFirstServiceSlots && !!serviceId && !!timeChoice)) && (
                        <div className="grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(var(--bp-cards-cols,2),minmax(0,1fr))]">
                          {specialistsForSpecialistStepFiltered.map((sp) => {
                            const active = sp.id === specialistId;
                            const specialistProfileHref = accountPublicSlug
                              ? `/${accountPublicSlug}/specialists/${sp.id}`
                              : "#";
                            const specialistServiceDuration =
                              sp.serviceDurationMin ??
                              selectedService?.computedDurationMin ??
                              selectedService?.baseDurationMin ??
                              null;
                            const specialistServicePrice =
                              sp.servicePrice ??
                              selectedService?.computedPrice ??
                              selectedService?.basePrice ??
                              null;
                            return (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => setSpecialistId(sp.id)}
                                className={cn(
                                  "rounded-3xl border p-4 text-left transition",
                                  "hover:-translate-y-[1px] hover:shadow-sm",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                                )}
                              >
                                <div className="flex flex-col gap-3">
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

                                  <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-base font-semibold">{sp.name}</div>
                                      <div className="mt-1 line-clamp-1 text-sm text-[color:var(--bp-muted)]">
                                        {sp.role || "Специалист"}
                                      </div>
                                      {selectedService && (
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
                                        "shrink-0 rounded-2xl border px-2 py-1 text-xs",
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

                {currentStepKey === "details" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <SoftPanel className="p-4">
                        <div className="text-sm font-semibold">Контакты</div>
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="text-xs font-medium text-[color:var(--bp-muted)]">Имя</div>
                            <input
                              value={clientName}
                              onChange={(event) => setClientName(event.target.value)}
                              className="mt-2 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm"
                              placeholder="Например, Виталя"
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
                      </SoftPanel>

                      {false && (
                      <SoftPanel className="p-4">
                        <div className="text-sm font-semibold">Подтверждение</div>
                        <div className="mt-3 space-y-3">
                          <SummaryRow label="Локация" value={selectedLocation?.name || "—"} />
                          <SummaryRow label="Услуга" value={selectedService?.name || "—"} />
                          <SummaryRow label="Специалист" value={selectedSpecialist?.name || "—"} />
                          <SummaryRow label="Дата" value={summaryDateLabel} />
                          <SummaryRow
                            label="Время"
                            value={timeChoice ? `${timeChoice}${slotEnd ? ` – ${slotEnd}` : ""}` : "—"}
                          />
                          <SummaryRow
                            label="Стоимость"
                            value={servicePriceLabel}
                          />
                          <SummaryRow label="Длительность" value={serviceDurationLabel} />

                          {submitError && (
                            <div className="rounded-3xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                              {submitError}
                            </div>
                          )}
                          {submitSuccess && (
                            <div className="rounded-3xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                              Запись создана. Мы скоро свяжемся с вами.
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={submitAppointment}
                            disabled={!canSubmit || submitting}
                            className="h-11 w-full rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--bp-button-text)] transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
                          >
                            {submitting ? "Сохранение..." : "Записаться"}
                          </button>
                        </div>
                      </SoftPanel>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SoftPanel>

          <SoftPanel className="min-w-0 p-4 sm:p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:flex lg:h-full lg:flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Сводка</div>
            </div>

            <div className="mt-4 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin] [scrollbar-color:var(--bp-accent)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--bp-accent)]">
              <SummaryRow label="Локация" value={selectedLocation?.name || "—"} />
              <SummaryRow label="Услуга" value={selectedService?.name || "—"} />
              <SummaryRow label="Специалист" value={selectedSpecialist?.name || "—"} />
              <SummaryRow label="Дата" value={summaryDateLabel} />
              <SummaryRow label="Время" value={timeChoice || "—"} />
              <SummaryRow label="Стоимость" value={servicePriceLabel} />
              <SummaryRow label="Длительность" value={serviceDurationLabel} />

              {submitError && (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="px-1 text-sm font-medium text-[color:var(--bp-ink)]">
                  Запись оформлена
                </div>
              )}

              <div className="mt-4 flex justify-start">
                <button
                  type="button"
                  onClick={submitSuccess ? resetAll : submitAppointment}
                  disabled={submitSuccess ? submitting : !canSubmit || submitting}
                  className="w-full max-w-[260px] rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-button-text)] transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40 sm:max-w-[280px] lg:max-w-[320px]"
                >
                  {submitting ? "Сохранение..." : submitSuccess ? "Новая запись" : "Записаться"}
                </button>
              </div>
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








