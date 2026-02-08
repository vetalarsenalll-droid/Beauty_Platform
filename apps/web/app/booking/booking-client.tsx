"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type BookingClientProps = {
  accountSlug?: string;
  accountPublicSlug?: string;
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
};

type Service = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: number;
  computedDurationMin?: number | null;
  computedPrice?: number | null;
  specialistIds?: number[];
};

type Specialist = {
  id: number;
  name: string;
  role: string | null;
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
        "rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]",
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
    { key: "dateFirst", label: "Дата/время" },
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
                ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-white"
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
// DatePickerLike (как на твоём примере) — БЕЗ ТЕНЕЙ, выбор — ЧЕРНАЯ ОБВОДКА
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
}: {
  value: string; // YYYY-MM-DD (TZ account)
  onChange: (ymd: string) => void;
  timeZone: string;
  disabledBeforeYmd: string;
  availableDates?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);


  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [viewMonth1, setViewMonth1] = useState(() => Number(value.slice(5, 7)));

  useEffect(() => {
    // синхронизируем хедер с выбранной датой
    setViewYear(Number(value.slice(0, 4)));
    setViewMonth1(Number(value.slice(5, 7)));
  }, [value]);

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
    if (availableDates && !availableDates.has(ymd)) return true;
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
          "relative h-9 rounded-full text-[14px] font-medium transition",
          "focus:outline-none focus:ring-2 focus:ring-black/30",
          selected
            ? "border-2 border-black bg-transparent text-[color:var(--bp-ink)]"
            : "border border-transparent bg-transparent hover:bg-black/5",
          inMonth ? "text-[color:var(--bp-ink)]" : "text-[color:var(--bp-muted)] opacity-60",
          disabled && "opacity-30 hover:bg-transparent"
        )}
      >
        {dayNum}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[520px] rounded-[18px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-[12px]",
            "border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2",
            "transition hover:-translate-y-[1px]",
            "focus:outline-none focus:ring-2 focus:ring-black/30"
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
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              "bg-transparent transition hover:bg-black/5",
              "focus:outline-none focus:ring-2 focus:ring-black/30"
            )}
            aria-label={expanded ? "Предыдущий месяц" : "Предыдущая неделя"}
          >
            <span className="text-[16px] leading-none text-[color:var(--bp-muted)]">‹</span>
          </button>

          <button
            type="button"
            onClick={goNext}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              "bg-transparent transition hover:bg-black/5",
              "focus:outline-none focus:ring-2 focus:ring-black/30"
            )}
            aria-label={expanded ? "Следующий месяц" : "Следующая неделя"}
          >
            <span className="text-[16px] leading-none text-[color:var(--bp-muted)]">›</span>
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
              active
                ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-white"
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
                "hover:-translate-y-[1px] hover:shadow-sm",
                active
                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-white"
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
}: BookingClientProps) {
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
  const [dateFirstAvailableDates, setDateFirstAvailableDates] = useState<
    Set<string> | undefined
  >(undefined);
  const [loadingDateFirstAvailability, setLoadingDateFirstAvailability] = useState(false);

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

  const [timeChoice, setTimeChoice] = useState<string | null>(null);

  const [timeBucket, setTimeBucket] = useState<TimeBucket>("all");
  const [query, setQuery] = useState("");

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

  const accountTz = context?.account.timeZone || "UTC";
  const slotStepMinutes = context?.account.slotStepMinutes ?? 15;
  const legalDocs = context?.legalDocuments ?? [];
  const platformLegalDocs = context?.platformLegalDocuments ?? [];
  const nowTz = useMemo(() => getNowInTimeZone(accountTz), [accountTz]);
  const todayYmdTz = nowTz.ymd;

  const idempotencyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [locationId, serviceId, specialistId, dateYmd, timeChoice, clientName, clientPhone, clientEmail, comment]);

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

  const gotoKey = (key: string) => {
    const idx = stepsWithScenario.findIndex((s) => s.key === key);
    if (idx >= 0) setStepIndex(idx);
  };

  // Auto-advance is disabled: переходы только по кнопке "Далее".

  // ---------- resets
  useEffect(() => {
    setServiceId(null);
    setSpecialistId(null);
    setTimeChoice(null);
    setOffersByTime({});
    setDateFirstAvailableDates(undefined);
    setCalendar(null);
    setWorkdaySpecialistIds(null);
    setWorkdaySpecsError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    setStepIndex(0);
  }, [scenario]);

  useEffect(() => {
    setServiceId(null);
    setSpecialistId(null);
    setTimeChoice(null);
    setOffersByTime({});
    setDateFirstAvailableDates(undefined);
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
    // ✅ В dateFirst время выбрано раньше — его НЕ сбрасываем при выборе услуги
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
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setSpecialists([]);
      return;
    }

    let mounted = true;
    setLoadingSpecialists(true);
    setSpecialistsError(null);

    fetchJson<SpecialistsData>(
      buildUrl(`/api/v1/public/booking/locations/${safeLocationId}/specialists`, {
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
  }, [locationId, accountSlug]);

  // ---------- specialistFirst: load “has workdays” specialist ids
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!isSpecialistFirst) {
      setWorkdaySpecialistIds(null);
      setWorkdaySpecsError(null);
      setLoadingWorkdaySpecs(false);
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
  }, [isSpecialistFirst, locationId, accountSlug, todayYmdTz]);

  // ---------- services
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setServices([]);
      return;
    }

    let mounted = true;
    setLoadingServices(true);
    setServicesError(null);

    // specialistFirst: computedPrice/duration под выбранного специалиста
    const specialistForPricing = isSpecialistFirst && specialistId ? specialistId : null;

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
  }, [locationId, accountSlug, isSpecialistFirst, specialistId]);

  // ---------- serviceFirst/specialistFirst: availability calendar
  useEffect(() => {
    const safeLocationId = Number(locationId);
    const calendarKey = [
      isDateFirst ? "date" : "other",
      isServiceFirst ? "service" : "",
      isSpecialistFirst ? "specialist" : "",
      safeLocationId,
      serviceId ?? "",
      isSpecialistFirst ? specialistId ?? "" : "",
      accountSlug ?? "",
      todayYmdTz,
      nowTz.minutes,
    ].join("|");

    if (calendarKeyRef.current === calendarKey) return;
    calendarKeyRef.current = calendarKey;

    setCalendar(null);
    setCalendarError(null);

    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) return;
    if (isDateFirst) return;

    if (isServiceFirst && !serviceId) return;
    if (isSpecialistFirst && (!serviceId || !specialistId)) return;

    let mounted = true;
    setLoadingCalendar(true);
    setCalendarError(null);

    fetchJson<AvailabilityCalendar>(
      buildUrl("/api/v1/public/booking/availability/calendar", {
        locationId: safeLocationId,
        serviceId: serviceId ?? "",
        specialistId: isSpecialistFirst ? specialistId ?? "" : "",
        start: todayYmdTz,
        days: 14,
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
        if (!availableDates.has(dateYmd)) {
          if (!dateYmd || isPastYmd(dateYmd, todayYmdTz)) {
            const first = next.days[0]?.date ?? todayYmdTz;
            setDateYmd(first);
          }
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
  ]);

  // ---------- dateFirst: offersByTime (time -> serviceIds)
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!isDateFirst) {
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
  }, [isDateFirst, locationId, dateYmd, services, accountSlug, todayYmdTz, nowTz]);

  // ---------- dateFirst: available dates (any service) for next 31 days
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!isDateFirst) {
      setDateFirstAvailableDates(undefined);
      setLoadingDateFirstAvailability(false);
      return;
    }
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setDateFirstAvailableDates(undefined);
      return;
    }
    if (!services.length) {
      setDateFirstAvailableDates(undefined);
      return;
    }

    let mounted = true;
    setDateFirstAvailableDates(new Set());
    setLoadingDateFirstAvailability(true);

    const tasks = services.map((s) => () =>
      fetchJson<AvailabilityCalendar>(
        buildUrl("/api/v1/public/booking/availability/calendar", {
          locationId: safeLocationId,
          serviceId: s.id,
          start: todayYmdTz,
          days: 31,
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
      } finally {
        if (!mounted) return;
        setLoadingDateFirstAvailability(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isDateFirst, locationId, services, accountSlug, todayYmdTz]);

  // ---------- dateFirst: slots by chosen service to filter specialists by timeChoice
  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!isDateFirst) {
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
  }, [isDateFirst, locationId, dateYmd, timeChoice, serviceId, accountSlug, todayYmdTz, nowTz]);

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

  const filteredServices = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return services;
    return services.filter((service) => {
      const haystack = `${service.name} ${service.description ?? ""}`.toLowerCase();
      return haystack.includes(value);
    });
  }, [services, query]);

  // specialistFirst: services of chosen specialist
  const servicesForSpecialistFirst = useMemo(() => {
    if (!isSpecialistFirst) return filteredServices;
    if (!specialistId) return [];
    return filteredServices.filter((s) =>
      Array.isArray(s.specialistIds) ? s.specialistIds.includes(specialistId) : true
    );
  }, [isSpecialistFirst, filteredServices, specialistId]);

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

  // dateFirst: only services that fit chosen time
  const servicesThatFitPickedTime = useMemo(() => {
    if (!isDateFirst) return filteredServices;
    if (!timeChoice) return [];
    const allowedIds = new Set<number>(offersByTime[timeChoice] ?? []);
    return filteredServices.filter((s) => allowedIds.has(s.id));
  }, [isDateFirst, filteredServices, timeChoice, offersByTime]);

  const servicesForServiceStep = useMemo(() => {
    if (isDateFirst) return servicesThatFitPickedTime;
    if (isSpecialistFirst) return servicesForSpecialistFirst;
    return filteredServices;
  }, [isDateFirst, isSpecialistFirst, servicesThatFitPickedTime, servicesForSpecialistFirst, filteredServices]);

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
    if (!calendar) return undefined;
    return new Set(calendar.days.map((d) => d.date));
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

  const serviceDuration =
    selectedService?.computedDurationMin ?? selectedService?.baseDurationMin ?? null;

  const servicePrice =
    selectedService?.computedPrice ?? selectedService?.basePrice ?? null;

  const slotEnd = useMemo(() => {
    if (!timeChoice || !serviceDuration) return "";
    return addMinutes(timeChoice, serviceDuration);
  }, [timeChoice, serviceDuration]);

  const canNext = useMemo(() => {
    const requiredLegalIds = legalDocs
      .filter((doc) => doc.isRequired)
      .map((doc) => doc.versionId);
    const legalOk =
      requiredLegalIds.length === 0 ||
      requiredLegalIds.every((id) => legalConsents[id]);

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
        return (
          clientName.trim().length >= 2 &&
          clientPhone.trim().length >= 8 &&
          !!locationId &&
          !!serviceId &&
          !!specialistId &&
          !!timeChoice &&
          legalOk
        );
      default:
        return true;
    }
  }, [
    legalDocs,
    legalConsents,
    clientName,
    clientPhone,
    currentStepKey,
    locationId,
    serviceId,
    specialistId,
    timeChoice,
  ]);

  const goNext = () => setStepIndex((v) => Math.min(stepsWithScenario.length - 1, v + 1));
  const goPrev = () => setStepIndex((v) => Math.max(0, v - 1));

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
    setDateFirstAvailableDates(undefined);
    setCalendar(null);
    setStepIndex(0);
  };

  const submitAppointment = async () => {
    if (!locationId || !serviceId || !specialistId || !timeChoice) return;
    if (isPastYmd(dateYmd, todayYmdTz)) return;
    if (isPastTimeOnDate(dateYmd, timeChoice, nowTz)) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
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
  const clientDisplayName = clientProfile
    ? `${clientProfile.firstName ?? ""} ${clientProfile.lastName ?? ""}`.trim() ||
      clientProfile.phone ||
      clientProfile.email ||
      "Клиент"
    : null;
  const clientHref = clientProfile
    ? accountSlug
      ? `/c?account=${accountSlug}`
      : "/c"
    : accountSlug
      ? `/c/login?account=${accountSlug}`
      : "/c/login";

  return (
    <div className="min-h-dvh w-full bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]">
      <div className="mx-auto w-full max-w-5xl p-3 sm:p-6">
        <div className="h-0" />

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.55fr_0.95fr]">
          <SoftPanel className="p-4 lg:col-span-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex w-full items-center gap-3 lg:w-1/2">
                <a
                  href={clientHref}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-sm font-semibold"
                  aria-label={
                    clientProfile
                      ? "\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442"
                      : "\u0412\u0445\u043e\u0434"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-[color:var(--bp-muted)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </a>
                <div className="min-w-0">
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {clientProfile ? "\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442" : "\u0412\u0445\u043e\u0434"}
                  </div>
                  <div className="min-h-[1.25rem] truncate text-sm font-semibold">
                    {!loadingClientProfile ? clientDisplayName ?? "\u0412\u0445\u043e\u0434" : null}
                  </div>
                </div>
              </div>
              <div className="w-full space-y-3 lg:w-1/2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "dateFirst", label: "Дата/время" },
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
                          "rounded-2xl border px-3 py-2 text-left text-sm font-medium transition",
                          "hover:-translate-y-[1px] hover:shadow-sm",
                          active
                            ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                            : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <ProgressBar value={progress} />

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    Шаг {stepIndex + 1} из {stepsWithScenario.length}
                  </div>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-xs transition hover:-translate-y-[1px] hover:shadow-sm"
                  >
                    Сбросить
                  </button>
                </div>
              </div>
            </div>
          </SoftPanel>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_0.95fr]">
          <SoftPanel className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-[color:var(--bp-muted)]">
                  Шаг {stepIndex + 1} из {stepsWithScenario.length}
                </div>
                <div className="text-lg font-semibold">
                  {stepsWithScenario[stepIndex]?.title}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-xs transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
                >
                  Назад
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canNext || stepIndex === stepsWithScenario.length - 1}
                  className="rounded-2xl bg-[color:var(--bp-accent)] px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
                >
                  Дальше
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-[color:var(--bp-stroke)] pt-4">
              <div className="min-h-[620px]">
                {currentStepKey === "scenario" && (
                  <div className="space-y-3">
                    <ScenarioTabs value={scenario} onChange={setScenario} />
                  </div>
                )}
                {currentStepKey === "location" && (
                  <div className="space-y-3">
                    {loadingContext && <div className="text-sm">Загрузка локаций...</div>}
                    {contextError && <div className="text-sm text-red-600">{contextError}</div>}

                    {!loadingContext && !contextError && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {context?.locations.map((location) => {
                            const active = location.id === locationId;
                            return (
                              <button
                                key={location.id}
                                type="button"
                                onClick={() => setLocationId(location.id)}
                                className={cn(
                                  "rounded-3xl border p-4 text-left transition",
                                  "hover:-translate-y-[1px] hover:shadow-sm",
                                  active
                                    ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-base font-semibold">{location.name}</div>
                                    <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                                      {location.address || "Адрес не указан"}
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      "rounded-2xl border px-2 py-1 text-xs",
                                      active
                                        ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-white"
                                        : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                    )}
                                  >
                                    {active ? "Выбрано" : "Открыто"}
                                  </div>
                                </div>

                                <div className="mt-3 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3 text-xs text-[color:var(--bp-muted)]">
                                  Мини-карта (заглушка) · {location.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStepKey === "datetime" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div />
                      <div className="text-xs text-[color:var(--bp-muted)]">
                        {prettyDayYmd(dateYmd, todayYmdTz)}
                      </div>
                    </div>

                    {/* ✅ Новый календарь как на примере (без теней, выбор — черная обводка) */}
                    <DatePickerLike
                      value={dateYmd}
                      timeZone={accountTz}
                      disabledBeforeYmd={todayYmdTz}
                      availableDates={
                        isDateFirst ? dateFirstAvailableDates : calendarAvailableDates
                      }
                      onChange={(ymd) => {
                        if (isPastYmd(ymd, todayYmdTz)) return;
                        setDateYmd(ymd);
                      }}
                    />

                    {isDateFirst && (
                      <>
                        {loadingOffers && <div className="text-sm">Загрузка времени...</div>}
                        {offersError && <div className="text-sm text-red-600">{offersError}</div>}
                      </>
                    )}

                    {!isDateFirst && (
                      <>
                        {loadingCalendar && <div className="text-sm">Загрузка дней и времени...</div>}
                        {calendarError && <div className="text-sm text-red-600">{calendarError}</div>}
                      </>
                    )}

                    {((isDateFirst) ||
                      (isServiceFirst && !!serviceId) ||
                      (isSpecialistFirst && !!specialistId && !!serviceId)) && (
                      <div className="space-y-3">
                        {!loadingOffers && !loadingCalendar && availableTimesForCurrentStep.length === 0 && (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
                            Нет доступных слотов на выбранную дату.
                          </div>
                        )}

                        {!loadingOffers && !loadingCalendar && availableTimesForCurrentStep.length > 0 && (
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск услуги"
                        className="h-10 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 text-sm sm:w-[280px]"
                      />
                    </div>

                    {loadingServices && <div className="text-sm">Загрузка...</div>}
                    {servicesError && <div className="text-sm text-red-600">{servicesError}</div>}

                    {!loadingServices && !servicesError && (
                      <div className="space-y-2">
                        {servicesForServiceStep.map((service) => {
                          const price = service.computedPrice ?? service.basePrice ?? 0;
                          const duration = service.computedDurationMin ?? service.baseDurationMin ?? 0;
                          const active = service.id === serviceId;

                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => setServiceId(service.id)}
                              className={cn(
                                "w-full rounded-3xl border p-4 text-left transition",
                                "hover:-translate-y-[1px] hover:shadow-sm",
                                active
                                  ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel-strong)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-base font-semibold">{service.name}</div>
                                  {service.description && (
                                    <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                                      {service.description}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-sm font-semibold">{formatMoneyRub(price)}</div>
                                  <div className="text-xs text-[color:var(--bp-muted)]">{duration} мин</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {!servicesForServiceStep.length && (
                          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
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
                    <div />

                    {loadingSpecialists && <div className="text-sm">Загрузка...</div>}
                    {specialistsError && <div className="text-sm text-red-600">{specialistsError}</div>}

                    {isSpecialistFirst && (
                      <>
                        {loadingWorkdaySpecs && <div className="text-sm">Проверяем график Специалистов...</div>}
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
                            {loadingDateFirstServiceSlots && (
                              <div className="text-sm">Проверяем доступность Специалистов...</div>
                            )}
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {specialistsForSpecialistStep.map((sp) => {
                            const active = sp.id === specialistId;
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
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-sm font-semibold">
                                      {initials(sp.name)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-base font-semibold">{sp.name}</div>
                                      <div className="text-sm text-[color:var(--bp-muted)]">
                                        {sp.role || "Специалист"}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    className={cn(
                                      "rounded-2xl border px-2 py-1 text-xs",
                                      active
                                        ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-accent)] text-white"
                                        : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                                    )}
                                  >
                                    {active ? "Выбрано" : "Открыто"}
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {specialistsForSpecialistStep.length === 0 && (
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
                          <SummaryRow label="Дата" value={dateYmd} />
                          <SummaryRow
                            label="Время"
                            value={timeChoice ? `${timeChoice}${slotEnd ? ` – ${slotEnd}` : ""}` : "—"}
                          />
                          <SummaryRow
                            label="Стоимость"
                            value={servicePrice ? formatMoneyRub(servicePrice) : "—"}
                          />

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
                            disabled={!canNext || submitting}
                            className="h-11 w-full rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40"
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

          <SoftPanel className="p-4 sm:p-5 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Сводка</div>
              <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1 text-xs text-[color:var(--bp-muted)]">
                Live
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryRow label="Локация" value={selectedLocation?.name || "—"} />
              <SummaryRow label="Услуга" value={selectedService?.name || "—"} />
              <SummaryRow label="специалист" value={selectedSpecialist?.name || "—"} />
              <SummaryRow label="Дата" value={dateYmd} />
              <SummaryRow label="Время" value={timeChoice || "—"} />
              <SummaryRow label="Стоимость" value={servicePrice ? formatMoneyRub(servicePrice) : "—"} />

              <div className="mt-4 flex justify-start">
                <button
                  type="button"
                  onClick={submitAppointment}
                  disabled={!canNext || submitting}
                  className="w-full max-w-[260px] rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-[1px] hover:shadow-sm disabled:opacity-40 sm:max-w-[280px] lg:max-w-[320px]"
                >
                  {submitting ? "Сохранение..." : "Записаться"}
                </button>
              </div>

            </div>
          </SoftPanel>
        </div>
      </div>
    </div>
  );
}
