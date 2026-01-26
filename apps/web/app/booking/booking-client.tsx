"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type BookingClientProps = {
  accountSlug?: string;
};

type PublicAccount = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
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
};

type Specialist = {
  id: number;
  name: string;
  role: string | null;
};

type Slot = {
  time: string;
  specialistId: number;
};

type ContextData = {
  account: PublicAccount;
  locations: Location[];
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

type TimeBucket = "all" | "morning" | "day" | "evening";

const pad2 = (value: number) => String(value).padStart(2, "0");
const toYmd = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const prettyDay = (date: Date) => {
  const today = toYmd(new Date());
  const value = toYmd(date);
  if (today === value) return "Сегодня";
  if (toYmd(addDays(new Date(), 1)) === value) return "Завтра";
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
};

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
        "rounded-3xl border border-black/10 bg-white/70 shadow-sm",
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
        className="h-2 rounded-full bg-black/70"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function CalendarStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (ymd: string) => void;
}) {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => addDays(today, i));
  }, []);

  return (
    <div className="flex items-center gap-2">
      {days.map((day) => {
        const ymd = toYmd(day);
        const active = ymd === value;
        return (
          <button
            key={ymd}
            type="button"
            onClick={() => onChange(ymd)}
            className={cn(
              "rounded-2xl border px-3 py-2 text-left text-sm transition",
              "hover:bg-black/5",
              active ? "border-black/30 bg-black/5" : "border-black/10"
            )}
          >
            <div className="text-[11px] text-black/50">
              {day.toLocaleDateString("ru-RU", { weekday: "short" })}
            </div>
            <div className="text-sm font-semibold">{prettyDay(day)}</div>
          </button>
        );
      })}
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
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={cn(
            "rounded-2xl border px-3 py-2 text-xs font-medium transition",
            "hover:bg-black/5",
            value === option.key ? "border-black/30 bg-black/5" : "border-black/10"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SlotsPanel({
  slots,
  specialists,
  selected,
  timeBucket,
  onBucket,
  onSelect,
}: {
  slots: Slot[];
  specialists: Specialist[];
  selected: Slot | null;
  timeBucket: TimeBucket;
  onBucket: (value: TimeBucket) => void;
  onSelect: (slot: Slot) => void;
}) {
  const bucketForTime = (time: string) => {
    const minutes = timeToMinutes(time) ?? 0;
    if (minutes < 12 * 60) return "morning";
    if (minutes < 17 * 60) return "day";
    return "evening";
  };

  const grouped = useMemo(() => {
    const map = new Map<number, Slot[]>();
    slots.forEach((slot) => {
      if (timeBucket !== "all" && bucketForTime(slot.time) !== timeBucket) {
        return;
      }
      const list = map.get(slot.specialistId) ?? [];
      list.push(slot);
      map.set(slot.specialistId, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0))
    );
    return map;
  }, [slots, timeBucket]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-black/60">Выберите время</div>
        <TimeBucketPicker value={timeBucket} onChange={onBucket} />
      </div>

      <div className="space-y-4">
        {specialists.map((specialist) => {
          const list = grouped.get(specialist.id) ?? [];
          if (!list.length) return null;
          return (
            <div key={specialist.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-white text-xs font-semibold text-black/70">
                    {initials(specialist.name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{specialist.name}</div>
                    <div className="text-xs text-black/50">
                      {specialist.role || "Специалист"}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 px-2 py-1 text-xs text-black/60">
                  {list.length}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {list.map((slot) => {
                  const active =
                    selected?.time === slot.time &&
                    selected?.specialistId === slot.specialistId;
                  return (
                    <button
                      key={`${slot.specialistId}-${slot.time}`}
                      type="button"
                      onClick={() => onSelect(slot)}
                      className={cn(
                        "h-10 rounded-2xl border text-sm font-medium transition",
                        "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                        active
                          ? "border-black/30 bg-black/5 text-black"
                          : "border-black/10 text-black/70"
                      )}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs font-medium text-black/50">{label}</div>
      <div className="text-sm font-semibold text-black/80">{value}</div>
    </div>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Календарь</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-black/10 px-3 py-1 text-xs"
          >
            Закрыть
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export default function BookingClient({ accountSlug }: BookingClientProps) {
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

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [specialistId, setSpecialistId] = useState<number | null>(null);
  const [dateYmd, setDateYmd] = useState<string>(() => toYmd(new Date()));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [timeBucket, setTimeBucket] = useState<TimeBucket>("all");

  const [query, setQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const steps = [
    { key: "location", title: "Локация" },
    { key: "service", title: "Услуга" },
    { key: "specialist", title: "Специалист" },
    { key: "datetime", title: "Дата и время" },
    { key: "details", title: "Контакты" },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const currentStepKey = steps[stepIndex]?.key;

  useEffect(() => {
    let mounted = true;
    setLoadingContext(true);
    setContextError(null);

    fetchJson<ContextData>(
      buildUrl("/api/v1/public/booking/context", {
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        setContext(data);
        if (data.locations.length > 0) {
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
    setServiceId(null);
    setSpecialistId(null);
    setSlot(null);
  }, [locationId]);

  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0) {
      setServices([]);
      return;
    }

    let mounted = true;
    setLoadingServices(true);
    setServicesError(null);

    fetchJson<ServicesData>(
      buildUrl(
        `/api/v1/public/booking/locations/${safeLocationId}/services`,
        {
        specialistId,
        account: accountSlug ?? "",
        }
      )
    )
      .then((data) => {
        if (!mounted) return;
        setServices(data.services);
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
  }, [locationId, specialistId, accountSlug]);

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
      buildUrl(
        `/api/v1/public/booking/locations/${safeLocationId}/specialists`,
        {
        serviceId,
        account: accountSlug ?? "",
        }
      )
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
  }, [locationId, serviceId, accountSlug]);

  useEffect(() => {
    const safeLocationId = Number(locationId);
    if (!Number.isInteger(safeLocationId) || safeLocationId <= 0 || !serviceId) {
      setSlots([]);
      setLoadingSlots(false);
      setSlotsError(null);
      return;
    }

    let mounted = true;
    setLoadingSlots(true);
    setSlotsError(null);

    fetchJson<SlotsData>(
      buildUrl("/api/v1/public/booking/slots", {
        locationId: safeLocationId,
        date: dateYmd,
        serviceId,
        specialistId,
        account: accountSlug ?? "",
      })
    )
      .then((data) => {
        if (!mounted) return;
        setSlots(data.slots);
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setSlotsError(error.message);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingSlots(false);
      });

    return () => {
      mounted = false;
    };
  }, [locationId, dateYmd, serviceId, specialistId, accountSlug]);

  useEffect(() => {
    setSlot(null);
  }, [dateYmd, serviceId, specialistId]);

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

  const serviceDuration =
    selectedService?.computedDurationMin ?? selectedService?.baseDurationMin ?? null;
  const servicePrice =
    selectedService?.computedPrice ?? selectedService?.basePrice ?? null;

  const slotEnd = useMemo(() => {
    if (!slot || !serviceDuration) return "";
    return addMinutes(slot.time, serviceDuration);
  }, [slot, serviceDuration]);

  const visibleSpecialists = useMemo(() => {
    if (!specialistId) return specialists;
    return specialists.filter((item) => item.id === specialistId);
  }, [specialists, specialistId]);

  const progress = steps.length <= 1 ? 0 : stepIndex / (steps.length - 1);

  const canNext = useMemo(() => {
    switch (currentStepKey) {
      case "location":
        return !!locationId;
      case "service":
        return !!serviceId;
      case "specialist":
        return !!specialistId;
      case "datetime":
        return !!slot;
      case "details":
        return (
          clientName.trim().length >= 2 &&
          clientPhone.trim().length >= 8 &&
          !!locationId &&
          !!serviceId &&
          !!specialistId &&
          !!slot &&
          agreed
        );
      default:
        return true;
    }
  }, [
    currentStepKey,
    locationId,
    serviceId,
    specialistId,
    slot,
    clientName,
    clientPhone,
    agreed,
  ]);

  const goNext = () => setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  const goPrev = () => setStepIndex((value) => Math.max(0, value - 1));

  const resetAll = () => {
    setServiceId(null);
    setSpecialistId(null);
    setSlot(null);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setComment("");
    setAgreed(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setDateYmd(toYmd(new Date()));
    setTimeBucket("all");
    setQuery("");
    setStepIndex(0);
  };

  const submitAppointment = async () => {
    if (!locationId || !serviceId || !specialistId || !slot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await fetchJson<{ id: number }>(
        buildUrl("/api/v1/public/booking/appointments", {
          account: accountSlug ?? "",
        }),
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
            time: slot.time,
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            clientEmail: clientEmail.trim() || undefined,
            comment: comment.trim() || undefined,
          }),
        }
      );
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-[#F7F7FF] via-white to-[#F2F6FF] text-neutral-900">
      <div className="mx-auto w-full max-w-5xl p-3 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-black/55">Публичная запись</div>
            <div className="text-xl font-semibold">
              {context?.account.name || "Beauty Platform"}
            </div>
            <div className="text-sm text-black/50">
              Запись на услуги и выбор мастера
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-black/10 px-3 py-2 text-xs">
              {steps[stepIndex]?.title}
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-2xl border border-black/10 px-3 py-2 text-xs"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
          <SoftPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Контакты</div>
                <div className="text-xs text-black/50">
                  Данные сохранятся после записи
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setStepIndex(steps.findIndex((step) => step.key === "details"))
                }
                className="rounded-2xl border border-black/10 px-3 py-1 text-xs"
              >
                Редактировать
              </button>
            </div>
            <div className="mt-3 text-sm">
              {clientName || "Гость"}
              <div className="text-xs text-black/50">
                {clientPhone || "Телефон не указан"}
              </div>
            </div>
          </SoftPanel>
          <SoftPanel className="p-4">
            <div className="text-sm font-semibold">Прогресс</div>
            <div className="mt-3">
              <ProgressBar value={progress} />
            </div>
            <div className="mt-2 text-xs text-black/50">
              Шаг {stepIndex + 1} из {steps.length}
            </div>
          </SoftPanel>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_0.95fr]">
          <div className="rounded-[28px] border border-black/10 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-black/55">
                  Шаг {stepIndex + 1} из {steps.length}
                </div>
                <div className="text-lg font-semibold">{steps[stepIndex]?.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  className="rounded-2xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
                >
                  Назад
                </button>
                {currentStepKey !== "details" && (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canNext || stepIndex === steps.length - 1}
                    className="rounded-2xl border border-black/10 bg-black px-3 py-2 text-xs text-white disabled:opacity-40"
                  >
                    Дальше
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-black/5 pt-4">
              {currentStepKey === "location" && (
                <div className="space-y-3">
                  {loadingContext && <div className="text-sm">Загрузка локаций...</div>}
                  {contextError && (
                    <div className="text-sm text-red-600">{contextError}</div>
                  )}
                  {!loadingContext && !contextError && (
                    <div className="space-y-3">
                      <div className="text-sm text-black/60">
                        Выберите локацию
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {context?.locations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => {
                              const nextId = Number(location.id);
                              setLocationId(Number.isInteger(nextId) ? nextId : null);
                            }}
                            className={cn(
                              "rounded-3xl border p-4 text-left transition",
                              "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                              location.id === locationId
                                ? "border-black/30 bg-black/5"
                                : "border-black/10"
                            )}
                          >
                            <div className="text-base font-semibold">
                              {location.name}
                            </div>
                            <div className="mt-1 text-sm text-black/50">
                              {location.address || "Адрес не указан"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStepKey === "service" && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm text-black/60">Выберите услугу</div>
                      <div className="text-xs text-black/45">
                        Длительность и цена от уровня специалиста
                      </div>
                    </div>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Поиск услуги"
                      className="h-10 w-full rounded-2xl border border-black/10 px-3 text-sm sm:w-[260px]"
                    />
                  </div>
                  {loadingServices && <div className="text-sm">Загрузка...</div>}
                  {servicesError && (
                    <div className="text-sm text-red-600">{servicesError}</div>
                  )}
                  {!loadingServices && !servicesError && (
                    <div className="space-y-2">
                      {filteredServices.map((service) => {
                        const price =
                          service.computedPrice ?? service.basePrice ?? 0;
                        const duration =
                          service.computedDurationMin ?? service.baseDurationMin ?? 0;
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              setServiceId(service.id);
                              setSlot(null);
                            }}
                            className={cn(
                              "w-full rounded-3xl border p-4 text-left transition",
                              "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                              service.id === serviceId
                                ? "border-black/30 bg-black/5"
                                : "border-black/10"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-base font-semibold">
                                  {service.name}
                                </div>
                                {service.description && (
                                  <div className="mt-1 text-sm text-black/50">
                                    {service.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-sm">
                                <div className="font-semibold">
                                  {formatMoneyRub(price)}
                                </div>
                                <div className="text-xs text-black/45">
                                  {duration} мин
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {!filteredServices.length && (
                        <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                          Услуги не найдены.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStepKey === "specialist" && (
                <div className="space-y-3">
                  <div className="text-sm text-black/60">Выберите специалиста</div>
                  {loadingSpecialists && <div className="text-sm">Загрузка...</div>}
                  {specialistsError && (
                    <div className="text-sm text-red-600">{specialistsError}</div>
                  )}
                  {!loadingSpecialists && !specialistsError && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {specialists.map((specialist) => (
                        <button
                          key={specialist.id}
                          type="button"
                          onClick={() => {
                            setSpecialistId(specialist.id);
                            setSlot(null);
                          }}
                          className={cn(
                            "rounded-3xl border p-4 text-left transition",
                            "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                            specialist.id === specialistId
                              ? "border-black/30 bg-black/5"
                              : "border-black/10"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-white text-xs font-semibold">
                              {initials(specialist.name)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold">
                                {specialist.name}
                              </div>
                              <div className="text-xs text-black/50">
                                {specialist.role || "Специалист"}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentStepKey === "datetime" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-black/60">Дата и время</div>
                      <div className="text-xs text-black/45">
                        Слоты формируются из графика работы
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(true)}
                      className="rounded-2xl border border-black/10 px-3 py-2 text-xs"
                    >
                      Календарь
                    </button>
                  </div>

                  <CalendarStrip value={dateYmd} onChange={setDateYmd} />

                  {!serviceId && (
                    <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                      Сначала выберите услугу, чтобы увидеть доступные слоты.
                    </div>
                  )}

                  {serviceId && (
                    <div className="space-y-3">
                      {loadingSlots && <div className="text-sm">Загрузка слотов...</div>}
                      {slotsError && (
                        <div className="text-sm text-red-600">{slotsError}</div>
                      )}
                      {!loadingSlots && !slotsError && slots.length === 0 && (
                        <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                          Нет доступных слотов на выбранную дату.
                        </div>
                      )}
                      {!loadingSlots && !slotsError && slots.length > 0 && (
                        <SlotsPanel
                          slots={slots}
                          specialists={visibleSpecialists}
                          selected={slot}
                          timeBucket={timeBucket}
                          onBucket={setTimeBucket}
                          onSelect={(picked) => setSlot(picked)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStepKey === "details" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SoftPanel className="p-4">
                      <div className="text-sm font-semibold">Контакты</div>
                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="text-xs font-medium text-black/45">Имя</div>
                          <input
                            value={clientName}
                            onChange={(event) => setClientName(event.target.value)}
                            className="mt-2 h-10 w-full rounded-2xl border border-black/10 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-black/45">Телефон</div>
                          <input
                            value={clientPhone}
                            onChange={(event) => setClientPhone(event.target.value)}
                            className="mt-2 h-10 w-full rounded-2xl border border-black/10 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-black/45">Email</div>
                          <input
                            value={clientEmail}
                            onChange={(event) => setClientEmail(event.target.value)}
                            className="mt-2 h-10 w-full rounded-2xl border border-black/10 px-3 text-sm"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-black/45">Комментарий</div>
                          <input
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            className="mt-2 h-10 w-full rounded-2xl border border-black/10 px-3 text-sm"
                          />
                        </div>
                        <label className="flex items-start gap-3 text-xs text-black/60">
                          <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(event) => setAgreed(event.target.checked)}
                            className="mt-0.5"
                          />
                          Согласен(на) на обработку персональных данных
                        </label>
                      </div>
                    </SoftPanel>

                    <SoftPanel className="p-4">
                      <div className="text-sm font-semibold">Подтверждение</div>
                      <div className="mt-3 space-y-3">
                        <SummaryRow
                          label="Локация"
                          value={selectedLocation?.name || "—"}
                        />
                        <SummaryRow
                          label="Услуга"
                          value={selectedService?.name || "—"}
                        />
                        <SummaryRow
                          label="Специалист"
                          value={selectedSpecialist?.name || "—"}
                        />
                        <SummaryRow label="Дата" value={dateYmd} />
                        <SummaryRow
                          label="Время"
                          value={slot ? `${slot.time}${slotEnd ? ` – ${slotEnd}` : ""}` : "—"}
                        />
                        <SummaryRow
                          label="Стоимость"
                          value={servicePrice ? formatMoneyRub(servicePrice) : "—"}
                        />
                      </div>
                    </SoftPanel>
                  </div>

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
                    className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {submitting ? "Сохранение..." : "Записаться"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <SoftPanel className="p-4 sm:p-5 lg:sticky lg:top-6">
            <div className="text-sm font-semibold">Сводка</div>
            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Локация"
                value={selectedLocation?.name || "Выберите"}
              />
              <SummaryRow
                label="Услуга"
                value={selectedService?.name || "Выберите"}
              />
              <SummaryRow
                label="Специалист"
                value={selectedSpecialist?.name || "Выберите"}
              />
              <SummaryRow label="Дата" value={dateYmd} />
              <SummaryRow
                label="Время"
                value={slot ? `${slot.time}${slotEnd ? ` – ${slotEnd}` : ""}` : "Выберите"}
              />
              <SummaryRow
                label="Стоимость"
                value={servicePrice ? formatMoneyRub(servicePrice) : "—"}
              />
            </div>
          </SoftPanel>
        </div>
      </div>

      <Modal open={calendarOpen} onClose={() => setCalendarOpen(false)}>
        <div className="space-y-3">
          <div className="text-xs text-black/60">Выберите дату</div>
          <input
            type="date"
            value={dateYmd}
            onChange={(event) => setDateYmd(event.target.value)}
            className="h-10 w-full rounded-2xl border border-black/10 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setCalendarOpen(false)}
            className="rounded-2xl border border-black/10 px-3 py-2 text-xs"
          >
            Готово
          </button>
        </div>
      </Modal>
    </div>
  );
}
