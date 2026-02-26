import {
  cancelClientBooking,
  findLatestUpcomingBooking,
  getBookingPolicy,
  getClientBookings,
  getClientStats,
  rescheduleClientBooking,
  updateClientPhone,
} from "@/lib/client-account-tools";
import { zonedTimeToUtc } from "@/lib/public-booking";

type FlowResult = { handled: boolean; reply?: string };

type ClientFlowArgs = {
  message: string;
  messageNorm: string;
  accountId: number;
  accountTimeZone: string;
  clientId: number | null;
  authMode?: "full" | "thread_only";
};

const has = (m: string, r: RegExp) => r.test(m);

function parsePhone(message: string) {
  const s = message.match(/(?:\+7|8)\D*(?:\d\D*){10}/)?.[0] ?? "";
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+${d}`;
  if (d.length === 10) return `+7${d}`;
  return null;
}

function parseAppointmentId(messageNorm: string) {
  const explicitHash = messageNorm.match(/#\s*(\d{1,8})\b/);
  if (explicitHash) {
    const n = Number(explicitHash[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  const explicitWord = messageNorm.match(/\b(?:запис[ьи]|запись|номер|id)\s*#?\s*(\d{1,8})\b/i);
  if (!explicitWord) return null;
  const n = Number(explicitWord[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function ymdFromDateInTz(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseRuDateToYmd(messageNorm: string, todayYmd: string) {
  if (/\b(сегодня|today)\b/i.test(messageNorm)) return todayYmd;
  if (/\b(завтра|tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 1);
  if (/\b(послезавтра|day after tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 2);

  const iso = messageNorm.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmDot = messageNorm.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (dmDot) {
    const day = String(Number(dmDot[1])).padStart(2, "0");
    const month = String(Number(dmDot[2])).padStart(2, "0");
    let year = dmDot[3] ? Number(dmDot[3]) : Number(todayYmd.slice(0, 4));
    if (year < 100) year += 2000;
    let candidate = `${year}-${month}-${day}`;
    if (!dmDot[3] && candidate < todayYmd) candidate = `${year + 1}-${month}-${day}`;
    return candidate;
  }

  const monthMap = new Map<string, string>([
    ["января", "01"],
    ["февраля", "02"],
    ["марта", "03"],
    ["апреля", "04"],
    ["мая", "05"],
    ["июня", "06"],
    ["июля", "07"],
    ["августа", "08"],
    ["сентября", "09"],
    ["октября", "10"],
    ["ноября", "11"],
    ["декабря", "12"],
  ]);
  const dmText = messageNorm.match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/i,
  );
  if (dmText) {
    const day = String(Number(dmText[1])).padStart(2, "0");
    const month = monthMap.get(dmText[2].toLowerCase()) ?? "01";
    let year = dmText[3] ? Number(dmText[3]) : Number(todayYmd.slice(0, 4));
    let candidate = `${year}-${month}-${day}`;
    if (!dmText[3] && candidate < todayYmd) candidate = `${year + 1}-${month}-${day}`;
    return candidate;
  }

  return null;
}

function parseTime(messageNorm: string) {
  const hhmm = messageNorm.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;

  const hourOnly = messageNorm.match(/\b(?:в|на|к)\s*([01]?\d|2[0-3])\b/i);
  if (hourOnly) return `${String(Number(hourOnly[1])).padStart(2, "0")}:00`;
  return null;
}

function parseDateTime(messageNorm: string, todayYmd: string) {
  const date = parseRuDateToYmd(messageNorm, todayYmd);
  const time = parseTime(messageNorm);
  if (!date || !time) return null;
  return { date, time };
}

function formatDateTimeInTz(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

function formatPolicyHoursHuman(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0 && remHours > 0) return `${days} дн ${remHours} ч`;
  if (days > 0) return `${days} дн`;
  return `${hours} ч`;
}

function parseRescheduleConfirm(text: string) {
  return text.match(
    /подтвержда[а-я]*\s+перенос\s*#?\s*(\d{1,8})\s+на\s+(\d{4}-\d{2}-\d{2})\s+([01]?\d|2[0-3])[:.]([0-5]\d)/i,
  );
}

export async function runClientAccountFlow(args: ClientFlowArgs): Promise<FlowResult> {
  const { message, messageNorm, accountId, accountTimeZone, clientId, authMode = "full" } = args;
  if (!clientId) return { handled: false };

  const todayYmd = ymdFromDateInTz(new Date(), accountTimeZone);

  const asksMyBookings = has(
    messageNorm,
    /(мои записи|моя запись|покажи мои записи|последняя запись|прошедш|история записей|какая у меня.*запись|какая запись|какие записи|что с моей записью|что по моей записи|ближайшая запись|предстоящая запись)/i,
  );
  const asksLatestSingle = has(messageNorm, /(какая последняя запись|последнюю покажи|последняя запись|последний визит)/i);
  const asksNearest = has(messageNorm, /(ближайш|предстоящ|следующ|скоро.*запись)/i);
  const asksPast = has(messageNorm, /(прошедш|прошлая|история)/i);

  const asksStats = has(messageNorm, /(моя статистика|статистика|сколько раз|сколько посещений|средний чек)/i);
  const asksCancel = has(
    messageNorm,
    /(отмени(ть)?( запись)?|отмена записи|cancel booking|можешь.*отменить|отмени (ее|её|эту|последнюю|ближайшую))/i,
  );
  const asksReschedule = has(
    messageNorm,
    /(перенеси(ть)?( запись)?|перезапиши|reschedule|можешь.*перенести|перенеси (ее|её|эту|последнюю|ближайшую))/i,
  );
  const asksRepeat = has(messageNorm, /(повтори прошлую запись|повтори запись|запиши как в прошлый раз)/i);
  const asksProfile = has(messageNorm, /(мои данные|мой телефон|смени телефон|обнови телефон|мой профиль)/i);

  const cancelConfirmId = messageNorm.match(/п?одтверждаю\s+отмену\s*#?\s*(\d{1,8})/i)?.[1];
  const cancelConfirmBare = has(messageNorm, /п?одтверждаю\s+отмену/i);
  const rescheduleConfirm = parseRescheduleConfirm(messageNorm);

  if (!asksMyBookings && !asksStats && !asksCancel && !asksReschedule && !asksRepeat && !asksProfile) {
    if (!cancelConfirmId && !cancelConfirmBare && !rescheduleConfirm) return { handled: false };
  }

  if (asksMyBookings) {
    const items = await getClientBookings({ accountId, clientId, limit: 20 });
    if (!items.length) return { handled: true, reply: "У вас пока нет записей." };

    const now = new Date();
    const past = items
      .filter((x) => x.startAt < now && x.status !== "CANCELLED")
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    const upcoming = items
      .filter((x) => x.startAt >= now && x.status !== "CANCELLED")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    if (asksNearest) {
      const near = upcoming[0];
      if (!near) return { handled: true, reply: "Ближайших предстоящих записей не нашла." };
      return {
        handled: true,
        reply: `Ближайшая запись: #${near.id} — ${formatDateTimeInTz(near.startAt, accountTimeZone)} — ${near.services[0]?.service.name ?? "Услуга"} — ${near.status}.`,
      };
    }

    if (asksLatestSingle || asksPast) {
      const last = past[0];
      if (!last) return { handled: true, reply: "Прошедших записей пока нет." };
      return {
        handled: true,
        reply: `Последняя прошедшая запись: #${last.id} — ${formatDateTimeInTz(last.startAt, accountTimeZone)} — ${last.services[0]?.service.name ?? "Услуга"} — ${last.status}.`,
      };
    }

    if (!asksNearest) {
      const near = upcoming[0];
      if (near) {
        return {
          handled: true,
          reply: `Ближайшая запись: #${near.id} — ${formatDateTimeInTz(near.startAt, accountTimeZone)} — ${near.services[0]?.service.name ?? "Услуга"} — ${near.status}. Если нужно, покажу последнюю прошедшую или все записи.`,
        };
      }
    }

    return {
      handled: true,
      reply: `Ваши последние записи:\n${items
        .slice(0, 7)
        .map((x, i) => `${i + 1}. #${x.id} — ${formatDateTimeInTz(x.startAt, accountTimeZone)} — ${x.services[0]?.service.name ?? "Услуга"} — ${x.status}`)
        .join("\n")}`,
    };
  }

  if (asksStats) {
    const s = await getClientStats({ accountId, clientId });
    return {
      handled: true,
      reply: `Ваша статистика: визитов всего ${s.total}, завершено ${s.done}, отмен ${s.cancelled}, средний чек ${Math.round(
        s.avgCheck,
      )} ₽${s.topService ? `, любимая услуга: ${s.topService}` : ""}.`,
    };
  }

  if (asksProfile) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для изменения профиля нужна активная авторизация." };
    }
    const newPhone = parsePhone(message);
    if (newPhone) {
      const updated = await updateClientPhone({ accountId, clientId, phone: newPhone });
      return { handled: true, reply: `Готово, обновила телефон: ${updated.phone}.` };
    }
    return { handled: true, reply: "Могу показать и обновить ваш телефон. Напишите новый номер в формате +7..." };
  }

  if (asksCancel) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для отмены записи нужна активная авторизация." };
    }
    const id = parseAppointmentId(messageNorm);
    const all = await getClientBookings({ accountId, clientId, limit: 30 });
    const requestedDateYmd = parseRuDateToYmd(messageNorm, todayYmd);
    const wantsNearestLocal = has(messageNorm, /(ближайш|следующ)/i);
    const wantsLatestLocal = has(messageNorm, /(последн)/i);
    const candidatesByDate = requestedDateYmd
      ? all.filter((x) => formatDateTimeInTz(x.startAt, accountTimeZone).includes(requestedDateYmd.split("-").reverse().join(".")))
      : [];
    const target = id
      ? { id }
      : wantsNearestLocal || wantsLatestLocal
      ? await findLatestUpcomingBooking({ accountId, clientId })
      : candidatesByDate.length === 1
      ? { id: candidatesByDate[0]!.id }
      : await findLatestUpcomingBooking({ accountId, clientId });
    if (!target) return { handled: true, reply: "Не нашла активную будущую запись для отмены." };

    if (!id && candidatesByDate.length > 1) {
      return {
        handled: true,
        reply: `На эту дату у вас несколько записей:\n${candidatesByDate
          .slice(0, 5)
          .map((x) => `#${x.id} — ${formatDateTimeInTz(x.startAt, accountTimeZone)} — ${x.services[0]?.service.name ?? "Услуга"}`)
          .join("\n")}\nНапишите: «отменить #ID».`,
      };
    }

    if (!id) {
      const appt = all.find((x) => x.id === target.id);
      const policy = await getBookingPolicy({ accountId });
      return {
        handled: true,
        reply: `Нашла запись #${target.id}${appt ? ` — ${formatDateTimeInTz(appt.startAt, accountTimeZone)}` : ""}. Для подтверждения напишите: «подтверждаю отмену #${target.id}».${
          policy.cancellationWindowHours != null
            ? ` Отмена доступна не позднее чем за ${formatPolicyHoursHuman(policy.cancellationWindowHours)} до визита.`
            : ""
        }`,
      };
    }

    return {
      handled: true,
      reply: `Для безопасности подтвердите действие: «подтверждаю отмену #${id}».`,
    };
  }

  if (cancelConfirmId || cancelConfirmBare) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для отмены записи нужна активная авторизация." };
    }
    let id = cancelConfirmId ? Number(cancelConfirmId) : null;
    if (!id) {
      const nearest = await findLatestUpcomingBooking({ accountId, clientId });
      if (!nearest) return { handled: true, reply: "Не нашла запись для подтверждения отмены. Укажите номер: «подтверждаю отмену #ID»." };
      id = nearest.id;
    }
    const cancelled = await cancelClientBooking({ accountId, clientId, appointmentId: id });
    if (!cancelled.ok) {
      if ((cancelled as any).reason === "cancellation_window_blocked") {
        const policyHours = (cancelled as any).policyHours;
        return {
          handled: true,
          reply: `Не могу отменить: по правилам отмена доступна не позднее чем за ${formatPolicyHoursHuman(
            policyHours,
          )} до начала.`,
        };
      }
      return { handled: true, reply: "Не получилось отменить запись. Проверьте номер записи и статус." };
    }
    return { handled: true, reply: `Запись #${id} отменена.` };
  }

  if (asksReschedule) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация." };
    }

    const idFromText = parseAppointmentId(messageNorm);
    const dt = parseDateTime(messageNorm, todayYmd);
    const all = await getClientBookings({ accountId, clientId, limit: 30 });

    const requestedDateYmd = parseRuDateToYmd(messageNorm, todayYmd);
    const wantsNearestLocal = has(messageNorm, /(ближайш|следующ)/i);
    const wantsLatestLocal = has(messageNorm, /(последн)/i);
    const candidatesByDate = requestedDateYmd
      ? all.filter((x) => formatDateTimeInTz(x.startAt, accountTimeZone).includes(requestedDateYmd.split("-").reverse().join(".")))
      : [];

    const target = idFromText
      ? { id: idFromText }
      : wantsNearestLocal || wantsLatestLocal
      ? await findLatestUpcomingBooking({ accountId, clientId })
      : candidatesByDate.length === 1
      ? { id: candidatesByDate[0]!.id }
      : await findLatestUpcomingBooking({ accountId, clientId });

    if (!target) return { handled: true, reply: "Не нашла активную будущую запись для переноса." };

    if (!idFromText && candidatesByDate.length > 1) {
      return {
        handled: true,
        reply: `На эту дату у вас несколько записей:\n${candidatesByDate
          .slice(0, 5)
          .map((x) => `#${x.id} — ${formatDateTimeInTz(x.startAt, accountTimeZone)} — ${x.services[0]?.service.name ?? "Услуга"}`)
          .join("\n")}\nНапишите: «перенести #ID на YYYY-MM-DD HH:MM».`,
      };
    }

    if (!dt) {
      return {
        handled: true,
        reply: `Запись #${target.id} нашла. Напишите новую дату и время, например: «перенести #${target.id} на ${todayYmd} 18:00».`,
      };
    }

    const policy = await getBookingPolicy({ accountId });
    return {
      handled: true,
      reply: `Проверила перенос #${target.id} на ${dt.date} ${dt.time}. Для подтверждения напишите: «подтверждаю перенос #${target.id} на ${dt.date} ${dt.time}».${
        policy.rescheduleWindowHours != null
          ? ` Перенос доступен не позднее чем за ${formatPolicyHoursHuman(policy.rescheduleWindowHours)} до визита.`
          : ""
      }`,
    };
  }

  if (rescheduleConfirm) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация." };
    }
    const id = Number(rescheduleConfirm[1]);
    const date = rescheduleConfirm[2]!;
    const hh = String(Number(rescheduleConfirm[3])).padStart(2, "0");
    const mm = rescheduleConfirm[4]!;
    const startAt = zonedTimeToUtc(date, `${hh}:${mm}`, accountTimeZone);
    if (!startAt) return { handled: true, reply: "Не распознала новую дату/время для переноса." };
    const endAt = new Date(startAt);
    endAt.setUTCMinutes(endAt.getUTCMinutes() + 60);
    const moved = await rescheduleClientBooking({ accountId, clientId, appointmentId: id, startAt, endAt });
    if (!moved.ok) {
      if ((moved as any).reason === "reschedule_window_blocked") {
        const policyHours = (moved as any).policyHours;
        return {
          handled: true,
          reply: `Не могу перенести: по правилам перенос доступен не позднее чем за ${formatPolicyHoursHuman(
            policyHours,
          )} до начала визита.`,
        };
      }
      if ((moved as any).reason === "slot_busy") {
        return { handled: true, reply: "Не получилось перенести: выбранный слот уже занят. Напишите другое время." };
      }
      return { handled: true, reply: "Не получилось перенести запись. Проверьте номер записи и новое время." };
    }
    return { handled: true, reply: `Готово, запись #${id} перенесена на ${date} ${hh}:${mm}.` };
  }

  if (asksRepeat) {
    const items = await getClientBookings({ accountId, clientId, limit: 1 });
    if (!items.length) return { handled: true, reply: "Не нашла предыдущих записей для повтора." };
    const last = items[0]!;
    return {
      handled: true,
      reply: `Могу повторить последнюю запись (#${last.id}: ${last.services[0]?.service.name ?? "услуга"}). Напишите дату и время, и я подберу слот.`,
    };
  }

  return { handled: false };
}
