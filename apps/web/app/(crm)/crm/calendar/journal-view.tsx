"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffItem = {
  id: number;
  name: string;
  role: string;
  initials: string;
  levelId: number | null;
  locationIds: number[];
};

type JournalClient = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type JournalLocation = {
  id: number;
  name: string;
  hours: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
  exceptions: {
    date: string;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
  }[];
};

type JournalAppointment = {
  id: number;
  specialistId: number;
  locationId: number;
  clientId: number;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  clientName: string;
  serviceNames: string[];
  serviceIds: number[];
  priceTotal: string;
  durationMin: number;
  clientPhone: string;
  clientEmail: string;
};

type ScheduleEntry = {
  id: number;
  specialistId: number;
  locationId: number | null;
  date: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  breaks: { startTime: string; endTime: string }[];
};

type ServiceOption = {
  id: number;
  name: string;
  basePrice: string;
  baseDurationMin: number;
  locationIds: number[];
  specialistIds: number[];
  levelConfigs: {
    levelId: number;
    price: string | null;
    durationMin: number | null;
  }[];
  specialistOverrides: {
    specialistId: number;
    price: string | null;
    durationMin: number | null;
  }[];
};

type JournalViewProps = {
  initialDate: string;
  initialLocationId: number | null;
  staff: StaffItem[];
  clients: JournalClient[];
  locations: JournalLocation[];
  services: ServiceOption[];
  scheduleEntries: ScheduleEntry[];
  appointments: JournalAppointment[];
};

const SLOT_MINUTES = 15;
const ZOOM_STEPS = [0.8, 1, 1.2, 1.4];
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const STATUS_META: Record<string, { label: string; tone: string; badge: string }> =
  {
    NEW: {
      label: "Ожидание",
      tone: "bg-[color:var(--bp-amber)]/20 text-[color:var(--bp-ink)]",
      badge:
        "border border-[color:var(--bp-amber)]/40 text-[color:var(--bp-ink)]",
    },
    CONFIRMED: {
      label: "Подтвердил",
      tone: "bg-[color:var(--bp-lilac)]/20 text-[color:var(--bp-ink)]",
      badge:
        "border border-[color:var(--bp-lilac)]/40 text-[color:var(--bp-ink)]",
    },
    IN_PROGRESS: {
      label: "Пришел",
      tone: "bg-emerald-100 text-emerald-900",
      badge: "border border-emerald-200 text-emerald-900",
    },
    DONE: {
      label: "Завершен",
      tone: "bg-slate-200 text-slate-800",
      badge: "border border-slate-300 text-slate-800",
    },
    CANCELLED: {
      label: "Отменен",
      tone: "bg-rose-100 text-rose-900",
      badge: "border border-rose-200 text-rose-900",
    },
    NO_SHOW: {
      label: "Не пришел",
      tone: "bg-orange-100 text-orange-900",
      badge: "border border-orange-200 text-orange-900",
    },
  };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmdLocal(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function parseTimeToMinutes(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function addMinutesToTime(value: string, minutesToAdd: number) {
  const baseMinutes = parseTimeToMinutes(value);
  if (baseMinutes === null || minutesToAdd <= 0) return "";
  const total = baseMinutes + minutesToAdd;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clampZoomIndex(value: number) {
  const index = ZOOM_STEPS.indexOf(value);
  return index === -1 ? 1 : index;
}

function isOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function scheduleTypeMeta(entry: ScheduleEntry | undefined) {
  if (!entry) {
    return { tone: "bg-slate-50", label: "Выходной" };
  }

  switch (entry.type) {
    case "WORKING": {
      if (!entry.startTime || !entry.endTime) {
        return { tone: "bg-emerald-50", label: "Рабочий день" };
      }
      return { tone: "bg-emerald-50", label: `${entry.startTime} - ${entry.endTime}` };
    }
    case "SICK":
      return { tone: "bg-indigo-50", label: "Больничный" };
    case "VACATION":
      return { tone: "bg-amber-50", label: "Отпуск" };
    case "UNPAID_OFF":
      return { tone: "bg-slate-100", label: "Выходной" };
    case "NO_SHOW":
      return { tone: "bg-rose-50", label: "Прогул" };
    case "PAID_OFF":
      return { tone: "bg-yellow-50", label: "Оплачиваемый выходной" };
    default:
      return { tone: "bg-slate-50", label: "Выходной" };
  }
}

function dayOfWeekMon0(date: Date) {
  return (date.getDay() + 6) % 7;
}

function getLocationWindowForDate(location: JournalLocation | null | undefined, date: Date) {
  if (!location) return { startMinutes: 9 * 60, endMinutes: 21 * 60 };

  const ymd = formatDateKey(date);
  const exception = location.exceptions.find((item) => item.date === ymd);
  if (exception) {
    if (!exception.isClosed) {
      const start = parseTimeToMinutes(exception.startTime ?? "");
      const end = parseTimeToMinutes(exception.endTime ?? "");
      if (start !== null && end !== null && start < end) {
        return { startMinutes: start, endMinutes: end };
      }
    }
    const fallback = location.hours.find((item) => item.dayOfWeek === dayOfWeekMon0(date));
    const fallbackStart = parseTimeToMinutes(fallback?.startTime ?? "");
    const fallbackEnd = parseTimeToMinutes(fallback?.endTime ?? "");
    if (fallbackStart !== null && fallbackEnd !== null && fallbackStart < fallbackEnd) {
      return { startMinutes: fallbackStart, endMinutes: fallbackEnd };
    }
    return { startMinutes: 9 * 60, endMinutes: 21 * 60 };
  }

  const mon0 = dayOfWeekMon0(date);
  const regular = location.hours.find((item) => item.dayOfWeek === mon0);
  if (!regular) return { startMinutes: 9 * 60, endMinutes: 21 * 60 };

  const start = parseTimeToMinutes(regular.startTime);
  const end = parseTimeToMinutes(regular.endTime);
  if (start === null || end === null || start >= end) return { startMinutes: 9 * 60, endMinutes: 21 * 60 };

  return { startMinutes: start, endMinutes: end };
}

function getWeekStart(date: Date) {
  const day = date.getDay() === 0 ? 7 : date.getDay();
  return addDays(startOfDay(date), 1 - day);
}

function buildMonthMatrix(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const startWeek = getWeekStart(start);
  const matrix: Date[] = [];
  for (let i = 0; i < 42; i += 1) matrix.push(addDays(startWeek, i));
  return matrix;
}

type SlotSelection = {
  date: Date;
  staffId: number;
  startAt: Date;
  endAt: Date;
  locationId: number;
};

type EditorState =
  | { mode: "new"; slot: SlotSelection }
  | { mode: "edit"; appointment: JournalAppointment };

type EditorForm = {
  staffId: number;
  locationId: number;
  clientId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceId: number | null;
  serviceName: string;
  priceTotal: string;
  durationMin: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
};

export default function JournalView({
  initialDate,
  initialLocationId,
  staff,
  clients,
  locations,
  services,
  scheduleEntries,
  appointments,
}: JournalViewProps) {
  const router = useRouter();

  const [appointmentItems, setAppointmentItems] = useState(appointments);

  const [currentDate, setCurrentDate] = useState(() =>
    startOfDay(parseYmdLocal(initialDate) ?? new Date())
  );
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? 0);

  // ✅ выбранная локация
  const [selectedLocationId, setSelectedLocationId] = useState<number>(() => {
    const fallback = locations[0]?.id ?? 0;
    return initialLocationId ?? fallback;
  });
  const staffForLocation = useMemo(() => {
    if (!selectedLocationId) return staff;
    return staff.filter((item) => item.locationIds.includes(selectedLocationId));
  }, [selectedLocationId, staff]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [editorForm, setEditorForm] = useState<EditorForm | null>(null);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);

  const filtersRef = useRef<HTMLDivElement | null>(null);
  const sellRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  const pushUrl = (date: Date, locationId: number) => {
    const params = new URLSearchParams({
      date: formatDateKey(date),
      locationId: String(locationId),
    });
    router.push(`/crm/calendar?${params.toString()}`);
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false);
      }
      if (sellRef.current && !sellRef.current.contains(target)) {
        setSellOpen(false);
      }
      if (summaryRef.current && !summaryRef.current.contains(target)) {
        setSummaryOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
        setStatusMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!staffForLocation.find((item) => item.id === selectedStaffId)) {
      setSelectedStaffId(staffForLocation[0]?.id ?? 0);
    }
  }, [selectedStaffId, staffForLocation]);

  useEffect(() => {
    setAppointmentItems(appointments);
  }, [appointments]);

  // ✅ если текущая локация стала невалидной — берем первую
  useEffect(() => {
    if (!locations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId(locations[0]?.id ?? 0);
    }
  }, [locations, selectedLocationId]);

  // ✅ при смене локации закрываем редактор
  useEffect(() => {
    setEditorState(null);
  }, [selectedLocationId]);

  useEffect(() => {
    if (!editorState) {
      setEditorForm(null);
      return;
    }

    if (editorState.mode === "new") {
      const slot = editorState.slot;
      setEditorForm({
        staffId: slot.staffId,
        locationId:
          slot.locationId ?? selectedLocationId ?? locations[0]?.id ?? 0,
        clientId: null,
        date: formatDateInput(slot.startAt),
        startTime: formatTimeInput(slot.startAt),
        endTime: "",
        status: "NEW",
        serviceId: null,
        serviceName: "",
        priceTotal: "0",
        durationMin: 0,
        clientName: "",
        clientPhone: "",
        clientEmail: "",
      });
    } else {
      const appointment = editorState.appointment;
      const startAt = new Date(appointment.startAt);
      const endAt = new Date(appointment.endAt);

      setEditorForm({
        staffId: appointment.specialistId,
        locationId: appointment.locationId,
        clientId: appointment.clientId,
        date: formatDateInput(startAt),
        startTime: formatTimeInput(startAt),
        endTime: formatTimeInput(endAt),
        status: appointment.status,
        serviceId: appointment.serviceIds[0] ?? null,
        serviceName: appointment.serviceNames[0] ?? "",
        priceTotal: appointment.priceTotal,
        durationMin: appointment.durationMin,
        clientName: appointment.clientName,
        clientPhone: appointment.clientPhone ?? "",
        clientEmail: appointment.clientEmail ?? "",
      });
    }
  }, [editorState, locations, selectedLocationId]);

  useEffect(() => {
    if (!editorForm) return;
    if (!editorForm.startTime) return;

    if (editorForm.durationMin <= 0) {
      if (editorForm.endTime !== "") {
        setEditorForm((prev) => (prev ? { ...prev, endTime: "" } : prev));
      }
      return;
    }

    const computedEnd = addMinutesToTime(
      editorForm.startTime,
      editorForm.durationMin
    );
    if (computedEnd && computedEnd !== editorForm.endTime) {
      setEditorForm((prev) => (prev ? { ...prev, endTime: computedEnd } : prev));
    }
  }, [editorForm?.startTime, editorForm?.durationMin]);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const gridColumns = useMemo(() => {
    if (viewMode === "day") {
      return staffForLocation.map((item) => ({
        key: String(item.id),
        title: item.name,
        subtitle: item.role,
      }));
    }
    return weekDays.map((day) => ({
      key: day.toISOString(),
      title: day.getDate().toString(),
      subtitle: WEEKDAY_LABELS[(day.getDay() + 6) % 7],
    }));
  }, [staffForLocation, viewMode, weekDays]);

  const selectedLocation = useMemo(
    () =>
      locations.find((item) => item.id === selectedLocationId) ??
      locations[0] ??
      null,
    [locations, selectedLocationId]
  );

  const activeWindow = useMemo(
    () => getLocationWindowForDate(selectedLocation, currentDate),
    [selectedLocation, currentDate]
  );

  const weekWindow = useMemo(() => {
    const windows = weekDays.map((day) => getLocationWindowForDate(selectedLocation, day));
    const minStart = Math.min(...windows.map((item) => item.startMinutes));
    const maxEnd = Math.max(...windows.map((item) => item.endMinutes));
    return {
      startMinutes: Number.isFinite(minStart) ? minStart : activeWindow.startMinutes,
      endMinutes: Number.isFinite(maxEnd) ? maxEnd : activeWindow.endMinutes,
    };
  }, [activeWindow.endMinutes, activeWindow.startMinutes, selectedLocation, weekDays]);

  const visibleWindow = viewMode === "week" ? weekWindow : activeWindow;
  const dayStartMinutes = visibleWindow.startMinutes;
  const dayEndMinutes = Math.max(dayStartMinutes + SLOT_MINUTES, visibleWindow.endMinutes);
  const slotCount = Math.max(
    1,
    Math.ceil((dayEndMinutes - dayStartMinutes) / SLOT_MINUTES)
  );
  const slotHeight = Math.round(24 * zoom);

  const timeSlots = useMemo(() => {
    return Array.from({ length: slotCount }, (_, index) => {
      const absoluteMinutes = dayStartMinutes + index * SLOT_MINUTES;
      const hours = Math.floor(absoluteMinutes / 60);
      const minutes = absoluteMinutes % 60;
      return { hours, minutes };
    });
  }, [dayStartMinutes, slotCount]);

  // ✅ фильтруем график строго по выбранной локации
  const scheduleEntriesForLocation = useMemo(() => {
    if (!selectedLocationId) return [];
    return scheduleEntries.filter((e) => e.locationId === selectedLocationId);
  }, [scheduleEntries, selectedLocationId]);

  const scheduleByKey = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    scheduleEntriesForLocation.forEach((entry) => {
      const key = `${entry.specialistId}:${entry.date.slice(0, 10)}`;
      map.set(key, entry);
    });
    return map;
  }, [scheduleEntriesForLocation]);

  const getScheduleEntry = (staffId: number, date: Date) => {
    return scheduleByKey.get(`${staffId}:${formatDateKey(date)}`);
  };

  const isSlotWorking = (
    entry: ScheduleEntry | undefined,
    slotStart: number,
    slotEnd: number
  ) => {
    if (!entry || entry.type !== "WORKING") return false;

    // ✅ если у entry задана локация — она должна совпадать с выбранной
    if (
      selectedLocationId &&
      entry.locationId &&
      entry.locationId !== selectedLocationId
    ) {
      return false;
    }

    const entryStart = parseTimeToMinutes(entry.startTime ?? "");
    const entryEnd = parseTimeToMinutes(entry.endTime ?? "");
    if (entryStart === null || entryEnd === null) return false;

    if (slotStart < entryStart || slotEnd > entryEnd) return false;

    for (const entryBreak of entry.breaks) {
      const breakStart = parseTimeToMinutes(entryBreak.startTime);
      const breakEnd = parseTimeToMinutes(entryBreak.endTime);
      if (
        breakStart !== null &&
        breakEnd !== null &&
        isOverlap(slotStart, slotEnd, breakStart, breakEnd)
      ) {
        return false;
      }
    }
    return true;
  };

  // ✅ фильтруем записи по выбранной локации
  const filteredAppointments = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return appointmentItems.filter((appointment) => {
      if (
        selectedLocationId &&
        appointment.locationId !== selectedLocationId
      ) {
        return false;
      }

      const start = new Date(appointment.startAt);

      if (viewMode === "day") {
        if (!isSameDay(start, currentDate)) return false;
      } else {
        const endOfWeek = addDays(weekStart, 6);
        if (start < weekStart || start > endOfWeek) return false;
        if (selectedStaffId && appointment.specialistId !== selectedStaffId) {
          return false;
        }
      }

      if (
        statusFilter.length > 0 &&
        !statusFilter.includes(appointment.status)
      ) {
        return false;
      }

      if (search) {
        const haystack = [appointment.clientName, ...appointment.serviceNames]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [
    appointmentItems,
    currentDate,
    searchQuery,
    selectedStaffId,
    statusFilter,
    viewMode,
    weekStart,
    selectedLocationId,
  ]);

  const dailyTotal = useMemo(() => {
    return filteredAppointments.reduce((total, appointment) => {
      const value = Number(appointment.priceTotal || 0);
      return total + (Number.isNaN(value) ? 0 : value);
    }, 0);
  }, [filteredAppointments]);

  const monthMatrix = useMemo(
    () => buildMonthMatrix(currentDate),
    [currentDate]
  );

  const gridTemplateColumns = useMemo(() => {
    const count = Math.max(1, gridColumns.length);
    return `90px repeat(${count}, minmax(180px, 1fr))`;
  }, [gridColumns.length]);

  const gridTemplateRows = useMemo(() => {
    return `repeat(${slotCount}, ${slotHeight}px)`;
  }, [slotCount, slotHeight]);

  const appointmentCards = useMemo(() => {
    return filteredAppointments.map((appointment) => {
      const start = new Date(appointment.startAt);
      const end = new Date(appointment.endAt);

      const dayIndex = weekDays.findIndex((day) => isSameDay(day, start));
      const columnIndex =
        viewMode === "day"
          ? staffForLocation.findIndex((item) => item.id === appointment.specialistId)
          : dayIndex;

      if (columnIndex === -1) return null;

      const rawSlotIndex =
        (start.getHours() * 60 + start.getMinutes() - dayStartMinutes) / SLOT_MINUTES;
      const slotIndex = Math.max(0, Math.floor(rawSlotIndex));

      const durationMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
      const span = Math.max(1, Math.ceil(durationMinutes / SLOT_MINUTES));

      const statusMeta = STATUS_META[appointment.status] ?? STATUS_META.NEW;
      const sourceTone =
        appointment.source === "online"
          ? "bg-violet-200/60"
          : "bg-emerald-200/60";

      return {
        appointment,
        gridColumn: columnIndex + 2,
        gridRow: `${slotIndex + 1} / span ${span}`,
        statusMeta,
        sourceTone,
      };
    });
  }, [dayStartMinutes, filteredAppointments, staffForLocation, viewMode, weekDays]);

  const availableServices = useMemo(() => {
    if (!editorForm) return [];
    const staffItem = staff.find((item) => item.id === editorForm.staffId);
    const staffLevelId = staffItem?.levelId ?? null;

    return services
      .filter(
        (service) =>
          service.locationIds.includes(editorForm.locationId) &&
          service.specialistIds.includes(editorForm.staffId)
      )
      .map((service) => {
        const override = service.specialistOverrides.find(
          (item) => item.specialistId === editorForm.staffId
        );
        const levelConfig = staffLevelId
          ? service.levelConfigs.find((cfg) => cfg.levelId === staffLevelId)
          : null;

        const price =
          override?.price ?? levelConfig?.price ?? service.basePrice ?? "0";
        const durationMin =
          override?.durationMin ??
          levelConfig?.durationMin ??
          service.baseDurationMin;

        return {
          ...service,
          computedPrice: price,
          computedDurationMin: durationMin,
        };
      });
  }, [editorForm, services, staff]);

  const handleSlotClick = (rowIndex: number, colIndex: number) => {
    const absoluteMinutes = dayStartMinutes + rowIndex * SLOT_MINUTES;
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;

    const slotDate =
      viewMode === "day"
        ? currentDate
        : weekDays[Math.min(colIndex, weekDays.length - 1)];

    const staffItem =
      viewMode === "day"
        ? staffForLocation[colIndex]
        : staff.find((s) => s.id === selectedStaffId);

    if (!slotDate || !staffItem) return;

    const slotStartMinutes = dayStartMinutes + rowIndex * SLOT_MINUTES;
    const slotEndMinutes = slotStartMinutes + SLOT_MINUTES;

    const scheduleEntry = getScheduleEntry(staffItem.id, slotDate);
    const canBook = isSlotWorking(
      scheduleEntry,
      slotStartMinutes,
      slotEndMinutes
    );
    if (!canBook) return;

    const startAt = new Date(slotDate);
    startAt.setHours(hours, minutes, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + SLOT_MINUTES);

    // ✅ новая запись всегда в выбранной локации
    const locationId = selectedLocationId || locations[0]?.id || 0;

    setEditorState({
      mode: "new",
      slot: {
        date: slotDate,
        staffId: staffItem.id,
        startAt,
        endAt,
        locationId,
      },
    });
  };

  const handleAppointmentOpen = (appointment: JournalAppointment) => {
    setEditorState({ mode: "edit", appointment });
  };

  const handleEditorClose = () => {
    setEditorState(null);
  };

  const goToDate = (nextDate: Date) => {
    const normalized = startOfDay(nextDate);
    setCurrentDate(normalized);
    pushUrl(normalized, selectedLocationId || locations[0]?.id || 0);
  };

  const handleLocationChange = (nextId: number) => {
    const safe = Number.isInteger(nextId) ? nextId : locations[0]?.id ?? 0;
    setSelectedLocationId(safe);
    pushUrl(currentDate, safe);
  };

  const handleEditorSave = async () => {
    if (!editorForm || !editorState) return;
    if (!editorForm.staffId || !editorForm.locationId) return;

    if (!editorForm.serviceId) {
      setNoticeModal({ title: "Проверьте данные", message: "Выберите услугу." });
      return;
    }
    if (!editorForm.endTime || editorForm.durationMin <= 0) {
      setNoticeModal({ title: "Проверьте данные", message: "Укажите длительность услуги." });
      return;
    }
    if (
      !editorForm.clientId &&
      !editorForm.clientName.trim() &&
      !editorForm.clientPhone.trim()
    ) {
      return;
    }

    const startAt = new Date(`${editorForm.date}T${editorForm.startTime}:00`);
    const endAt = new Date(`${editorForm.date}T${editorForm.endTime}:00`);

    const payload = {
      staffId: editorForm.staffId,
      // ✅ фиксируем локацию на выбранной
      locationId: selectedLocationId || editorForm.locationId,
      clientId: editorForm.clientId,
      clientName: editorForm.clientName,
      clientPhone: editorForm.clientPhone,
      clientEmail: editorForm.clientEmail,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: editorForm.status,
      priceTotal: editorForm.priceTotal,
      serviceId: editorForm.serviceId,
      durationMin: editorForm.durationMin,
    };

    if (editorState.mode === "new") {
      const response = await fetch("/api/v1/crm/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const created = (await response.json()) as JournalAppointment;
        setAppointmentItems((prev) => [created, ...prev]);
        setEditorState(null);
      } else {
        const error = await response.json().catch(() => null);
        setNoticeModal({
          title: "Не удалось создать запись",
          message: error?.message ?? "Проверьте данные и попробуйте снова.",
        });
      }
      return;
    }

    const response = await fetch(
      `/api/v1/crm/appointments/${editorState.appointment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const updated = (await response.json()) as JournalAppointment;
      setAppointmentItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditorState(null);
    } else {
      const error = await response.json().catch(() => null);
      setNoticeModal({
        title: "Не удалось сохранить запись",
        message: error?.message ?? "Проверьте данные и попробуйте снова.",
      });
    }
  };

  const handleQuickStatusChange = async (appointmentId: number, status: string) => {
    const response = await fetch(`/api/v1/crm/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      const updated = (await response.json()) as JournalAppointment;
      setAppointmentItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setStatusMenuId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-96px)] flex-col gap-4">
      <header className="flex flex-col gap-3 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-muted)]"
          >
            <span className="text-lg">≡</span>
          </button>

          <button
            type="button"
            onClick={() => goToDate(startOfDay(new Date()))}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] px-4 py-2 text-sm font-medium"
          >
            Сегодня
          </button>

          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm font-medium">
            <button
              type="button"
              onClick={() => goToDate(addDays(currentDate, -1))}
              className="text-[color:var(--bp-muted)]"
            >
              ←
            </button>
            <span>{formatDayLabel(currentDate)}</span>
            <button
              type="button"
              onClick={() => goToDate(addDays(currentDate, 1))}
              className="text-[color:var(--bp-muted)]"
            >
              →
            </button>
          </div>

          {/* ✅ ВЫБОР ЛОКАЦИИ (фильтр журнала) */}
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm font-medium">
            <span className="text-[color:var(--bp-muted)]">Локация</span>
            <select
              value={selectedLocationId}
              onChange={(e) => handleLocationChange(Number(e.target.value))}
              className="bg-transparent outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={sellRef}>
              <button
                type="button"
                onClick={() => setSellOpen((prev) => !prev)}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm font-medium"
              >
                Продать
              </button>
              {sellOpen ? (
                <div className="absolute left-0 top-12 z-20 w-48 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-2 text-sm shadow-[var(--bp-shadow)]">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-[color:var(--bp-panel)]">
                    Товар
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-[color:var(--bp-panel)]">
                    Сертификат
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-[color:var(--bp-panel)]">
                    Абонемент
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative" ref={summaryRef}>
              <button
                type="button"
                onClick={() => setSummaryOpen((prev) => !prev)}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm font-medium"
              >
                {dailyTotal.toLocaleString("ru-RU")} ₽
              </button>
              {summaryOpen ? (
                <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-3 text-sm shadow-[var(--bp-shadow)]">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    Статистика дня
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Записей</span>
                    <span className="font-semibold">
                      {filteredAppointments.length}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Сумма</span>
                    <span className="font-semibold">
                      {dailyTotal.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative" ref={filtersRef}>
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm font-medium"
              >
                Фильтры
              </button>
              {filtersOpen ? (
                <div className="absolute right-0 top-12 z-20 w-60 rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-3 text-sm shadow-[var(--bp-shadow)]">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    Статусы визита
                  </div>
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <label
                      key={key}
                      className="mt-2 flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(key)}
                        onChange={() =>
                          setStatusFilter((prev) =>
                            prev.includes(key)
                              ? prev.filter((item) => item !== key)
                              : [...prev, key]
                          )
                        }
                      />
                      <span>{meta.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            {viewMode === "week" ? (
              <select
                value={selectedStaffId}
                onChange={(event) =>
                  setSelectedStaffId(Number(event.target.value))
                }
                className="h-10 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm"
              >
                {staffForLocation.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setZoom((prev) => {
                  const index = clampZoomIndex(prev);
                  return ZOOM_STEPS[Math.max(0, index - 1)];
                })
              }
              className="h-10 w-10 rounded-2xl border border-[color:var(--bp-stroke)] bg-white text-sm"
            >
              A-
            </button>

            <button
              type="button"
              onClick={() =>
                setZoom((prev) => {
                  const index = clampZoomIndex(prev);
                  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)];
                })
              }
              className="h-10 w-10 rounded-2xl border border-[color:var(--bp-stroke)] bg-white text-sm"
            >
              A+
            </button>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по журналу"
              className="h-10 w-[220px] rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 text-sm"
            />

            <button
              type="button"
              className="h-10 w-10 rounded-2xl border border-[color:var(--bp-stroke)] bg-white text-sm"
            >
              🔍
            </button>

            <button
              type="button"
              className="h-10 w-10 rounded-2xl border border-[color:var(--bp-stroke)] bg-white text-sm"
            >
              👤
            </button>

            <div className="ml-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  viewMode === "day"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "border border-[color:var(--bp-stroke)] bg-white text-[color:var(--bp-muted)]"
                }`}
              >
                День
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  viewMode === "week"
                    ? "bg-[color:var(--bp-ink)] text-white"
                    : "border border-[color:var(--bp-stroke)] bg-white text-[color:var(--bp-muted)]"
                }`}
              >
                Неделя
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="flex flex-1 gap-4">
        {sidebarOpen ? (
          <aside className="hidden w-[280px] shrink-0 flex-col gap-4 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)] xl:flex">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Календарь</h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    goToDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                        1
                      )
                    )
                  }
                >
                  ←
                </button>
                <span className="font-semibold">
                  {formatMonthYear(currentDate)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    goToDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                        1
                      )
                    )
                  }
                >
                  →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-[color:var(--bp-muted)]">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {monthMatrix.map((day) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isSelected = isSameDay(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => goToDate(startOfDay(day))}
                    className={`h-9 rounded-xl text-sm transition ${
                      isSelected
                        ? "bg-[color:var(--bp-ink)] text-white"
                        : isToday
                        ? "border border-[color:var(--bp-ink)] text-[color:var(--bp-ink)]"
                        : isCurrentMonth
                        ? "text-[color:var(--bp-ink)]"
                        : "text-[color:var(--bp-muted)]"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Журнал записи</span>
            <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-xs font-semibold">
              Выгрузить в PDF
            </button>
          </div>

          {gridColumns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-6 text-sm text-[color:var(--bp-muted)]">
              Добавьте сотрудников, чтобы открыть журнал записи.
            </div>
          ) : (
            <div className="overflow-auto">
              <div className="min-w-[980px]">
                <div
                  className="grid items-stretch border-b border-[color:var(--bp-stroke)] text-xs text-[color:var(--bp-muted)]"
                  style={{ gridTemplateColumns }}
                >
                  <div className="px-3 py-2" />
                  {gridColumns.map((column, index) => (
                    <div
                      key={column.key}
                      className={`border-l border-[color:var(--bp-stroke)] px-3 py-2 ${
                        viewMode === "day"
                          ? scheduleTypeMeta(
                              getScheduleEntry(staffForLocation[index]?.id ?? 0, currentDate)
                            ).tone
                          : scheduleTypeMeta(
                              getScheduleEntry(
                                selectedStaffId,
                                weekDays[Math.min(index, weekDays.length - 1)]
                              )
                            ).tone
                      }`}
                    >
                      <div className="text-sm font-semibold text-[color:var(--bp-ink)]">
                        {column.title}
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em]">
                        {column.subtitle}
                      </div>
                      {viewMode === "day" ? (
                        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                          {scheduleTypeMeta(
                            getScheduleEntry(staffForLocation[index]?.id ?? 0, currentDate)
                          ).label}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                          {scheduleTypeMeta(
                            getScheduleEntry(
                              selectedStaffId,
                              weekDays[Math.min(index, weekDays.length - 1)]
                            )
                          ).label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  className="relative grid"
                  style={{ gridTemplateColumns, gridTemplateRows }}
                >
                  {timeSlots.map((slot, rowIndex) => (
                    <div
                      key={`time-${rowIndex}`}
                      className="border-b border-[color:var(--bp-stroke)] px-3 py-1 text-xs text-[color:var(--bp-muted)]"
                      style={{ gridColumn: 1, gridRow: rowIndex + 1 }}
                    >
                      {slot.minutes === 0 ? `${slot.hours}:00` : ""}
                    </div>
                  ))}

                  {timeSlots.map((_, rowIndex) =>
                    gridColumns.map((column, colIndex) => {
                      const staffId =
                        viewMode === "day" ? staffForLocation[colIndex]?.id : selectedStaffId;

                      const slotDate =
                        viewMode === "day"
                          ? currentDate
                          : weekDays[Math.min(colIndex, weekDays.length - 1)];

                      const slotStart = dayStartMinutes + rowIndex * SLOT_MINUTES;
                      const slotEnd = slotStart + SLOT_MINUTES;

                      const scheduleEntry =
                        staffId && slotDate
                          ? getScheduleEntry(staffId, slotDate)
                          : undefined;

                      const isWorking =
                        staffId && slotDate
                          ? isSlotWorking(scheduleEntry, slotStart, slotEnd)
                          : false;

                      return (
                        <button
                          key={`cell-${rowIndex}-${column.key}`}
                          type="button"
                          disabled={!isWorking}
                          className={`border-b border-l border-[color:var(--bp-stroke)] ${
                            isWorking
                              ? "hover:bg-[color:var(--bp-panel)]"
                              : "cursor-not-allowed bg-[color:var(--bp-panel)]/60"
                          }`}
                          style={{
                            gridColumn: colIndex + 2,
                            gridRow: rowIndex + 1,
                          }}
                          onClick={() => {
                            if (isWorking) handleSlotClick(rowIndex, colIndex);
                          }}
                        />
                      );
                    })
                  )}

                  {appointmentCards.map((card) => {
                    if (!card) return null;
                    const statusMeta = card.statusMeta;

                    return (
                      <div
                        key={card.appointment.id}
                        className="relative z-10 m-1 overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-sm"
                        style={{
                          gridColumn: card.gridColumn,
                          gridRow: card.gridRow,
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAppointmentOpen(card.appointment)}
                      >
                        <div className={`h-2 ${card.sourceTone}`} />
                        <div className="px-3 pb-2 pt-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[color:var(--bp-ink)]">
                              {formatTime(new Date(card.appointment.startAt))}–
                              {formatTime(new Date(card.appointment.endAt))}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setStatusMenuId((prev) =>
                                  prev === card.appointment.id
                                    ? null
                                    : card.appointment.id
                                )
                              }
                              onMouseDown={(event) => event.stopPropagation()}
                              className={`rounded-full px-2 py-1 text-[10px] ${statusMeta.badge}`}
                            >
                              {statusMeta.label}
                            </button>
                          </div>

                          <div className="mt-1 font-semibold text-[color:var(--bp-ink)]">
                            {card.appointment.clientName}
                          </div>

                          <div className="mt-1 text-[11px] text-[color:var(--bp-muted)]">
                            {card.appointment.serviceNames.join(", ")}
                          </div>

                          <div className="mt-1 text-[11px] text-[color:var(--bp-muted)]">
                            {Number(card.appointment.priceTotal).toLocaleString(
                              "ru-RU"
                            )}{" "}
                            ₽
                          </div>
                        </div>

                        {statusMenuId === card.appointment.id ? (
                          <div
                            ref={statusMenuRef}
                            className="absolute right-2 top-8 z-20 w-36 rounded-xl border border-[color:var(--bp-stroke)] bg-white p-1 text-xs shadow-[var(--bp-shadow)]"
                          >
                            {Object.entries(STATUS_META).map(([key, meta]) => (
                              <button
                                key={key}
                                type="button"
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1 hover:bg-[color:var(--bp-panel)]"
                                onClick={() =>
                                  handleQuickStatusChange(
                                    card.appointment.id,
                                    key
                                  )
                                }
                              >
                                <span>{meta.label}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {editorForm && editorState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="flex h-[85vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-6 py-4">
              <div className="text-lg font-semibold">
                {editorState.mode === "new" ? "Новый сеанс" : "Запись"}
              </div>
              <button
                type="button"
                onClick={handleEditorClose}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm"
              >
                Закрыть
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 lg:grid-cols-[280px_1fr_320px]">
              <aside className="flex flex-col gap-4 rounded-2xl bg-[color:var(--bp-panel)] p-4">
                <div className="space-y-3">
                  <label className="text-xs text-[color:var(--bp-muted)]">
                    Специалист
                  </label>
                  <select
                    value={editorForm.staffId}
                    onChange={(event) =>
                      setEditorForm((prev) =>
                        prev ? { ...prev, staffId: Number(event.target.value) } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                  >
                    {staffForLocation.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-[color:var(--bp-muted)]">
                    Дата
                  </label>
                  <input
                    type="date"
                    value={editorForm.date}
                    onChange={(event) =>
                      setEditorForm((prev) =>
                        prev ? { ...prev, date: event.target.value } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[color:var(--bp-muted)]">
                      Начало
                    </label>
                    <input
                      type="time"
                      value={editorForm.startTime}
                      step={900}
                      onChange={(event) =>
                        setEditorForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                startTime: event.target.value,
                                endTime:
                                  prev.durationMin > 0
                                    ? addMinutesToTime(
                                        event.target.value,
                                        prev.durationMin
                                      )
                                    : "",
                              }
                            : prev
                        )
                      }
                      className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[color:var(--bp-muted)]">
                      Конец
                    </label>
                    <input
                      type="time"
                      value={editorForm.endTime}
                      step={900}
                      readOnly
                      disabled={editorForm.durationMin <= 0}
                      onChange={(event) =>
                        setEditorForm((prev) =>
                          prev ? { ...prev, endTime: event.target.value } : prev
                        )
                      }
                      className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[color:var(--bp-muted)]">
                    Статус
                  </label>
                  <select
                    value={editorForm.status}
                    onChange={(event) =>
                      setEditorForm((prev) =>
                        prev ? { ...prev, status: event.target.value } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(STATUS_META).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ✅ ЛОКАЦИЯ В РЕДАКТОРЕ: фиксируем выбранной (и показываем) */}
                <div>
                  <label className="text-xs text-[color:var(--bp-muted)]">
                    Локация
                  </label>
                  <select
                    value={selectedLocationId || editorForm.locationId}
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm opacity-80"
                    title="Журнал отфильтрован по локации — запись создается/редактируется в выбранной локации."
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </aside>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setEditorForm((prev) =>
                          prev ? { ...prev, status: key } : prev
                        )
                      }
                      className={`rounded-full px-4 py-2 text-xs font-semibold ${
                        editorForm.status === key
                          ? "bg-[color:var(--bp-ink)] text-white"
                          : `border border-[color:var(--bp-stroke)] ${meta.badge}`
                      }`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4">
                  <div className="text-sm font-semibold">Услуги</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--bp-muted)]">
                        Услуга
                      </label>
                      <select
                        value={editorForm.serviceId ?? ""}
                        onChange={(event) => {
                          const value = Number(event.target.value) || null;
                          const selected = availableServices.find(
                            (item) => item.id === value
                          );
                          const durationMin =
                            selected?.computedDurationMin ?? 0;

                          setEditorForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  serviceId: value,
                                  serviceName: selected?.name ?? "",
                                  priceTotal:
                                    selected?.computedPrice?.toString() ?? "0",
                                  durationMin,
                                  endTime: value
                                    ? addMinutesToTime(prev.startTime, durationMin)
                                    : "",
                                }
                              : prev
                          );
                        }}
                        className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] px-3 py-2 text-sm"
                      >
                        <option value="">Выберите услугу</option>
                        {availableServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--bp-muted)]">
                        Цена
                      </label>
                      <input
                        type="text"
                        value={editorForm.priceTotal}
                        onChange={(event) =>
                          setEditorForm((prev) =>
                            prev ? { ...prev, priceTotal: event.target.value } : prev
                          )
                        }
                        placeholder="Цена"
                        className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--bp-muted)]">
                        Длительность, мин
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={15}
                        value={editorForm.durationMin}
                        onChange={(event) => {
                          const durationMin = Number(event.target.value);
                          setEditorForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  durationMin,
                                  endTime: addMinutesToTime(
                                    prev.startTime,
                                    durationMin
                                  ),
                                }
                              : prev
                          );
                        }}
                        className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4">
                  <div className="text-sm font-semibold">Оплата визита</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm">
                      Карта
                    </button>
                    <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm">
                      Наличные
                    </button>
                    <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm">
                      Все способы
                    </button>
                  </div>
                </div>
              </div>

              <aside className="flex flex-col gap-4 rounded-2xl bg-[color:var(--bp-panel)] p-4">
                <div className="text-sm font-semibold">Клиент</div>

                <select
                  value={editorForm.clientId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    const selected = clients.find(
                      (client) => client.id === Number(value)
                    );
                    setEditorForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            clientId: value ? Number(value) : null,
                            clientName: selected?.name ?? prev.clientName,
                            clientPhone:
                              selected?.phone != null
                                ? selected.phone
                                : prev.clientPhone,
                            clientEmail:
                              selected?.email != null
                                ? selected.email
                                : prev.clientEmail,
                          }
                        : prev
                    );
                  }}
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Новый клиент</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={editorForm.clientName}
                  onChange={(event) =>
                    setEditorForm((prev) =>
                      prev ? { ...prev, clientName: event.target.value } : prev
                    )
                  }
                  placeholder="Имя клиента"
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                />

                <input
                  type="tel"
                  value={editorForm.clientPhone}
                  onChange={(event) =>
                    setEditorForm((prev) =>
                      prev ? { ...prev, clientPhone: event.target.value } : prev
                    )
                  }
                  placeholder="+7"
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                />

                <input
                  type="email"
                  value={editorForm.clientEmail}
                  onChange={(event) =>
                    setEditorForm((prev) =>
                      prev ? { ...prev, clientEmail: event.target.value } : prev
                    )
                  }
                  placeholder="Email"
                  className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                />
              </aside>
            </div>

            <div className="flex items-center justify-between border-t border-[color:var(--bp-stroke)] px-6 py-4">
              <button
                type="button"
                onClick={handleEditorClose}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm"
              >
                Отменить
              </button>
              <button
                type="button"
                onClick={handleEditorSave}
                className="rounded-2xl bg-[color:var(--bp-accent)] px-6 py-2 text-sm font-semibold text-white"
              >
                Сохранить запись
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {noticeModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-5 shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{noticeModal.title}</h3>
              <button
                type="button"
                onClick={() => setNoticeModal(null)}
                className="text-[color:var(--bp-muted)]"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{noticeModal.message}</p>
            <button
              type="button"
              onClick={() => setNoticeModal(null)}
              className="mt-4 w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white"
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
