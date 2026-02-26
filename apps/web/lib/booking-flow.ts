import {
  bookingSummary,
  createAssistantBooking,
  DraftLike,
  getOffers,
  getSlots,
  LocationLite,
  serviceListText,
  ServiceLite,
  specialistsForSlot,
  SpecialistLite,
} from "@/lib/booking-tools";

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

function shouldAskServiceClarification(messageNorm: string, services: ServiceLite[]) {
  if (!/(стриж|haircut)/i.test(messageNorm)) return false;
  const variants = services.filter((s) => /(men haircut|women haircut|муж|жен)/i.test(s.name));
  return variants.length > 1;
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
  const hasContext =
    Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode) &&
    d.status !== "COMPLETED";
  if (!bookingIntent && !hasContext && d.status !== "COMPLETED") return { handled: false };

  let nextStatus = d.status;
  let nextAction: FlowAction = null;

  if (d.status === "COMPLETED" && !bookingIntent) {
    return { handled: true, reply: "Запись уже оформлена. Если хотите новую, напишите дату/услугу/время." };
  }
  if (d.status === "COMPLETED" && bookingIntent) {
    nextStatus = "COLLECTING";
    d.locationId = null;
    d.serviceId = null;
    d.specialistId = null;
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
  }

  if (!d.locationId) {
    return { handled: true, reply: `Выберите локацию, и продолжу запись.\n${listLocations}`, nextStatus };
  }

  const scopedServices = services.filter((x) => x.locationIds.includes(d.locationId!));
  if (!d.serviceId) {
    if (shouldAskServiceClarification(messageNorm, scopedServices)) {
      const haircutOptions = scopedServices.filter((x) => /(стриж|haircut)/i.test(x.name));
      return {
        handled: true,
        reply: `Уточните услугу:\n${serviceListText(haircutOptions, 8)}\nМожно выбрать номером или названием.`,
        nextStatus,
      };
    }
    return {
      handled: true,
      reply: `Выберите услугу, и продолжу запись.\n${serviceListText(scopedServices, 10)}`,
      nextStatus,
    };
  }

  if (!d.date) {
    return {
      handled: true,
      reply: "Напишите дату: например «завтра», «27 февраля» или «в субботу».",
      nextStatus,
    };
  }

  if (!d.time) {
    const times = await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date);
    if (!times.length) {
      return { handled: true, reply: `На ${d.date} свободных окон по этой услуге не нашла. Укажите другую дату.`, nextStatus };
    }
    return {
      handled: true,
      reply: `На ${d.date} доступны времена: ${times.slice(0, 30).join(", ")}. Выберите время.`,
      nextStatus,
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
          nextStatus,
        };
      }
      return { handled: true, reply: "На выбранную дату слотов нет. Укажите другую дату.", nextStatus };
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
        nextStatus,
      };
    }
  }

  if (!d.mode) {
    return {
      handled: true,
      reply: `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}\n\nКак завершим запись?\n1) Сам в форме онлайн-записи.\n2) Оформить через ассистента.`,
      nextStatus,
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
    return { handled: true, reply: "Для оформления через ассистента напишите имя и номер телефона клиента.", nextStatus };
  }

  if (!d.consentConfirmedAt) {
    const links = requiredVersionIds.map((id) => `/${publicSlug}/legal/${id}`).join("\n");
    return {
      handled: true,
      reply: `Для оформления нужно согласие на обработку персональных данных.\n${links || "Документы не настроены"}\nНапишите: «Согласен на обработку персональных данных».`,
      nextStatus,
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
    if (created.code === "slot_busy") return { handled: true, reply: "Этот слот уже занят. Выберите другое время.", nextStatus };
    if (created.code === "outside_working_hours") return { handled: true, reply: "Время вне графика. Выберите другой слот.", nextStatus };
    if (created.code === "combo_unavailable") return { handled: true, reply: "Эта комбинация локации/услуги/специалиста недоступна.", nextStatus };
    return { handled: true, reply: "Некорректная дата/время для записи.", nextStatus };
  }

  nextStatus = "COMPLETED";
  return {
    handled: true,
    nextStatus,
    reply: `Запись оформлена.\n${bookingSummary(d, locations, services, specialists)}\nНомер записи: ${created.appointmentId}.`,
  };
}
