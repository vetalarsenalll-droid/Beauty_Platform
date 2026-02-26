import {
  cancelClientBooking,
  findLatestUpcomingBooking,
  getBookingPolicy,
  getClientBookings,
  getClientStats,
  rescheduleClientBooking,
  updateClientPhone,
} from "@/lib/client-account-tools";

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
  const m = messageNorm.match(/#?\s*(\d{1,8})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDateTime(messageNorm: string) {
  const date = messageNorm.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
  const time = messageNorm.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!date || !time) return null;
  return { date, time: `${String(Number(time[1])).padStart(2, "0")}:${time[2]}` };
}

function toUtc(date: string, time: string) {
  const dt = new Date(`${date}T${time}:00.000Z`);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function parseRuDateToYmd(messageNorm: string, now: Date) {
  const iso = messageNorm.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const months = new Map<string, string>([
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
  const dm = messageNorm.match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/,
  );
  if (!dm) return null;
  const day = String(Number(dm[1])).padStart(2, "0");
  const month = months.get(dm[2]) ?? "01";
  let year = dm[3] ? Number(dm[3]) : now.getFullYear();
  const candidate = new Date(Date.UTC(year, Number(month) - 1, Number(day), 12));
  if (!dm[3] && candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) year += 1;
  return `${year}-${month}-${day}`;
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

export async function runClientAccountFlow(args: ClientFlowArgs): Promise<FlowResult> {
  const { message, messageNorm, accountId, accountTimeZone, clientId, authMode = "full" } = args;
  if (!clientId) return { handled: false };

  const asksMyBookings = has(
    messageNorm,
    /(мои записи|мои последние записи|покажи мои записи|моя запись|последняя запись|прошедш(ая|ие)|история записей|какая у меня.*запись)/i,
  );
  const asksLatestSingle = has(messageNorm, /(какая последняя запись|последняя запись|последний визит|что у меня было последнее|последнюю покажи)/i);
  const asksNearest = has(messageNorm, /(ближайш|ближайщ|следующ|скоро.*запись|предстоящ)/i);
  const asksStats = has(messageNorm, /(моя статистика|статистика|сколько раз|сколько посещений|мой средний чек)/i);
  const asksCancel = has(
    messageNorm,
    /(отмени(ть)? запись|отмена записи|cancel booking|отменить #|отмени(ть)? (ее|её|эту)|можешь.*отменить)/i,
  );
  const asksReschedule = has(
    messageNorm,
    /(перенеси запись|перезапиши|reschedule|перенести #|перенеси(ть)? (ее|её|эту)|можешь.*перенести)/i,
  );
  const asksRepeat = has(messageNorm, /(повтори прошлую запись|повтори запись|запиши как в прошлый раз)/i);
  const asksProfile = has(messageNorm, /(мои данные|мой телефон|смени телефон|обнови телефон|мой профиль)/i);

  const cancelConfirmId = messageNorm.match(/подтверждаю\s+отмену\s*#?\s*(\d{1,8})/i)?.[1];
  const cancelConfirmBare = has(messageNorm, /подтверждаю\s+отмену/i);
  const rescheduleConfirm = messageNorm.match(
    /подтверждаю\s+перенос\s*#?\s*(\d{1,8})\s+на\s+(\d{4}-\d{2}-\d{2})\s+([01]?\d|2[0-3])[:.]([0-5]\d)/i,
  );

  if (!asksMyBookings && !asksStats && !asksCancel && !asksReschedule && !asksRepeat && !asksProfile) {
    if (!cancelConfirmId && !rescheduleConfirm) return { handled: false };
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
    const asksPast = has(messageNorm, /(прошедш|прошлая|прошлые|была|были|история)/i);

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
      if (!last) return { handled: true, reply: "Прошедших записей пока не нашла." };
      return {
        handled: true,
        reply: `Последняя прошедшая запись: #${last.id} — ${formatDateTimeInTz(last.startAt, accountTimeZone)} — ${last.services[0]?.service.name ?? "Услуга"} — ${last.status}.`,
      };
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
      return { handled: true, reply: "Для изменения профиля нужна активная авторизация клиента." };
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
      return { handled: true, reply: "Для отмены записи нужна активная авторизация клиента." };
    }
    const id = parseAppointmentId(messageNorm);
    const all = await getClientBookings({ accountId, clientId, limit: 30 });
    const requestedDateYmd = parseRuDateToYmd(messageNorm, new Date());
    const candidatesByDate = requestedDateYmd
      ? all.filter((x) => formatDateTimeInTz(x.startAt, accountTimeZone).includes(requestedDateYmd.split("-").reverse().join(".")))
      : [];
    const target = id
      ? { id }
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
      return { handled: true, reply: "Для отмены записи нужна активная авторизация клиента." };
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
          reply: `Не могу отменить: до визита осталось слишком мало времени. По правилам отмена возможна не позднее чем за ${formatPolicyHoursHuman(
            policyHours,
          )} до начала.`,
        };
      }
      return { handled: true, reply: "Не получилось отменить запись. Проверьте номер записи или статус." };
    }
    return { handled: true, reply: `Запись #${id} отменена.` };
  }

  if (asksReschedule) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация клиента." };
    }
    const id = parseAppointmentId(messageNorm);
    const dt = parseDateTime(messageNorm);
    if (!id || !dt) {
      return {
        handled: true,
        reply: "Для переноса напишите так: «перенести #123 на 2026-03-02 18:00».",
      };
    }
    const policy = await getBookingPolicy({ accountId });
    return {
      handled: true,
      reply: `Проверила запрос на перенос #${id} на ${dt.date} ${dt.time}. Для подтверждения напишите: «подтверждаю перенос #${id} на ${dt.date} ${dt.time}».${
        policy.rescheduleWindowHours != null
          ? ` Политика переноса: не позднее чем за ${policy.rescheduleWindowHours} ч.`
          : ""
      }`,
    };
  }

  if (rescheduleConfirm) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация клиента." };
    }
    const id = Number(rescheduleConfirm[1]);
    const date = rescheduleConfirm[2]!;
    const hh = String(Number(rescheduleConfirm[3])).padStart(2, "0");
    const mm = rescheduleConfirm[4]!;
    const startAt = toUtc(date, `${hh}:${mm}`);
    if (!startAt) return { handled: true, reply: "Не распознала новую дату/время для переноса." };
    const endAt = new Date(startAt);
    endAt.setUTCMinutes(endAt.getUTCMinutes() + 60);
    const moved = await rescheduleClientBooking({ accountId, clientId, appointmentId: id, startAt, endAt });
    if (!moved.ok) {
      if ((moved as any).reason === "reschedule_window_blocked") {
        const policyHours = (moved as any).policyHours;
        return { handled: true, reply: `Перенос недоступен по политике записи: менее ${policyHours} ч до визита.` };
      }
      return { handled: true, reply: "Не получилось перенести запись. Возможно, слот занят или запись недоступна." };
    }
    return { handled: true, reply: `Запись #${id} перенесена на ${date} ${hh}:${mm}.` };
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
