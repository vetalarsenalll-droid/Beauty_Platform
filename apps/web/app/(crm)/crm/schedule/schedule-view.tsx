"use client";

import { useEffect, useMemo, useState } from "react";

type StaffMember = {
  id: number;
  name: string;
  role: string;
  initials: string;
};

type BreakItem = {
  startTime: string;
  endTime: string;
};

type NonWorkingType = {
  id: number;
  name: string;
  color: string;
};

type ScheduleEntry = {
  id: number;
  specialistId: number;
  date: string;
  type: string;
  customTypeId: number | null;
  startTime: string | null;
  endTime: string | null;
  breaks: BreakItem[];
  customType: NonWorkingType | null;
};

type ScheduleViewProps = {
  staff: StaffMember[];
  initialTypes: NonWorkingType[];
};

type CellRef = {
  staffId: number;
  date: string;
};

const SCHEDULE_TYPES = [
  { value: "WORKING", label: "Рабочий день" },
  { value: "SICK", label: "Больничный" },
  { value: "VACATION", label: "Отпуск" },
  { value: "UNPAID_OFF", label: "Выходной за свой счет" },
  { value: "NO_SHOW", label: "Прогул" },
  { value: "PAID_OFF", label: "Оплачиваемый выходной" },
  { value: "CUSTOM", label: "Свой тип" },
  { value: "DELETE", label: "Нерабочий день" },
];

const TEMPLATE_OPTIONS = [
  { value: "none", label: "Без шаблона" },
  { value: "weekdays", label: "По дням недели" },
  { value: "shifts", label: "По сменам" },
];

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function getWeekDays(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthDays(date: Date) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function formatMonth(date: Date) {
  return date.toLocaleString("ru-RU", { month: "long", year: "numeric" });
}

function cellKey(cell: CellRef) {
  return `${cell.staffId}-${cell.date}`;
}

function parseMinutes(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesBetween(start: string | null, end: string | null) {
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

function IconChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? (
        <path d="M15 6l-6 6 6 6" />
      ) : (
        <path d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

function IconFilter() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

export default function ScheduleView({ staff, initialTypes }: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [selectedCells, setSelectedCells] = useState<CellRef[]>([]);
  const [activeCell, setActiveCell] = useState<CellRef | null>(null);
  const [scheduleType, setScheduleType] = useState<string>("WORKING");
  const [customTypeId, setCustomTypeId] = useState<number | null>(null);
  const [workStart, setWorkStart] = useState("10:00");
  const [workEnd, setWorkEnd] = useState("21:00");
  const [selectedBreaks, setSelectedBreaks] = useState<BreakItem[]>([]);
  const [pending, setPending] = useState(false);
  const [copyModal, setCopyModal] = useState<StaffMember | null>(null);
  const [copyRange, setCopyRange] = useState({
    start: toIsoDate(new Date()),
    end: toIsoDate(addDays(new Date(), 13)),
  });
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [includeBreaks, setIncludeBreaks] = useState(true);
  const [templateMode, setTemplateMode] = useState("none");
  const [templateWeekdays, setTemplateWeekdays] = useState<number[]>([
    0, 1, 2, 3, 4,
  ]);
  const [templateWeeks, setTemplateWeeks] = useState(4);
  const [shiftWorkDays, setShiftWorkDays] = useState(2);
  const [shiftOffDays, setShiftOffDays] = useState(2);
  const [shiftWeeks, setShiftWeeks] = useState(4);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterRole, setFilterRole] = useState("all");
  const [filterQuery, setFilterQuery] = useState("");
  const [activeStaffMenu, setActiveStaffMenu] = useState<number | null>(null);
  const [nonWorkingTypes] = useState<NonWorkingType[]>(initialTypes);
  const [mobileSection, setMobileSection] = useState<"schedule" | "staff">(
    "schedule"
  );
  const [mobileStaffId, setMobileStaffId] = useState<number | null>(
    staff[0]?.id ?? null
  );
  const showTotals = true;
  const showDayCounts = true;

  const days = useMemo(() => {
    return viewMode === "month"
      ? getMonthDays(currentDate)
      : getWeekDays(currentDate);
  }, [currentDate, viewMode]);

  const range = useMemo(() => {
    const start = toIsoDate(days[0]);
    const end = toIsoDate(days[days.length - 1]);
    return { start, end };
  }, [days]);

  const entryMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    entries.forEach((entry) => {
      map.set(`${entry.specialistId}-${entry.date}`, entry);
    });
    return map;
  }, [entries]);

  const roles = useMemo(() => {
    return Array.from(new Set(staff.map((item) => item.role))).sort();
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter((person) => {
      const roleOk = filterRole === "all" || person.role === filterRole;
      const query = filterQuery.trim().toLowerCase();
      const queryOk =
        query.length === 0 ||
        person.name.toLowerCase().includes(query) ||
        person.role.toLowerCase().includes(query);
      return roleOk && queryOk;
    });
  }, [filterQuery, filterRole, staff]);

  useEffect(() => {
    if (filteredStaff.length === 0) {
      setMobileStaffId(null);
      return;
    }
    if (!mobileStaffId || !filteredStaff.some((item) => item.id === mobileStaffId)) {
      setMobileStaffId(filteredStaff[0].id);
    }
  }, [filteredStaff, mobileStaffId]);

  const staffTotals = useMemo(() => {
    const totals = new Map<number, { days: number; minutes: number }>();
    entries.forEach((entry) => {
      if (entry.type !== "WORKING") return;
      const minutes = minutesBetween(entry.startTime, entry.endTime);
      const current = totals.get(entry.specialistId) ?? { days: 0, minutes: 0 };
      totals.set(entry.specialistId, {
        days: current.days + 1,
        minutes: current.minutes + minutes,
      });
    });
    return totals;
  }, [entries]);

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      if (entry.type !== "WORKING") return;
      counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
    });
    return counts;
  }, [entries]);

  useEffect(() => {
    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
    });
    fetch(`/api/v1/crm/schedule/entries?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setEntries(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setEntries([]));
  }, [range.end, range.start]);

  useEffect(() => {
    if (!activeCell) return;
    const entry = entryMap.get(cellKey(activeCell));
    if (!entry) {
      setScheduleType("WORKING");
      setWorkStart("10:00");
      setWorkEnd("21:00");
      setSelectedBreaks([]);
      setCustomTypeId(null);
      return;
    }
    setScheduleType(entry.type);
    setWorkStart(entry.startTime ?? "10:00");
    setWorkEnd(entry.endTime ?? "21:00");
    setSelectedBreaks(entry.breaks ?? []);
    setCustomTypeId(entry.customTypeId ?? null);
  }, [activeCell, entryMap]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (filtersOpen && !target.closest("[data-schedule-filters]")) {
        setFiltersOpen(false);
      }
      if (activeStaffMenu && !target.closest("[data-schedule-staff-menu]")) {
        setActiveStaffMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeStaffMenu, filtersOpen]);

  const movePeriod = (direction: "prev" | "next") => {
    const delta =
      viewMode === "month"
        ? direction === "prev"
          ? -1
          : 1
        : direction === "prev"
          ? -7
          : 7;
    if (viewMode === "month") {
      setCurrentDate(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      );
    } else {
      setCurrentDate((prev) => addDays(prev, delta));
    }
  };

  const applySelection = (cell: CellRef, extendSelection: boolean) => {
    setActiveCell(cell);
    setSelectedCells((prev) => {
      const allowMulti = extendSelection || prev.length > 0;
      if (!allowMulti) return [cell];
      const next = [...prev];
      const key = cellKey(cell);
      const index = next.findIndex((item) => cellKey(item) === key);
      if (index >= 0) {
        next.splice(index, 1);
        return next;
      }
      return [...next, cell];
    });
  };

  const selectedStaffIds = useMemo(() => {
    const baseCells =
      selectedCells.length > 0 ? selectedCells : activeCell ? [activeCell] : [];
    return Array.from(new Set(baseCells.map((cell) => cell.staffId)));
  }, [activeCell, selectedCells]);

  const selectedDates = useMemo(() => {
    const baseCells =
      selectedCells.length > 0 ? selectedCells : activeCell ? [activeCell] : [];
    return new Set(baseCells.map((cell) => cell.date));
  }, [activeCell, selectedCells]);

  const targetCells = useMemo(() => {
    const baseCells =
      selectedCells.length > 0 ? selectedCells : activeCell ? [activeCell] : [];
    if (baseCells.length === 0) return [];
    if (templateMode === "none") return baseCells;

    const anchorDate = new Date(`${baseCells[0].date}T00:00:00`);
    const staffIds = selectedStaffIds.length
      ? selectedStaffIds
      : [baseCells[0].staffId];
    const cells: CellRef[] = [];

    if (templateMode === "weekdays") {
      const start = startOfWeek(anchorDate);
      const weeks = Math.max(1, templateWeeks);
      const weekdays = templateWeekdays.length
        ? templateWeekdays
        : [(start.getDay() + 6) % 7];
      for (let week = 0; week < weeks; week += 1) {
        weekdays.forEach((weekday) => {
          const date = addDays(start, week * 7 + weekday);
          const iso = toIsoDate(date);
          staffIds.forEach((staffId) => cells.push({ staffId, date: iso }));
        });
      }
      return cells;
    }

    if (templateMode === "shifts") {
      const workDays = Math.max(1, shiftWorkDays);
      const offDays = Math.max(0, shiftOffDays);
      const cycle = workDays + offDays;
      const totalDays = Math.max(1, shiftWeeks) * 7;
      for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
        const inWork = cycle === 0 ? false : dayIndex % cycle < workDays;
        if (!inWork) continue;
        const date = addDays(anchorDate, dayIndex);
        const iso = toIsoDate(date);
        staffIds.forEach((staffId) => cells.push({ staffId, date: iso }));
      }
      return cells;
    }

    return baseCells;
  }, [
    activeCell,
    selectedCells,
    selectedStaffIds,
    shiftOffDays,
    shiftWeeks,
    shiftWorkDays,
    templateMode,
    templateWeekdays,
    templateWeeks,
  ]);

  const canSave =
    targetCells.length > 0 &&
    !pending &&
    (scheduleType !== "CUSTOM" || customTypeId !== null);

  const saveSchedule = async () => {
    if (!canSave) return;
    setPending(true);
    try {
      const payload = {
        entries: targetCells.map((cell) => ({
          specialistId: cell.staffId,
          date: cell.date,
          type: scheduleType,
          customTypeId: scheduleType === "CUSTOM" ? customTypeId : null,
          startTime: scheduleType === "WORKING" ? workStart : null,
          endTime: scheduleType === "WORKING" ? workEnd : null,
          breaks: scheduleType === "WORKING" ? selectedBreaks : [],
        })),
      };
      const response = await fetch("/api/v1/crm/schedule/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return;
      }
      const refreshed = await fetch(
        `/api/v1/crm/schedule/entries?start=${range.start}&end=${range.end}`
      ).then((res) => res.json());
      setEntries(Array.isArray(refreshed?.data) ? refreshed.data : []);
    } finally {
      setPending(false);
    }
  };

  const handleCopy = async () => {
    if (!copyModal || selectedTargets.length === 0) return;
    await fetch("/api/v1/crm/schedule/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceSpecialistId: copyModal.id,
        targetSpecialistIds: selectedTargets,
        start: copyRange.start,
        end: copyRange.end,
        includeBreaks,
      }),
    });
    setCopyModal(null);
    setSelectedTargets([]);
  };

  const typeLabel = (entry: ScheduleEntry | undefined) => {
    if (!entry) return null;
    if (entry.type === "WORKING") {
      return `${entry.startTime ?? ""} - ${entry.endTime ?? ""}`;
    }
    if (entry.type === "CUSTOM" && entry.customType) {
      return entry.customType.name;
    }
    const match = SCHEDULE_TYPES.find((type) => type.value === entry.type);
    return match?.label ?? "Нерабочий день";
  };

  const entryStyles = (entry: ScheduleEntry | undefined) => {
    if (!entry) return "border-dashed border-[color:var(--bp-stroke)]";
    if (entry.type === "WORKING") return "bg-emerald-50 border-emerald-200";
    if (entry.type === "SICK") return "bg-indigo-50 border-indigo-200";
    if (entry.type === "VACATION") return "bg-amber-50 border-amber-200";
    if (entry.type === "UNPAID_OFF") return "bg-slate-50 border-slate-200";
    if (entry.type === "NO_SHOW") return "bg-rose-50 border-rose-200";
    if (entry.type === "PAID_OFF") return "bg-yellow-50 border-yellow-200";
    if (entry.type === "CUSTOM" && entry.customType?.color) {
      return "border-transparent";
    }
    return "bg-gray-50 border-gray-200";
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM BUSINESS
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              График работы
            </h1>
            <p className="text-[color:var(--bp-muted)]">
              Настройка графика работы сотрудников.
            </p>
          </div>
          <button
            type="button"
            className="rounded-2xl border border-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-[color:var(--bp-accent)]"
          >
            Выгрузить в PDF
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" data-schedule-filters>
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm"
            >
              <IconFilter />
              Фильтры
            </button>
            {filtersOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4 text-sm shadow-[var(--bp-shadow)]">
                <label className="flex flex-col gap-2">
                  <span className="text-xs text-[color:var(--bp-muted)]">
                    Сотрудники и должности
                  </span>
                  <select
                    value={filterRole}
                    onChange={(event) => setFilterRole(event.target.value)}
                    className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
                  >
                    <option value="all">Все</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-xs text-[color:var(--bp-muted)]">
                    Поиск
                  </span>
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="Имя или должность"
                    className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => movePeriod("prev")}
              className="text-[color:var(--bp-muted)]"
            >
              <IconChevron direction="left" />
            </button>
            <span className="min-w-[140px] text-center font-medium capitalize">
              {formatMonth(currentDate)}
            </span>
            <button
              type="button"
              onClick={() => movePeriod("next")}
              className="text-[color:var(--bp-muted)]"
            >
              <IconChevron direction="right" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm"
          >
            Сегодня
          </button>
          <div className="flex w-full items-center gap-2 lg:hidden">
            <div className="flex flex-1 rounded-2xl border border-[color:var(--bp-stroke)] p-1 text-sm">
              <button
                type="button"
                onClick={() => setMobileSection("schedule")}
                className={`flex-1 rounded-xl px-3 py-1 ${
                  mobileSection === "schedule"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "text-[color:var(--bp-muted)]"
                }`}
              >
                График
              </button>
              <button
                type="button"
                onClick={() => setMobileSection("staff")}
                className={`flex-1 rounded-xl px-3 py-1 ${
                  mobileSection === "staff"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "text-[color:var(--bp-muted)]"
                }`}
              >
                Сотрудники
              </button>
            </div>
          </div>
          <div className="w-full lg:hidden">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs text-[color:var(--bp-muted)]">
                Показать сотрудника
              </span>
              <select
                value={mobileStaffId ?? ""}
                onChange={(event) =>
                  setMobileStaffId(Number(event.target.value) || null)
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
              >
                {filteredStaff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-2xl border border-[color:var(--bp-stroke)] p-1 text-sm">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-xl px-3 py-1 ${
                  viewMode === "week"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "text-[color:var(--bp-muted)]"
                }`}
              >
                Неделя
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-xl px-3 py-1 ${
                  viewMode === "month"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "text-[color:var(--bp-muted)]"
                }`}
              >
                Месяц
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-[var(--bp-shadow)]">
        <div className="flex flex-col lg:flex-row">
          <div
            className={`w-full border-b border-[color:var(--bp-stroke)] lg:w-[280px] lg:border-b-0 lg:border-r ${
              mobileSection === "staff" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="flex h-[64px] items-center justify-between border-b border-[color:var(--bp-stroke)] px-4 py-3 text-sm font-semibold">
              Сотрудники
              <span className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-0.5 text-xs text-[color:var(--bp-muted)]">
                {filteredStaff.length}
              </span>
            </div>
            <div className="divide-y divide-[color:var(--bp-stroke)]">
              {filteredStaff.map((person) => {
                const totals = staffTotals.get(person.id);
                return (
                  <div
                    key={person.id}
                    className="relative flex h-[88px] items-center overflow-hidden px-4 py-3 text-sm leading-tight"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bp-chip)] text-xs font-semibold">
                        {person.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{person.name}</div>
                        <div className="truncate text-xs text-[color:var(--bp-muted)]">
                          {person.role}
                        </div>
                        {showTotals && totals ? (
                          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                            {totals.days} дн · {formatMinutes(totals.minutes)}
                          </div>
                        ) : null}
                      </div>
                      <div className="relative" data-schedule-staff-menu>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveStaffMenu((prev) =>
                              prev === person.id ? null : person.id
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
                        >
                          <IconDots />
                        </button>
                        {activeStaffMenu === person.id ? (
                          <div className="absolute right-0 top-10 z-20 w-56 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-2 text-sm shadow-[var(--bp-shadow)]">
                            <button
                              type="button"
                              onClick={() => {
                                setCopyModal(person);
                                setActiveStaffMenu(null);
                              }}
                              className="w-full rounded-xl px-3 py-2 text-left hover:bg-[color:var(--sidebar-item)]"
                            >
                              Скопировать график
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveStaffMenu(null)}
                              className="w-full rounded-xl px-3 py-2 text-left hover:bg-[color:var(--sidebar-item)]"
                            >
                              Редактировать сотрудника
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={`flex-1 overflow-auto ${
              mobileSection === "schedule" ? "block" : "hidden"
            } lg:block`}
          >
            <div className="min-w-[640px] sm:min-w-[980px]">
              <div
                className="grid h-[64px] border-b border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] text-xs font-medium text-[color:var(--bp-muted)]"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(90px, 1fr))`,
                }}
              >
                {days.map((day) => {
                  const iso = toIsoDate(day);
                  return (
                    <div
                      key={iso}
                      className={`flex h-full flex-col items-center justify-center px-3 py-2 text-center ${
                        selectedDates.has(iso)
                          ? "bg-[color:var(--bp-accent-soft)]"
                          : ""
                      }`}
                    >
                      <div
                        className={`text-sm font-semibold ${
                          day.getDay() === 0 || day.getDay() === 6
                            ? "text-rose-500"
                            : "text-[color:var(--bp-ink)]"
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div>{WEEKDAY_LABELS[(day.getDay() + 6) % 7]}</div>
                      {showDayCounts ? (
                        <div className="mt-1 text-[10px] text-[color:var(--bp-muted)]">
                          {dayCounts.get(iso) ?? 0}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {filteredStaff.map((person) => {
                const isMobileVisible =
                  !mobileStaffId || person.id === mobileStaffId;
                return (
                  <div
                    key={person.id}
                    className={`${
                      isMobileVisible ? "grid" : "hidden"
                    } h-[88px] border-b border-[color:var(--bp-stroke)] lg:grid`}
                    style={{
                      gridTemplateColumns: `repeat(${days.length}, minmax(90px, 1fr))`,
                    }}
                  >
                  {days.map((day) => {
                    const iso = toIsoDate(day);
                    const entry = entryMap.get(`${person.id}-${iso}`);
                    const label = typeLabel(entry);
                    const isSelected = selectedCells.some(
                      (cell) =>
                        cell.staffId === person.id && cell.date === iso
                    );
                    const isDateSelected = selectedDates.has(iso);
                    return (
                      <button
                        key={`${person.id}-${iso}`}
                        type="button"
                        onClick={(event) =>
                          applySelection(
                            { staffId: person.id, date: iso },
                            event.shiftKey || event.ctrlKey || event.metaKey
                          )
                        }
                        className={`flex h-full items-center justify-center border-r border-[color:var(--bp-stroke)] px-2 py-3 last:border-r-0 ${
                          isDateSelected
                            ? "bg-[color:var(--bp-accent-soft)]/40"
                            : "bg-transparent"
                        } ${isSelected ? "outline outline-2 outline-[color:var(--bp-accent)]/60" : ""}`}
                      >
                        {label ? (
                          <div
                            className={`w-full rounded-xl border px-2 py-2 text-xs ${entryStyles(
                              entry
                            )}`}
                            style={
                              entry?.type === "CUSTOM" && entry.customType?.color
                                ? {
                                    backgroundColor: entry.customType.color,
                                    color: "#fff",
                                  }
                                : undefined
                            }
                          >
                            <div className="truncate">{label}</div>
                            {entry?.type === "WORKING" &&
                            entry.breaks.length > 0 ? (
                              <div className="mt-1 text-[10px] text-[color:var(--bp-muted)]">
                                Перерывы: {entry.breaks.length}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                  </div>
                );
              })}
            </div>
          </div>
          {activeCell || selectedCells.length > 0 ? (
            <aside
              className={`w-full border-t border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] p-4 lg:w-[360px] lg:border-l lg:border-t-0 ${
                mobileSection === "schedule" ? "block" : "hidden"
              } lg:block`}
            >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Настройка графика</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedCells([]);
                  setActiveCell(null);
                }}
                className="text-sm text-[color:var(--bp-muted)]"
                aria-label="Закрыть"
                title="Закрыть"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--bp-muted)]">
                  Выбор шаблона
                </span>
                <select
                  value={templateMode}
                  onChange={(event) => setTemplateMode(event.target.value)}
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
                >
                  {TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {templateMode === "weekdays" ? (
                <div className="space-y-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    Рабочие дни
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-xs">
                    {WEEKDAY_LABELS.map((label, index) => {
                      const checked = templateWeekdays.includes(index);
                      return (
                        <label
                          key={label}
                          className={`flex items-center justify-center rounded-xl border px-2 py-1 ${
                            checked
                              ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-accent-soft)]"
                              : "border-[color:var(--bp-stroke)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setTemplateWeekdays((prev) =>
                                checked
                                  ? prev.filter((day) => day !== index)
                                  : [...prev, index]
                              )
                            }
                            className="sr-only"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-[color:var(--bp-muted)]">
                      Интервал действия
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={templateWeeks}
                      onChange={(event) =>
                        setTemplateWeeks(Number(event.target.value) || 1)
                      }
                      className="w-16 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1"
                    />
                    недель
                  </label>
                </div>
              ) : null}

              {templateMode === "shifts" ? (
                <div className="space-y-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-[color:var(--bp-muted)]">
                      Рабочие / выходные
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={shiftWorkDays}
                      onChange={(event) =>
                        setShiftWorkDays(Number(event.target.value) || 1)
                      }
                      className="w-14 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1"
                    />
                    через
                    <input
                      type="number"
                      min={0}
                      value={shiftOffDays}
                      onChange={(event) =>
                        setShiftOffDays(Number(event.target.value) || 0)
                      }
                      className="w-14 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-[color:var(--bp-muted)]">
                      Интервал действия
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={shiftWeeks}
                      onChange={(event) =>
                        setShiftWeeks(Number(event.target.value) || 1)
                      }
                      className="w-16 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1"
                    />
                    недель
                  </label>
                </div>
              ) : null}

              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--bp-muted)]">Тип</span>
                <select
                  value={scheduleType}
                  onChange={(event) => setScheduleType(event.target.value)}
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
                >
                  {SCHEDULE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {scheduleType === "CUSTOM" ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--bp-muted)]">
                    Свой тип
                  </span>
                  <select
                    value={customTypeId ?? ""}
                    onChange={(event) =>
                      setCustomTypeId(Number(event.target.value) || null)
                    }
                    className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2"
                  >
                    <option value="">Выберите тип</option>
                    {nonWorkingTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {scheduleType === "WORKING" ? (
                <>
                  <div>
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      Рабочее время
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="time"
                        value={workStart}
                        onChange={(event) => setWorkStart(event.target.value)}
                        className="w-24 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                      />
                      -
                      <input
                        type="time"
                        value={workEnd}
                        onChange={(event) => setWorkEnd(event.target.value)}
                        className="w-24 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      Перерывы
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      {selectedBreaks.map((item, index) => (
                        <div
                          key={`${item.startTime}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(event) =>
                              setSelectedBreaks((prev) =>
                                prev.map((value, idx) =>
                                  idx === index
                                    ? { ...value, startTime: event.target.value }
                                    : value
                                )
                              )
                            }
                            className="w-24 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                          />
                          -
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(event) =>
                              setSelectedBreaks((prev) =>
                                prev.map((value, idx) =>
                                  idx === index
                                    ? { ...value, endTime: event.target.value }
                                    : value
                                )
                              )
                            }
                            className="w-24 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBreaks((prev) =>
                                prev.filter((_, idx) => idx !== index)
                              )
                            }
                            className="text-xs text-[color:var(--bp-muted)]"
                          >
                            Удалить
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBreaks((prev) => [
                            ...prev,
                            { startTime: "12:00", endTime: "12:30" },
                          ])
                        }
                        className="text-xs text-[color:var(--bp-muted)]"
                      >
                        + Добавить перерыв
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="text-xs text-[color:var(--bp-muted)]">
                {scheduleType === "DELETE"
                  ? `Удалится дней: ${targetCells.length}`
                  : `Добавится дней: ${targetCells.length}`}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCells([]);
                    setActiveCell(null);
                  }}
                  className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm"
                >
                  Отменить
                </button>
                <button
                  type="button"
                  onClick={saveSchedule}
                  disabled={!canSave}
                  className="w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </aside>
          ) : null}
        </div>
      </section>

      {copyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Копирование графика</h3>
              <button
                type="button"
                onClick={() => setCopyModal(null)}
                className="text-[color:var(--bp-muted)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-xs text-[color:var(--bp-muted)]">
                Копируем от:
              </div>
              <div className="mt-2 rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2">
                {copyModal.name}
              </div>
              <div className="mt-4 text-xs text-[color:var(--bp-muted)]">
                Кому:
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {staff
                  .filter((person) => person.id !== copyModal.id)
                  .map((person) => {
                    const checked = selectedTargets.includes(person.id);
                    return (
                      <label
                        key={person.id}
                        className="flex items-center gap-2 rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedTargets((prev) =>
                              checked
                                ? prev.filter((id) => id !== person.id)
                                : [...prev, person.id]
                            )
                          }
                        />
                        {person.name}
                      </label>
                    );
                  })}
              </div>
              <div className="mt-4 text-xs text-[color:var(--bp-muted)]">
                На период:
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={copyRange.start}
                  onChange={(event) =>
                    setCopyRange((prev) => ({
                      ...prev,
                      start: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                />
                -
                <input
                  type="date"
                  value={copyRange.end}
                  onChange={(event) =>
                    setCopyRange((prev) => ({
                      ...prev,
                      end: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                />
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={includeBreaks}
                  onChange={(event) => setIncludeBreaks(event.target.checked)}
                />
                Скопировать график с перерывами
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-4 w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white"
              >
                Скопировать график
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
