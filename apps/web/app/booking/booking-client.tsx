"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Scissors,
  Search,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Id = number;

type PublicAccount = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
};

type Location = { id: Id; name: string; address: string };
type Service = {
  id: Id;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: number;
  computedDurationMin: number;
  computedPrice: number;
  specialistIds: Id[];
};
type Specialist = { id: Id; name: string; role: string | null; levelId: Id | null };
type Slot = { time: string; specialistId: Id };

type Scenario = "dateFirst" | "serviceFirst" | "specialistFirst";
type TimeBucket = "all" | "morning" | "day" | "evening";

type BookingClientProps = {
  accountSlug?: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function prettyDay(d: Date) {
  const now = new Date();
  const a = toYmd(now);
  const b = toYmd(d);
  if (a === b) return "Сегодня";
  const y = toYmd(addDays(now, 1));
  if (y === b) return "Завтра";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

function formatMoneyRub(n: number) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ₽`;
  }
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
    <div className="min-h-dvh w-full bg-gradient-to-b from-[#F7F7FF] via-white to-[#F2F6FF] text-neutral-900">
      {toast ? <Toast text={toast} /> : null}

      <div className="mx-auto w-full max-w-5xl p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-3xl border border-black/10 bg-white/70 shadow-sm">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-semibold leading-tight">{headerTitle}</div>
                <div className="text-sm text-black/55">{headerTagline}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-2xl">
                {steps[stepIndex]?.title}
              </Badge>
              <Button variant="outline" className="rounded-2xl" onClick={resetAll}>
                Сбросить
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
            <SoftPanel className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white text-sm font-semibold text-black/70">
                    {displayName === "Гость" ? "G" : initials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{displayName}</div>
                    <div className="text-xs text-black/50">Телефон: {displayPhone}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => gotoKey("details")}
                >
                  Редактировать
                </Button>
              </div>
              <div className="mt-3 text-xs text-black/50">
                Контакты сохраняются после записи.
              </div>
            </SoftPanel>

            <SoftPanel className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-black/55">Сценарий записи</div>
                  <div className="text-xs text-black/45">
                    Порядок шагов меняется, результат один
                  </div>
                </div>
                <Tabs
                  value={scenario}
                  onValueChange={(value) => setScenario(value as Scenario)}
                >
                  <TabsList className="rounded-2xl">
                    <TabsTrigger className="rounded-2xl" value="dateFirst">
                      Дата → время
                    </TabsTrigger>
                    <TabsTrigger className="rounded-2xl" value="serviceFirst">
                      Услуга → время
                    </TabsTrigger>
                    <TabsTrigger
                      className="rounded-2xl"
                      value="specialistFirst"
                    >
                      Мастер → время
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="mt-3">
                <ProgressBar value={progress} />
              </div>
            </SoftPanel>
          </div>
        </motion.div>

        {loadingContext ? (
          <div className="mt-4 rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
            Загружаем данные...
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-3xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_0.95fr]">
          <Card className="rounded-[28px] border-black/10 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-black/55">
                    Шаг {stepIndex + 1} из {steps.length}
                  </div>
                  <div className="text-lg font-semibold">{steps[stepIndex]?.title}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-2xl"
                    onClick={goPrev}
                    disabled={stepIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {currentStepKey !== "details" ? (
                    <Button
                      className="rounded-2xl"
                      onClick={goNext}
                      disabled={!canNext || stepIndex === steps.length - 1}
                    >
                      Дальше
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="min-h-[620px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStepKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    {currentStepKey === "location" && (
                      <div className="space-y-3">
                        <div className="text-sm text-black/60">Выбери удобную локацию</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {locations.map((loc) => {
                            const active = loc.id === locationId;
                            return (
                              <button
                                key={loc.id}
                                onClick={() => setLocationId(loc.id)}
                                className={cn(
                                  "group overflow-hidden rounded-3xl border p-4 text-left transition",
                                  "hover:-translate-y-[1px] hover:shadow-sm",
                                  active
                                    ? "border-black/20 bg-black/[0.02]"
                                    : "border-black/10 bg-white/70"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white text-sm font-semibold text-black/70">
                                      {initials(loc.name)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-base font-semibold">{loc.name}</div>
                                      <div className="mt-0.5 flex items-center gap-2 text-sm text-black/55">
                                        <MapPin className="h-4 w-4" />
                                        <span className="truncate">{loc.address}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <IconButton
                                      title="Информация о локации"
                                      onClick={() => openInfo("Локация", loc.name)}
                                    />
                                    <Badge
                                      className={cn(
                                        "rounded-2xl",
                                        active ? "" : "bg-black/5 text-black/70"
                                      )}
                                    >
                                      {active ? "Выбрано" : "Открыто"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <MapPreview label={loc.name} />
                                </div>
                              </button>
                            );
                          })}
                          {!locations.length && !loadingContext ? (
                            <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                              Локации не найдены.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {currentStepKey === "service" && (
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm text-black/60">Выбери услугу</div>
                            <div className="text-xs text-black/45">Поиск, цена и длительность</div>
                          </div>
                          <div className="relative w-full sm:w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                            <Input
                              value={q}
                              onChange={(event) => setQ(event.target.value)}
                              placeholder="Поиск услуги…"
                              className="h-10 rounded-2xl pl-9"
                            />
                          </div>
                        </div>

                        {loadingServices ? (
                          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                            Загружаем услуги...
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {filteredServices.map((srv) => {
                              const active = srv.id === serviceId;
                              const duration = srv.computedDurationMin ?? srv.baseDurationMin;
                              const price = srv.computedPrice ?? srv.basePrice;
                              return (
                                <button
                                  key={srv.id}
                                  onClick={() => {
                                    setServiceId(srv.id);
                                    setSlot(null);
                                  }}
                                  className={cn(
                                    "rounded-3xl border p-4 text-left transition",
                                    "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                                    active ? "border-black/20 bg-black/5" : "border-black/10"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white/70">
                                          <Scissors className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="truncate text-base font-semibold">{srv.name}</div>
                                          {srv.description ? (
                                            <div className="mt-0.5 truncate text-sm text-black/55">
                                              {srv.description}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-start gap-2">
                                      <IconButton
                                        title="Информация об услуге"
                                        onClick={() => openInfo("Услуга", srv.name)}
                                      />
                                      <div className="shrink-0 text-right">
                                        <div className="text-sm font-semibold">{formatMoneyRub(price)}</div>
                                        <div className="text-xs text-black/45">{duration} мин</div>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {!filteredServices.length ? (
                              <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                                Ничего не найдено.
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                    {currentStepKey === "specialist" && (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm text-black/60">Выбери мастера</div>
                          <div className="text-xs text-black/45">
                            {selectedService
                              ? "Список отфильтрован по услуге"
                              : "Можно выбрать любого"}
                          </div>
                        </div>

                        {loadingSpecialists ? (
                          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                            Загружаем специалистов...
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {specialists.map((sp) => {
                              const active = sp.id === specialistId;
                              return (
                                <button
                                  key={sp.id}
                                  onClick={() => {
                                    setSpecialistId(sp.id);
                                    setSlot(null);
                                  }}
                                  className={cn(
                                    "rounded-3xl border p-4 text-left transition",
                                    "hover:-translate-y-[1px] hover:bg-black/5 hover:shadow-sm",
                                    active ? "border-black/20 bg-black/5" : "border-black/10"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-white text-sm font-semibold text-black/70">
                                        {initials(sp.name)}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="truncate text-base font-semibold">{sp.name}</div>
                                        <div className="text-sm text-black/55">{sp.role || "Специалист"}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <IconButton
                                        title="Информация о мастере"
                                        onClick={() => openInfo("Мастер", sp.name)}
                                      />
                                      <Badge
                                        className={cn(
                                          "rounded-2xl",
                                          active ? "" : "bg-black/5 text-black/70"
                                        )}
                                      >
                                        {active ? "Выбрано" : "Свободен"}
                                      </Badge>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {!specialists.length ? (
                              <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                                Специалисты не найдены.
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {currentStepKey === "datetime" && (
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm text-black/60">Выбери дату и время</div>
                            <div className="text-xs text-black/45">
                              7 дней в ленте · календарь открывает месяц
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => setCalendarOpen(true)}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Календарь
                          </Button>
                        </div>

                        <CalendarStrip value={dateYmd} onChange={setDateYmd} />

                        <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                          Выбрана дата: <span className="font-semibold text-black/80">{dateYmd}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-black/60">Время</div>
                            <div className="text-xs text-black/45">Выбери слот</div>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => setSlot(null)}
                            disabled={!slot}
                          >
                            Сбросить время
                          </Button>
                        </div>

                        {!serviceId ? (
                          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                            Сначала выберите услугу, чтобы увидеть доступные слоты.
                          </div>
                        ) : loadingSlots ? (
                          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                            Загружаем слоты...
                          </div>
                        ) : slots.length ? (
                          <SlotsModern
                            slots={slots}
                            specialists={visibleSpecialists}
                            selected={slot}
                            onSelect={setSlot}
                            timeBucket={timeBucket}
                            onBucket={setTimeBucket}
                          />
                        ) : (
                          <div className="rounded-3xl border border-black/10 bg-white/70 p-4 text-sm text-black/60">
                            Нет доступных слотов на выбранную дату. Выбери другую дату.
                          </div>
                        )}
                      </div>
                    )}

                    {currentStepKey === "details" && (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm text-black/60">Контакты и подтверждение</div>
                          <div className="text-xs text-black/45">Проверь детали и нажми «Записаться»</div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <SoftPanel className="p-4">
                            <div className="text-sm font-semibold">Контакты</div>
                            <div className="mt-3 space-y-3">
                              <div>
                                <div className="text-xs font-medium text-black/45">Имя</div>
                                <Input
                                  value={clientName}
                                  onChange={(event) => setClientName(event.target.value)}
                                  className="mt-2 h-11 rounded-2xl"
                                  placeholder="Введите имя"
                                />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-black/45">Телефон</div>
                                <Input
                                  value={clientPhone}
                                  onChange={(event) => setClientPhone(event.target.value)}
                                  className="mt-2 h-11 rounded-2xl"
                                  placeholder="+7 ..."
                                />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-black/45">Комментарий (необязательно)</div>
                                <Input
                                  value={comment}
                                  onChange={(event) => setComment(event.target.value)}
                                  className="mt-2 h-11 rounded-2xl"
                                  placeholder="Комментарий к записи"
                                />
                              </div>

                              <button
                                onClick={() => setAgreed((value) => !value)}
                                className={cn(
                                  "flex items-start gap-3 rounded-3xl border p-4 text-left transition",
                                  "hover:bg-black/5",
                                  agreed ? "border-black/20 bg-black/5" : "border-black/10"
                                )}
                              >
                                <div
                                  className={cn(
                                    "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border",
                                    agreed ? "border-black/20 bg-black text-white" : "border-black/15 bg-transparent"
                                  )}
                                >
                                  {agreed ? <Check className="h-4 w-4" /> : null}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">Согласие на обработку данных</div>
                                  <div className="text-xs text-black/50">
                                    Нужно для подтверждения записи и уведомлений
                                  </div>
                                </div>
                              </button>
                            </div>
                          </SoftPanel>

                          <SoftPanel className="p-4">
                            <div className="text-sm font-semibold">Подтверждение</div>

                            <div className="mt-3 space-y-3">
                              <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                                <div className="text-xs text-black/50">Детали</div>
                                <div className="mt-3 space-y-3">
                                  <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Локация" value={selectedLocation?.name || "—"} />
                                  <SummaryRow icon={<Scissors className="h-4 w-4" />} label="Услуга" value={selectedService?.name || "—"} />
                                  <SummaryRow icon={<User className="h-4 w-4" />} label="Мастер" value={selectedSpecialist?.name || "Любой"} />
                                  <SummaryRow icon={<CalendarDays className="h-4 w-4" />} label="Дата" value={dateYmd || "—"} />
                                  <SummaryRow icon={<Clock className="h-4 w-4" />} label="Время" value={slot?.time || "—"} />
                                </div>
                              </div>

                              <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs text-black/50">Стоимость</div>
                                    <div className="text-sm font-semibold">{selectedService?.name || "—"}</div>
                                    <div className="text-xs text-black/45">
                                      {serviceDuration ? `${serviceDuration} мин` : ""}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-semibold">
                                      {servicePrice !== null ? formatMoneyRub(servicePrice) : "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Button
                                className="h-11 w-full rounded-2xl"
                                onClick={confirm}
                                disabled={!canNext || submitting}
                              >
                                {submitting ? "Создаем запись..." : "Записаться"}
                              </Button>

                              {confirmed && (
                                <motion.div
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.22 }}
                                >
                                  <div className="rounded-3xl border border-black/10 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-base font-semibold">Готово ✅ Запись подтверждена</div>
                                        <div className="mt-1 text-sm text-black/60">
                                          {dateYmd} · {slot?.time} · {selectedService?.name || ""}
                                        </div>
                                      </div>
                                      <Badge className="rounded-2xl">Создано</Badge>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        className="rounded-2xl"
                                        onClick={resetAll}
                                      >
                                        Новая запись
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          </SoftPanel>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <SoftPanel className="p-4 sm:p-5 lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Сводка</div>
                <Badge variant="secondary" className="rounded-2xl">Live</Badge>
              </div>
              <div className="mt-4 space-y-4">
                <SummaryRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Локация"
                  value={selectedLocation?.name || "Выберите"}
                />
                <SummaryRow
                  icon={<Scissors className="h-4 w-4" />}
                  label="Услуга"
                  value={selectedService?.name || "Выберите"}
                />
                <SummaryRow
                  icon={<User className="h-4 w-4" />}
                  label="Мастер"
                  value={selectedSpecialist?.name || (specialistId ? "Выбран" : "Любой")}
                />
                <SummaryRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Дата"
                  value={dateYmd}
                />
                <SummaryRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Время"
                  value={slot?.time || "Выберите"}
                />

                <Separator />

                <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-black/50">Стоимость</div>
                      <div className="text-sm font-semibold">
                        {selectedService?.name || "—"}
                      </div>
                      <div className="text-xs text-black/45">
                        {serviceDuration ? `${serviceDuration} мин` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {servicePrice !== null ? formatMoneyRub(servicePrice) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={goPrev}
                    disabled={stepIndex === 0}
                  >
                    Назад
                  </Button>
                  <Button
                    className="w-full rounded-2xl"
                    onClick={goNext}
                    disabled={!canNext || stepIndex === steps.length - 1}
                  >
                    Дальше
                  </Button>
                </div>

                <div className="text-xs text-black/50">
                  Прогресс: {stepIndex + 1}/{steps.length}
                </div>
              </div>
            </SoftPanel>
          </div>
        </div>

        <Modal open={calendarOpen} onClose={() => setCalendarOpen(false)}>
          <div className="space-y-3">
            <div className="text-sm text-black/60">Выбери дату — календарь на месяц.</div>
            <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
              <FullCalendar
                value={dateYmd}
                onSelect={(ymd) => {
                  setDateYmd(ymd);
                  setCalendarOpen(false);
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
