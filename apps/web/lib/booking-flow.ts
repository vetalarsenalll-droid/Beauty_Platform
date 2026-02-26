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

function bookingUrl(publicSlug: string, d: DraftLike) {
  const u = new URL(`/${publicSlug}/booking`, "http://x");
  if (d.locationId) u.searchParams.set("locationId", String(d.locationId));
  if (d.serviceId) u.searchParams.set("serviceId", String(d.serviceId));
  if (d.specialistId) u.searchParams.set("specialistId", String(d.specialistId));
  if (d.date) u.searchParams.set("date", d.date);
  if (d.time) u.searchParams.set("time", d.time.replace(":", "%3A"));
  u.searchParams.set("scenario", "specialistFirst");
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function isAffirmative(t: string) {
  return /^(да|подтверждаю|согласен|ок)$/i.test(t.trim());
}

function wantsNewBooking(messageNorm: string) {
  return /(новая запись|запиши еще|еще запись|запиши меня|хочу записаться|повторная запись)/i.test(messageNorm);
}

function isGratitudeOrPostCompletion(messageNorm: string) {
  return /(спасибо|благодарю|отлично|супер|понял|поняла|окей|ок)/i.test(messageNorm);
}

function wantsChange(messageNorm: string) {
  return /(не то|неверно|измени|измени|другое|другую|хочу на|не на|перенеси|другой)/i.test(messageNorm);
}

function shouldAskServiceClarification(messageNorm: string, services: ServiceLite[]) {
  if (!/(стриж|haircut)/i.test(messageNorm)) return false;
  const variants = services.filter((s) => /(men haircut|women haircut|муж|жен)/i.test(s.name));
  return variants.length > 1;
}

function detectTimePreference(messageNorm: string): "morning" | "day" | "evening" | null {
  if (/(вечер|вечером|после работы|после обеда|evening)/i.test(messageNorm)) return "evening";
  if (/(утр|утром|morning)/i.test(messageNorm)) return "morning";
  if (/(днем|днём|день|daytime)/i.test(messageNorm)) return "day";
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

function asksAboutSpecialists(messageNorm: string) {
  return /(у каких маст|какие маст|какой мастер|какие специалисты|какой специалист|мастер(а|ы)?|специалист(а|ы)?)/i.test(
    messageNorm,
  );
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

async function collectLocationWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  date: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
}) {
  const { origin, accountSlug, locations, date, serviceId, preference } = args;
  const rows: Array<{ locationId: number; name: string; times: string[] }> = [];
  for (const loc of locations) {
    const offers = await getOffers(origin, accountSlug, loc.id, date);
    const base = serviceId
      ? (offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === serviceId))
      : offers?.times ?? [];
    const all = Array.from(new Set(base.map((x) => x.time)));
    const times = filterByPreference(all, preference).slice(0, 30);
    if (times.length) rows.push({ locationId: loc.id, name: loc.name, times });
  }
  return rows;
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
    if (d.date || asksAvailability) {
      const targetDate = d.date ?? new Date().toISOString().slice(0, 10);
      const pref = detectTimePreference(messageNorm);
      const rows = await collectLocationWindows({
        origin,
        accountSlug: account.slug,
        locations,
        date: targetDate,
        serviceId: d.serviceId,
        preference: pref,
      });
      if (d.time) {
        const rowsAtTime = rows.filter((x) => x.times.includes(d.time!));
        if (rowsAtTime.length === 1) {
          d.locationId = rowsAtTime[0]!.locationId;
          nextStatus = "COLLECTING";
        } else if (rowsAtTime.length > 1) {
          return {
            handled: true,
            reply: `На ${targetDate} в ${d.time} есть окна в филиалах:\n${rowsAtTime
              .map((x, i) => `${i + 1}. ${x.name}`)
              .join("\n")}\nВыберите филиал названием или номером.`,
            nextStatus: "COLLECTING",
          };
        } else if (rows.length) {
          return {
            handled: true,
            reply: `На ${targetDate} в ${d.time} свободных окон не нашла. Доступные времена:\n${rows
              .map((x, i) => `${i + 1}. ${x.name}: ${x.times.slice(0, 10).join(", ")}`)
              .join("\n")}`,
            nextStatus: "COLLECTING",
          };
        }
      }
      if (rows.length) {
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        return {
          handled: true,
          reply: `Нашла окна на ${targetDate}${prefText} в филиалах:\n${rows
            .map((x, i) => `${i + 1}. ${x.name}: ${x.times.slice(0, 12).join(", ")}`)
            .join("\n")}\nМожно выбрать филиал названием/цифрой, либо сразу написать время и филиал.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${targetDate}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу проверить другую дату.`,
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
          reply: `На ${d.date} в ${d.time} нет доступных услуг в этой локации. Укажите другое время.`,
          nextStatus: "COLLECTING",
        };
      }
      const serviceIds = offerAtTime.services.map((x) => x.serviceId);
      const specialistIdsByService = new Map<number, number[]>(
        offerAtTime.services.map((x) => [x.serviceId, x.specialistIds ?? []]),
      );
      return {
        handled: true,
        reply: `На ${d.date} в ${d.time} доступны услуги:\n${serviceListAtTimeText({
          services: scopedServices,
          specialists,
          serviceIds,
          specialistIdsByService,
          limit: 10,
        })}\nВыберите услугу номером или названием.`,
        nextStatus: "COLLECTING",
      };
    }
    if (asksAboutSpecialists(messageNorm) && d.date) {
      const availableByLocation = specialists.filter((s) => s.locationIds.includes(d.locationId!));
      if (availableByLocation.length) {
        return {
          handled: true,
          reply: `На ${d.date} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} работают специалисты: ${availableByLocation
            .slice(0, 12)
            .map((x) => x.name)
            .join(", ")}. Могу проверить точные окна по конкретной услуге или мастеру.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${d.date} по этой локации не нашла специалистов в расписании. Могу проверить другую дату или локацию.`,
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
          reply: `На ${d.date}${prefText} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} есть окна: ${times.join(", ")}. Можете выбрать время, а затем услугу.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${d.date}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу показать другой период или подобрать по услуге.`,
        nextStatus: "COLLECTING",
      };
    }
    if (shouldAskServiceClarification(messageNorm, scopedServices)) {
      const haircutOptions = scopedServices.filter((x) => /(стриж|haircut)/i.test(x.name));
      return {
        handled: true,
        reply: `Уточните услугу:\n${serviceListText(haircutOptions, 8)}\nМожно выбрать номером или названием.`,
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
      return { handled: true, reply: `На ${d.date} свободных окон по этой услуге не нашла. Укажите другую дату.`, nextStatus: "COLLECTING" };
    }
    return {
      handled: true,
      reply: `На ${d.date} доступны времена: ${times.slice(0, 30).join(", ")}. Выберите время.`,
      nextStatus: "COLLECTING",
    };
  }

  if (!d.specialistId) {
    const specs = await specialistsForSlot(origin, account.slug, d, specialists);
    if (!specs.length) {
      const times = await getSlots(origin, account.slug, d.locationId!, d.serviceId!, d.date!);
      if (times.length) {
        return {
          handled: true,
          reply: `На ${d.time} свободных специалистов нет. Ближайшие времена: ${times.slice(0, 8).join(", ")}.`,
          nextStatus: "COLLECTING",
        };
      }
      return { handled: true, reply: "На выбранную дату слотов нет. Укажите другую дату.", nextStatus: "COLLECTING" };
    }
    if (choice && choice >= 1 && choice <= specs.length) {
      d.specialistId = specs[choice - 1]!.id;
    } else if (specs.length === 1) {
      d.specialistId = specs[0]!.id;
    } else {
      return {
        handled: true,
        reply: `На ${d.date} в ${d.time} доступны специалисты:\n${specs
          .map((x, i) => `${i + 1}. ${x.name}`)
          .join("\n")}\nВыберите специалиста номером или напишите «любой».`,
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
