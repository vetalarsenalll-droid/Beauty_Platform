import {
  bookingSummary,
  createAssistantBooking,
  DraftLike,
  getEffectiveServiceForSpecialist,
  getOffers,
  getSlots,
  LocationLite,
  serviceListText,
  ServiceLite,
  specialistsForSlot,
  SpecialistLite,
} from "@/lib/booking-tools";

export type BookingState =
  | "IDLE"
  | "COLLECTING"
  | "CHECKING"
  | "READY_SELF"
  | "WAITING_CONSENT"
  | "WAITING_CONFIRMATION"
  | "COMPLETED"
  | "CANCEL_FLOW"
  | "RESCHEDULE_FLOW";

type FlowAction = { type: "open_booking"; bookingUrl: string } | null;

type FlowCtx = {
  messageNorm: string;
  bookingIntent: boolean;
  asksAvailability: boolean;
  choice: number | null;
  d: DraftLike;
  currentStatus: string;
  origin: string;
  account: { id: number; slug: string; timeZone: string };
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  request: Request;
  listLocations: string;
  publicSlug: string;
};

type FlowResult = {
  handled: boolean;
  reply?: string;
  nextStatus?: string;
  nextAction?: FlowAction;
};

function formatYmdRu(ymd: string | null | undefined) {
  if (!ymd) return '—';
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatTimesShort(times: string[], limit: number | null = 12) {
  if (!times.length) return "";
  if (limit == null || limit <= 0) return times.join(", ");
  const head = times.slice(0, limit);
  const rest = Math.max(0, times.length - head.length);
  return rest > 0 ? `${head.join(", ")} (+еще ${rest})` : head.join(", ");
}

function addDaysYmd(ymd: string, days: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function bookingUrl(publicSlug: string, d: DraftLike) {
  const u = new URL(`/${publicSlug}/booking`, "http://x");
  if (d.locationId) u.searchParams.set("locationId", String(d.locationId));
  if (d.serviceId) u.searchParams.set("serviceId", String(d.serviceId));
  if (d.specialistId) u.searchParams.set("specialistId", String(d.specialistId));
  if (d.date) u.searchParams.set("date", d.date);
  if (d.time) u.searchParams.set("time", d.time);
  u.searchParams.set("scenario", "specialistFirst");
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function isAffirmative(t: string) {
  return /^(?:\u0434\u0430|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e|\u0441\u043e\u0433\u043b\u0430\u0441\u0435\u043d|\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u0430|\u043e\u043a|\u043e\u043a\u0435\u0439)$/iu.test(
    t.trim(),
  );
}

function wantsNewBooking(messageNorm: string) {
  return /(новая запись|запиши еще|еще запись|запиши меня|хочу записаться|повторная запись)/i.test(messageNorm);
}

function isGratitudeOrPostCompletion(messageNorm: string) {
  return /(спасибо|благодарю|отлично|супер|понял|поняла|окей|ок)/i.test(messageNorm);
}

function wantsChange(messageNorm: string) {
  return /(?:\u043d\u0435 \u0442\u043e|\u043d\u0435\u0432\u0435\u0440\u043d\u043e|\u0438\u0437\u043c\u0435\u043d\u0438|\u0434\u0440\u0443\u0433\u043e\u0435|\u0434\u0440\u0443\u0433\u0443\u044e|\u043d\u0435 \u043d\u0430|\u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0438|\u0434\u0440\u0443\u0433\u043e\u0439)/iu.test(
    messageNorm,
  );
}

function shouldAskServiceClarification(messageNorm: string, services: ServiceLite[]) {
  if (!/(стриж|haircut)/i.test(messageNorm)) return false;
  const variants = services.filter((s) => /(men haircut|women haircut|муж|жен)/i.test(s.name));
  return variants.length > 1;
}

function detectTimePreference(messageNorm: string): "morning" | "day" | "evening" | null {
  if (
    /(?:\u0432\u0435\u0447\u0435\u0440|\u0432\u0435\u0447\u0435\u0440\u043e\u043c|\u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b|\u043f\u043e\u0441\u043b\u0435 \u043e\u0431\u0435\u0434\u0430|evening)/iu.test(
      messageNorm,
    )
  )
    return "evening";
  if (/(?:\u0443\u0442\u0440|\u0443\u0442\u0440\u043e\u043c|morning)/iu.test(messageNorm)) return "morning";
  if (/(?:\u0434\u043d\u0435\u043c|\u0434\u043d\u0451\u043c|\u0434\u0435\u043d\u044c|daytime)/iu.test(messageNorm)) return "day";
  return null;
}

function filterByPreference(times: string[], pref: "morning" | "day" | "evening" | null) {
  if (!pref) return times;
  return times.filter((tm) => {
    const [hh] = tm.split(":").map(Number);
    if (!Number.isFinite(hh)) return false;
    if (pref === "morning") return hh < 12;
    if (pref === "day") return hh >= 12 && hh < 17;
    return hh >= 17;
  });
}

function wantsNextDateStep(messageNorm: string) {
  return /^(давай|дальше|далее|следующий|следующую|еще|ещё|да)\b/i.test(messageNorm);
}

function asksAboutSpecialists(messageNorm: string) {
  return /(?:\u0443 \u043a\u0430\u043a\u0438\u0445 \u043c\u0430\u0441\u0442|\u043a\u0430\u043a\u0438\u0435 \u043c\u0430\u0441\u0442|\u043a\u0430\u043a\u043e\u0439 \u043c\u0430\u0441\u0442\u0435\u0440|\u043a\u0430\u043a\u0438\u0435 \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442\u044b|\u043a\u0430\u043a\u043e\u0439 \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442|\u043c\u0430\u0441\u0442\u0435\u0440(?:\u0430|\u044b)?|\u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442(?:\u0430|\u044b)?)/iu.test(
    messageNorm,
  );
}

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function specialistByText(messageNorm: string, specs: SpecialistLite[]) {
  const t = normalizeText(messageNorm);
  if (!t) return null;
  if (/\b(любой|кто угодно|не важно|неважно)\b/i.test(t)) return specs[0] ?? null;

  const direct = specs.find((s) => t.includes(normalizeText(s.name)));
  if (direct) return direct;

  // Fallback by first/last name fragment from button text.
  const byToken = specs.find((s) => {
    const parts = normalizeText(s.name).split(" ").filter(Boolean);
    return parts.some((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`, "i").test(t));
  });
  return byToken ?? null;
}

function serviceListAtTimeText(args: {
  services: ServiceLite[];
  specialists: SpecialistLite[];
  serviceIds: number[];
  specialistIdsByService: Map<number, number[]>;
  limit?: number;
}) {
  const { services, specialists, serviceIds, specialistIdsByService, limit = 12 } = args;
  const rows = services.filter((x) => serviceIds.includes(x.id)).slice(0, limit);
  return rows
    .map((service, i) => {
      const spIds = specialistIdsByService.get(service.id) ?? [];
      const eff = spIds
        .map((id) => specialists.find((s) => s.id === id) ?? null)
        .map((sp) => getEffectiveServiceForSpecialist(service, sp))
        .filter((x) => Number.isFinite(x.price) && Number.isFinite(x.durationMin));
      if (!eff.length) return `${i + 1}. ${service.name} — ${Math.round(service.basePrice)} ₽, ${service.baseDurationMin} мин`;
      const minPrice = Math.min(...eff.map((x) => x.price));
      const maxPrice = Math.max(...eff.map((x) => x.price));
      const minDur = Math.min(...eff.map((x) => x.durationMin));
      const maxDur = Math.max(...eff.map((x) => x.durationMin));
      const priceText = minPrice === maxPrice ? `${Math.round(minPrice)} ₽` : `${Math.round(minPrice)}–${Math.round(maxPrice)} ₽`;
      const durText = minDur === maxDur ? `${minDur} мин` : `${minDur}–${maxDur} мин`;
      return `${i + 1}. ${service.name} — ${priceText}, ${durText}`;
    })
    .join("\n");
}

async function getActuallyAvailableServiceIdsAtTime(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  date: string;
  time: string;
  candidateServiceIds: number[];
  specialists: SpecialistLite[];
}) {
  const { origin, accountSlug, locationId, date, time, candidateServiceIds, specialists } = args;
  const checks = await Promise.all(
    candidateServiceIds.map(async (serviceId) => {
      const d: DraftLike = {
        locationId,
        serviceId,
        specialistId: null,
        date,
        time,
        clientName: null,
        clientPhone: null,
        mode: null,
        status: "COLLECTING",
        consentConfirmedAt: null,
      };
      const specs = await specialistsForSlot(origin, accountSlug, d, specialists);
      return { serviceId, ok: specs.length > 0 };
    }),
  );
  return checks.filter((x) => x.ok).map((x) => x.serviceId);
}

async function collectLocationWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  date: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
  limit?: number | null;
}) {
  const { origin, accountSlug, locations, date, serviceId, preference, limit = 30 } = args;
  const rows: Array<{ locationId: number; name: string; times: string[] }> = [];
  for (const loc of locations) {
    const offers = await getOffers(origin, accountSlug, loc.id, date);
    const base = serviceId
      ? (offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === serviceId))
      : offers?.times ?? [];
    const all = Array.from(new Set(base.map((x) => x.time)));
    const filtered = filterByPreference(all, preference);
    const times = limit == null || limit <= 0 ? filtered : filtered.slice(0, limit);
    if (times.length) rows.push({ locationId: loc.id, name: loc.name, times });
  }
  return rows;
}

async function findNearestLocationWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  fromDate: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
  daysAhead?: number;
  limit?: number | null;
}) {
  const { origin, accountSlug, locations, fromDate, serviceId, preference, daysAhead = 14, limit = 30 } = args;
  const [yy, mm, dd] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
  for (let i = 0; i < daysAhead; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    const rows = await collectLocationWindows({
      origin,
      accountSlug,
      locations,
      date: ymd,
      serviceId,
      preference,
      limit,
    });
    if (rows.length) return { date: ymd, rows };
  }
  return null;
}

function applyChangeRollback(messageNorm: string, d: DraftLike) {
  if (/(локац|филиал|адрес)/i.test(messageNorm)) {
    d.locationId = null;
    d.specialistId = null;
    d.time = null;
  }
  if (/(услуг|маник|педик|стриж|гель|окраш|facial|peeling|hair)/i.test(messageNorm)) {
    d.serviceId = null;
    d.specialistId = null;
    d.time = null;
  }
  if (/(дата|день|завтра|сегодня|числ|марта|февраля|января|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(messageNorm)) {
    d.date = null;
    d.time = null;
    d.specialistId = null;
  }
  if (/(время|час|утр|вечер|днем|днём|:\d{2}|\d{1,2}[.]\d{2})/i.test(messageNorm)) {
    d.time = null;
    d.specialistId = null;
  }
  if (/(мастер|специалист|к [а-яa-z]+$)/i.test(messageNorm)) {
    d.specialistId = null;
  }
  d.mode = null;
  d.consentConfirmedAt = null;
}

export async function runBookingFlow(ctx: FlowCtx): Promise<FlowResult> {
  const {
    d,
    messageNorm,
    bookingIntent,
    asksAvailability,
    origin,
    account,
    locations,
    services,
    specialists,
    requiredVersionIds,
    request,
    choice,
    listLocations,
    publicSlug,
  } = ctx;
  const hasContext = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode);
  if (!bookingIntent && !hasContext && d.status !== "COMPLETED") return { handled: false };
  const wantsAllTimes =
    /(?:покажи|напиши|выведи|дай)\s+в[сc]е\s+(?:врем|слот|окошк)|(?:в[сc]е|полный)\s+список\s+(?:врем|слот|окошк)|все\s+свободн(?:ое|ые)?\s+время|целиком|полностью/iu.test(
      messageNorm,
    );
  const wantsMoreTimes =
    /(?:покажи|дай|выведи)\s+ещ[её](?:\s+\p{L}+){0,3}\s+(?:врем|слот|окошк)|ещ[её]\s+(?:свободн(?:ое|ые)?\s+)?время/iu.test(
      messageNorm,
    );
  const timeLimit = wantsAllTimes || wantsMoreTimes ? null : 12;

  let nextStatus = (d.status || "COLLECTING") as BookingState;
  let nextAction: FlowAction = null;

  if (d.status === "COMPLETED" && !bookingIntent) {
    if (isGratitudeOrPostCompletion(messageNorm)) {
      return { handled: true, reply: "Пожалуйста. Если захотите новую запись, напишите услугу, дату и время." };
    }
    if (wantsNewBooking(messageNorm)) {
      nextStatus = "COLLECTING";
      d.locationId = null;
      d.serviceId = null;
      d.specialistId = null;
      d.date = null;
      d.time = null;
      d.mode = null;
      d.consentConfirmedAt = null;
    } else {
      return { handled: true, reply: "Запись уже оформлена. Для новой записи напишите: «новая запись»." };
    }
  }
  if (d.status === "COMPLETED" && bookingIntent && wantsNewBooking(messageNorm)) {
    nextStatus = "COLLECTING";
    d.locationId = null;
    d.serviceId = null;
    d.specialistId = null;
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
  }

  if (wantsChange(messageNorm) && hasContext && d.status !== "COMPLETED") {
    applyChangeRollback(messageNorm, d);
    nextStatus = "COLLECTING";
  }

  if (d.locationId && d.serviceId && d.date && d.time) nextStatus = "CHECKING";

  if (!d.locationId) {
    if (asksAboutSpecialists(messageNorm) && d.date) {
      const specByLocation = locations
        .map((loc) => {
          const items = specialists.filter((s) => s.locationIds.includes(loc.id)).slice(0, 6);
          return { loc, items };
        })
        .filter((x) => x.items.length > 0);
      if (specByLocation.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} специалисты по филиалам:\n${specByLocation
            .map((x, i) => `${i + 1}. ${x.loc.name}: ${x.items.map((s) => s.name).join(", ")}`)
            .join("\n")}\nЕсли нужно, уточню по конкретной услуге и времени.`,
          nextStatus: "COLLECTING",
        };
      }
    }
    if (d.date || asksAvailability || d.serviceId) {
      let targetDate = d.date ?? new Date().toISOString().slice(0, 10);
      if (wantsNextDateStep(messageNorm) && d.date) {
        targetDate = addDaysYmd(d.date, 1);
        d.date = targetDate;
      }
      const targetDateRu = formatYmdRu(targetDate);
      const pref = detectTimePreference(messageNorm);
      const rows = await collectLocationWindows({
        origin,
        accountSlug: account.slug,
        locations,
        date: targetDate,
        serviceId: d.serviceId,
        preference: pref,
        limit: timeLimit,
      });
      if (d.time) {
        let resolvedLocationFromTime = false;
        const rowsAtTime = rows.filter((x) => x.times.includes(d.time!));
        if (rowsAtTime.length === 1) {
          d.locationId = rowsAtTime[0]!.locationId;
          nextStatus = "COLLECTING";
          resolvedLocationFromTime = true;
        } else if (rowsAtTime.length > 1) {
          return {
            handled: true,
            reply: `На ${targetDateRu} в ${d.time} есть окна в филиалах:\n${rowsAtTime
              .map((x, i) => `${i + 1}. ${x.name}`)
              .join("\n")}\nВыберите филиал кнопкой ниже или напишите название.`,
            nextStatus: "COLLECTING",
          };
        } else if (rows.length) {
          return {
            handled: true,
            reply: `На ${targetDateRu} в ${d.time} свободных окон не нашла. Доступные времена:\n${rows
              .map((x, i) => `${i + 1}. ${x.name}: ${formatTimesShort(x.times, wantsAllTimes ? null : 10)}`)
              .join("\n")}`,
            nextStatus: "COLLECTING",
          };
        }
        if (resolvedLocationFromTime) {
          if (!d.serviceId) {
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            const rawServiceIds = offerAtTime?.services.map((x) => x.serviceId) ?? [];
            const serviceIds = await getActuallyAvailableServiceIdsAtTime({
              origin,
              accountSlug: account.slug,
              locationId: d.locationId!,
              date: targetDate,
              time: d.time!,
              candidateServiceIds: rawServiceIds,
              specialists,
            });
            const specialistIdsByService = new Map<number, number[]>(
              (offerAtTime?.services ?? []).map((x) => [x.serviceId, x.specialistIds ?? []]),
            );
            const scopedAtLoc = services.filter((svc) => svc.locationIds.includes(d.locationId!));
            if (serviceIds.length) {
              return {
                handled: true,
                reply: `На ${targetDateRu} в ${d.time} доступны услуги:\n${serviceListAtTimeText({
                  services: scopedAtLoc,
                  specialists,
                  serviceIds,
                  specialistIdsByService,
                  limit: 10,
                })}\nВыберите услугу кнопкой ниже или напишите название.`,
                nextStatus: "COLLECTING",
              };
            }
          }
          if (d.serviceId) {
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            const serviceIds = offerAtTime?.services.map((x) => x.serviceId) ?? [];
            if (!serviceIds.includes(d.serviceId)) {
              const candidateTimes = Array.from(
                new Set((offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === d.serviceId)).map((x) => x.time)),
              );
              if (candidateTimes.length) {
                return {
                  handled: true,
                  reply: `На ${d.time} выбранная услуга недоступна в ${locations.find((x) => x.id === d.locationId)?.name ?? "этой локации"}. Ближайшие времена: ${candidateTimes
                    .slice(0, 8)
                    .join(", ")}.`,
                  nextStatus: "COLLECTING",
                };
              }
            }
          }
        }
      }
      if (rows.length) {
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        return {
          handled: true,
          reply: `Нашла окна на ${targetDateRu}${prefText} в филиалах:\n${rows
            .map((x, i) => `${i + 1}. ${x.name}: ${formatTimesShort(x.times, timeLimit)}`)
            .join("\n")}\nМожно выбрать филиал кнопкой ниже, либо сразу написать время и филиал.`,
          nextStatus: "COLLECTING",
        };
      }
      const nearest = await findNearestLocationWindows({
        origin,
        accountSlug: account.slug,
        locations,
        fromDate: targetDate,
        serviceId: d.serviceId ?? null,
        preference: pref,
        limit: timeLimit,
      });
      if (nearest) {
        return {
          handled: true,
          reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Ближайшие варианты на ${
            formatYmdRu(nearest.date)
          }:\n${nearest.rows
            .map((x, i) => `${i + 1}. ${x.name}: ${formatTimesShort(x.times, timeLimit)}`)
            .join("\n")}\nМожно выбрать филиал кнопкой ниже, либо сразу написать время и филиал.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу проверить другую дату.`,
        nextStatus: "COLLECTING",
      };
    }
    return { handled: true, reply: `Выберите локацию, и продолжу запись.\n${listLocations}`, nextStatus: "COLLECTING" };
  }

  const scopedServices = services.filter((x) => x.locationIds.includes(d.locationId!));
  if (!d.serviceId) {
    if (d.date && d.time) {
      const offers = await getOffers(origin, account.slug, d.locationId!, d.date);
      const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
      if (!offerAtTime || !offerAtTime.services.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${d.time} нет доступных услуг в этой локации. Укажите другое время.`,
          nextStatus: "COLLECTING",
        };
      }
      const rawServiceIds = offerAtTime.services.map((x) => x.serviceId);
      const serviceIds = await getActuallyAvailableServiceIdsAtTime({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId!,
        date: d.date,
        time: d.time,
        candidateServiceIds: rawServiceIds,
        specialists,
      });
      if (!serviceIds.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${d.time} нет доступных услуг с учетом длительности и графика специалистов. Укажите другое время.`,
          nextStatus: "COLLECTING",
        };
      }
      const specialistIdsByService = new Map<number, number[]>(
        offerAtTime.services.map((x) => [x.serviceId, x.specialistIds ?? []]),
      );
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${d.time} доступны услуги:\n${serviceListAtTimeText({
          services: scopedServices,
          specialists,
          serviceIds,
          specialistIdsByService,
          limit: 10,
        })}\nВыберите услугу кнопкой ниже или напишите название.`,
        nextStatus: "COLLECTING",
      };
    }
    if (asksAboutSpecialists(messageNorm) && d.date) {
      const availableByLocation = specialists.filter((s) => s.locationIds.includes(d.locationId!));
      if (availableByLocation.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} работают специалисты: ${availableByLocation
            .slice(0, 12)
            .map((x) => x.name)
            .join(", ")}. Могу проверить точные окна по конкретной услуге или мастеру.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} по этой локации не нашла специалистов в расписании. Могу проверить другую дату или локацию.`,
        nextStatus: "COLLECTING",
      };
    }
    if (asksAvailability && d.date) {
      const offers = await getOffers(origin, account.slug, d.locationId!, d.date);
      const allTimes = Array.from(new Set((offers?.times ?? []).map((x) => x.time)));
      const pref = detectTimePreference(messageNorm);
      const times = filterByPreference(allTimes, pref).slice(0, 30);
      if (times.length) {
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)}${prefText} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} есть окна: ${formatTimesShort(times, timeLimit)}. Можете выбрать время, а затем услугу.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу показать другой период или подобрать по услуге.`,
        nextStatus: "COLLECTING",
      };
    }
    if (shouldAskServiceClarification(messageNorm, scopedServices)) {
      const haircutOptions = scopedServices.filter((x) => /(стриж|haircut)/i.test(x.name));
      return {
        handled: true,
        reply: `Уточните услугу:\n${serviceListText(haircutOptions, 8)}\nМожно выбрать кнопкой ниже или написать названием.`,
        nextStatus: "COLLECTING",
      };
    }
    return {
      handled: true,
      reply: `Выберите услугу, и продолжу запись.\n${serviceListText(scopedServices, 10)}`,
      nextStatus: "COLLECTING",
    };
  }

  if (!d.date) {
    return {
      handled: true,
      reply: "Напишите дату: например «завтра», «27 февраля» или «в субботу».",
      nextStatus: "COLLECTING",
    };
  }

  if (!d.time) {
    const times = await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date);
    if (!times.length) {
      return { handled: true, reply: `На ${formatYmdRu(d.date)} свободных окон по этой услуге не нашла. Укажите другую дату.`, nextStatus: "COLLECTING" };
    }
    return {
      handled: true,
      reply: `На ${formatYmdRu(d.date)} доступны времена: ${formatTimesShort(times, timeLimit)}. Выберите время.`,
      nextStatus: "COLLECTING",
    };
  }

  if (!d.specialistId) {
    const offers = await getOffers(origin, account.slug, d.locationId!, d.date!);
    const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
    const offerService = offerAtTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
    let specs =
      offerService?.specialistIds?.length
        ? specialists.filter((s) => offerService.specialistIds!.includes(s.id))
        : [];
    if (!specs.length) {
      specs = await specialistsForSlot(origin, account.slug, d, specialists);
    }
    if (!specs.length) {
      const offerTimesForService = Array.from(
        new Set(
          (offers?.times ?? [])
            .filter((t) => t.services.some((s) => s.serviceId === d.serviceId && (s.specialistIds?.length ?? 0) > 0))
            .map((t) => t.time),
        ),
      );
      const times = offerTimesForService.length
        ? offerTimesForService
        : await getSlots(origin, account.slug, d.locationId!, d.serviceId!, d.date!);
      const suggestedTimes = times.filter((tm) => tm !== d.time).slice(0, 8);
      if (times.length) {
        const serviceName = services.find((x) => x.id === d.serviceId)?.name ?? "выбранная услуга";
        return {
          handled: true,
          reply:
            offerService == null
              ? `На ${d.time} услуга «${serviceName}» недоступна. Ближайшие времена: ${(suggestedTimes.length ? suggestedTimes : times.slice(0, 8)).join(", ")}.`
              : `На ${d.time} свободных специалистов нет. Ближайшие времена: ${(suggestedTimes.length ? suggestedTimes : times.slice(0, 8)).join(", ")}.`,
          nextStatus: "COLLECTING",
        };
      }
      return { handled: true, reply: "На выбранную дату слотов нет. Укажите другую дату.", nextStatus: "COLLECTING" };
    }
    const byText = specialistByText(messageNorm, specs);
    if (byText) {
      d.specialistId = byText.id;
    } else if (choice && choice >= 1 && choice <= specs.length) {
      d.specialistId = specs[choice - 1]!.id;
    } else if (specs.length === 1) {
      d.specialistId = specs[0]!.id;
    } else {
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${d.time} доступны специалисты:\n${specs
          .map((x, i) => `${i + 1}. ${x.name}`)
          .join("\n")}\nВыберите специалиста кнопкой ниже или напишите «любой».`,
        nextStatus: "CHECKING",
      };
    }
  }

  if (!d.mode) {
    const selectedService = services.find((x) => x.id === d.serviceId) ?? null;
    const selectedSpecialist = specialists.find((x) => x.id === d.specialistId) ?? null;
    const effective = selectedService ? getEffectiveServiceForSpecialist(selectedService, selectedSpecialist) : null;
    const effectiveText = effective ? `\nСтоимость: ${Math.round(effective.price)} ₽\nДлительность: ${effective.durationMin} мин` : "";
    return {
      handled: true,
      reply: `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}${effectiveText}\n\nКак завершим запись?\n1) Сам в форме онлайн-записи.\n2) Оформить через ассистента.`,
      nextStatus: "CHECKING",
    };
  }

  if (d.mode === "SELF") {
    nextStatus = "READY_SELF";
    nextAction = { type: "open_booking", bookingUrl: bookingUrl(publicSlug, d) };
    return {
      handled: true,
      nextStatus,
      nextAction,
      reply: "Открываю онлайн-запись с подставленными параметрами.",
    };
  }

  if (!d.clientName || !d.clientPhone) {
    return { handled: true, reply: "Для оформления через ассистента напишите имя и номер телефона клиента.", nextStatus: "WAITING_CONSENT" };
  }

  if (!d.consentConfirmedAt) {
    const links = requiredVersionIds.map((id) => `/${publicSlug}/legal/${id}`).join("\n");
    return {
      handled: true,
      reply: `Для оформления нужно согласие на обработку персональных данных.\n${links || "Документы не настроены"}\nНапишите: «Согласен на обработку персональных данных».`,
      nextStatus: "WAITING_CONSENT",
    };
  }

  if (!isAffirmative(messageNorm)) {
    nextStatus = "WAITING_CONFIRMATION";
    return {
      handled: true,
      nextStatus,
      reply: `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}\nКлиент: ${d.clientName} ${d.clientPhone}\nЕсли все верно, напишите «да».`,
    };
  }

  const created = await createAssistantBooking({
    d,
    accountId: account.id,
    accountTz: account.timeZone,
    requiredVersionIds,
    request,
    services,
  });
  if (!created.ok) {
    if (created.code === "slot_busy") return { handled: true, reply: "Этот слот уже занят. Выберите другое время.", nextStatus: "COLLECTING" };
    if (created.code === "outside_working_hours") return { handled: true, reply: "Время вне графика. Выберите другой слот.", nextStatus: "COLLECTING" };
    if (created.code === "combo_unavailable") return { handled: true, reply: "Эта комбинация локации/услуги/специалиста недоступна.", nextStatus: "COLLECTING" };
    return { handled: true, reply: "Некорректная дата/время для записи.", nextStatus: "COLLECTING" };
  }

  nextStatus = "COMPLETED";
  return {
    handled: true,
    nextStatus,
    reply: `Запись оформлена.\n${bookingSummary(d, locations, services, specialists)}\nНомер записи: ${created.appointmentId}.`,
  };
}


