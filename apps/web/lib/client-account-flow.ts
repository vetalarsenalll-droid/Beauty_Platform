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
  const candidates = message.match(/(?:\+7|8)[\d\s().-]*/g) ?? [];
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length !== 11) continue;
    if (d.startsWith("8")) return `+7${d.slice(1)}`;
    if (d.startsWith("7")) return `+${d}`;
  }
  return null;
}

function parseAppointmentId(messageNorm: string) {
  const explicitHash = messageNorm.match(/#\s*(\d{1,8})\b/);
  if (explicitHash) {
    const n = Number(explicitHash[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  const explicitWord = messageNorm.match(/\b(?:Р·Р°РїРёСЃ[СЊРё]|Р·Р°РїРёСЃСЊ|РЅРѕРјРµСЂ|id)\s*#?\s*(\d{1,8})\b/i);
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
  if (/\b(СЃРµРіРѕРґРЅСЏ|today)\b/i.test(messageNorm)) return todayYmd;
  if (/\b(Р·Р°РІС‚СЂР°|tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 1);
  if (/\b(РїРѕСЃР»РµР·Р°РІС‚СЂР°|day after tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 2);

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
    ["СЏРЅРІР°СЂСЏ", "01"],
    ["С„РµРІСЂР°Р»СЏ", "02"],
    ["РјР°СЂС‚Р°", "03"],
    ["Р°РїСЂРµР»СЏ", "04"],
    ["РјР°СЏ", "05"],
    ["РёСЋРЅСЏ", "06"],
    ["РёСЋР»СЏ", "07"],
    ["Р°РІРіСѓСЃС‚Р°", "08"],
    ["СЃРµРЅС‚СЏР±СЂСЏ", "09"],
    ["РѕРєС‚СЏР±СЂСЏ", "10"],
    ["РЅРѕСЏР±СЂСЏ", "11"],
    ["РґРµРєР°Р±СЂСЏ", "12"],
  ]);
  const dmText = messageNorm.match(
    /\b(\d{1,2})\s+(СЏРЅРІР°СЂСЏ|С„РµРІСЂР°Р»СЏ|РјР°СЂС‚Р°|Р°РїСЂРµР»СЏ|РјР°СЏ|РёСЋРЅСЏ|РёСЋР»СЏ|Р°РІРіСѓСЃС‚Р°|СЃРµРЅС‚СЏР±СЂСЏ|РѕРєС‚СЏР±СЂСЏ|РЅРѕСЏР±СЂСЏ|РґРµРєР°Р±СЂСЏ)(?:\s+(\d{4}))?\b/i,
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

  const hourOnly = messageNorm.match(/\b(?:РІ|РЅР°|Рє)\s*([01]?\d|2[0-3])\b/i);
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
  if (days > 0 && remHours > 0) return `${days} РґРЅ ${remHours} С‡`;
  if (days > 0) return `${days} РґРЅ`;
  return `${hours} С‡`;
}

function parseRescheduleConfirm(text: string) {
  return text.match(
    /РїРѕРґС‚РІРµСЂР¶РґР°[Р°-СЏ]*\s+РїРµСЂРµРЅРѕСЃ\s*#?\s*(\d{1,8})\s+РЅР°\s+(\d{4}-\d{2}-\d{2})\s+([01]?\d|2[0-3])[:.]([0-5]\d)/i,
  );
}

export async function runClientAccountFlow(args: ClientFlowArgs): Promise<FlowResult> {
  const { message, messageNorm, accountId, accountTimeZone, clientId, authMode = "full" } = args;
  if (!clientId) return { handled: false };

  const todayYmd = ymdFromDateInTz(new Date(), accountTimeZone);

  const asksMyBookings = has(
    messageNorm,
    /(РјРѕРё Р·Р°РїРёСЃРё|РјРѕСЏ Р·Р°РїРёСЃСЊ|РїРѕРєР°Р¶Рё РјРѕРё Р·Р°РїРёСЃРё|РїРѕСЃР»РµРґРЅСЏСЏ Р·Р°РїРёСЃСЊ|РїСЂРѕС€РµРґС€|РёСЃС‚РѕСЂРёСЏ Р·Р°РїРёСЃРµР№|РєР°РєР°СЏ Сѓ РјРµРЅСЏ.*Р·Р°РїРёСЃСЊ|РєР°РєР°СЏ Р·Р°РїРёСЃСЊ|РєР°РєРёРµ Р·Р°РїРёСЃРё|С‡С‚Рѕ СЃ РјРѕРµР№ Р·Р°РїРёСЃСЊСЋ|С‡С‚Рѕ РїРѕ РјРѕРµР№ Р·Р°РїРёСЃРё|Р±Р»РёР¶Р°Р№С€Р°СЏ Р·Р°РїРёСЃСЊ|РїСЂРµРґСЃС‚РѕСЏС‰Р°СЏ Р·Р°РїРёСЃСЊ)/i,
  );
  const asksLatestSingle = has(messageNorm, /(РєР°РєР°СЏ РїРѕСЃР»РµРґРЅСЏСЏ Р·Р°РїРёСЃСЊ|РїРѕСЃР»РµРґРЅСЋСЋ РїРѕРєР°Р¶Рё|РїРѕСЃР»РµРґРЅСЏСЏ Р·Р°РїРёСЃСЊ|РїРѕСЃР»РµРґРЅРёР№ РІРёР·РёС‚)/i);
  const asksNearest = has(messageNorm, /(Р±Р»РёР¶Р°Р№С€|РїСЂРµРґСЃС‚РѕСЏС‰|СЃР»РµРґСѓСЋС‰|СЃРєРѕСЂРѕ.*Р·Р°РїРёСЃСЊ)/i);
  const asksPast = has(messageNorm, /(РїСЂРѕС€РµРґС€|РїСЂРѕС€Р»Р°СЏ|РёСЃС‚РѕСЂРёСЏ)/i);

  const asksStats = has(messageNorm, /(РјРѕСЏ СЃС‚Р°С‚РёСЃС‚РёРєР°|СЃС‚Р°С‚РёСЃС‚РёРєР°|СЃРєРѕР»СЊРєРѕ СЂР°Р·|СЃРєРѕР»СЊРєРѕ РїРѕСЃРµС‰РµРЅРёР№|СЃСЂРµРґРЅРёР№ С‡РµРє)/i);
  const asksCancel = has(
    messageNorm,
    /(РѕС‚РјРµРЅРё(С‚СЊ)?( Р·Р°РїРёСЃСЊ)?|РѕС‚РјРµРЅР° Р·Р°РїРёСЃРё|cancel booking|РјРѕР¶РµС€СЊ.*РѕС‚РјРµРЅРёС‚СЊ|РѕС‚РјРµРЅРё (РµРµ|РµС‘|СЌС‚Сѓ|РїРѕСЃР»РµРґРЅСЋСЋ|Р±Р»РёР¶Р°Р№С€СѓСЋ))/i,
  );
  const asksReschedule = has(
    messageNorm,
    /(РїРµСЂРµРЅРµСЃРё(С‚СЊ)?( Р·Р°РїРёСЃСЊ)?|РїРµСЂРµР·Р°РїРёС€Рё|reschedule|РјРѕР¶РµС€СЊ.*РїРµСЂРµРЅРµСЃС‚Рё|РїРµСЂРµРЅРµСЃРё (РµРµ|РµС‘|СЌС‚Сѓ|РїРѕСЃР»РµРґРЅСЋСЋ|Р±Р»РёР¶Р°Р№С€СѓСЋ))/i,
  );
  const asksRepeat = has(messageNorm, /(РїРѕРІС‚РѕСЂРё РїСЂРѕС€Р»СѓСЋ Р·Р°РїРёСЃСЊ|РїРѕРІС‚РѕСЂРё Р·Р°РїРёСЃСЊ|Р·Р°РїРёС€Рё РєР°Рє РІ РїСЂРѕС€Р»С‹Р№ СЂР°Р·)/i);
  const asksProfile = has(messageNorm, /(РјРѕРё РґР°РЅРЅС‹Рµ|РјРѕР№ С‚РµР»РµС„РѕРЅ|СЃРјРµРЅРё С‚РµР»РµС„РѕРЅ|РѕР±РЅРѕРІРё С‚РµР»РµС„РѕРЅ|РјРѕР№ РїСЂРѕС„РёР»СЊ)/i);

  const cancelConfirmId = messageNorm.match(/Рї?РѕРґС‚РІРµСЂР¶РґР°СЋ\s+РѕС‚РјРµРЅСѓ\s*#?\s*(\d{1,8})/i)?.[1];
  const cancelConfirmBare = has(messageNorm, /Рї?РѕРґС‚РІРµСЂР¶РґР°СЋ\s+РѕС‚РјРµРЅСѓ/i);
  const rescheduleConfirm = parseRescheduleConfirm(messageNorm);

  if (!asksMyBookings && !asksStats && !asksCancel && !asksReschedule && !asksRepeat && !asksProfile) {
    if (!cancelConfirmId && !cancelConfirmBare && !rescheduleConfirm) return { handled: false };
  }

  if (asksMyBookings) {
    const items = await getClientBookings({ accountId, clientId, limit: 20 });
    if (!items.length) return { handled: true, reply: "РЈ РІР°СЃ РїРѕРєР° РЅРµС‚ Р·Р°РїРёСЃРµР№." };

    const now = new Date();
    const past = items
      .filter((x) => x.startAt < now && x.status !== "CANCELLED")
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    const upcoming = items
      .filter((x) => x.startAt >= now && x.status !== "CANCELLED")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    if (asksNearest) {
      const near = upcoming[0];
      if (!near) return { handled: true, reply: "Р‘Р»РёР¶Р°Р№С€РёС… РїСЂРµРґСЃС‚РѕСЏС‰РёС… Р·Р°РїРёСЃРµР№ РЅРµ РЅР°С€Р»Р°." };
      return {
        handled: true,
        reply: `Р‘Р»РёР¶Р°Р№С€Р°СЏ Р·Р°РїРёСЃСЊ: #${near.id} вЂ” ${formatDateTimeInTz(near.startAt, accountTimeZone)} вЂ” ${near.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"} вЂ” ${near.status}.`,
      };
    }

    if (asksLatestSingle || asksPast) {
      const last = past[0];
      if (!last) return { handled: true, reply: "РџСЂРѕС€РµРґС€РёС… Р·Р°РїРёСЃРµР№ РїРѕРєР° РЅРµС‚." };
      return {
        handled: true,
        reply: `РџРѕСЃР»РµРґРЅСЏСЏ РїСЂРѕС€РµРґС€Р°СЏ Р·Р°РїРёСЃСЊ: #${last.id} вЂ” ${formatDateTimeInTz(last.startAt, accountTimeZone)} вЂ” ${last.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"} вЂ” ${last.status}.`,
      };
    }

    if (!asksNearest) {
      const near = upcoming[0];
      if (near) {
        return {
          handled: true,
          reply: `Р‘Р»РёР¶Р°Р№С€Р°СЏ Р·Р°РїРёСЃСЊ: #${near.id} вЂ” ${formatDateTimeInTz(near.startAt, accountTimeZone)} вЂ” ${near.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"} вЂ” ${near.status}. Р•СЃР»Рё РЅСѓР¶РЅРѕ, РїРѕРєР°Р¶Сѓ РїРѕСЃР»РµРґРЅСЋСЋ РїСЂРѕС€РµРґС€СѓСЋ РёР»Рё РІСЃРµ Р·Р°РїРёСЃРё.`,
        };
      }
    }

    return {
      handled: true,
      reply: `Р’Р°С€Рё РїРѕСЃР»РµРґРЅРёРµ Р·Р°РїРёСЃРё:\n${items
        .slice(0, 7)
        .map((x, i) => `${i + 1}. #${x.id} вЂ” ${formatDateTimeInTz(x.startAt, accountTimeZone)} вЂ” ${x.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"} вЂ” ${x.status}`)
        .join("\n")}`,
    };
  }

  if (asksStats) {
    const s = await getClientStats({ accountId, clientId });
    return {
      handled: true,
      reply: `Р’Р°С€Р° СЃС‚Р°С‚РёСЃС‚РёРєР°: РІРёР·РёС‚РѕРІ РІСЃРµРіРѕ ${s.total}, Р·Р°РІРµСЂС€РµРЅРѕ ${s.done}, РѕС‚РјРµРЅ ${s.cancelled}, СЃСЂРµРґРЅРёР№ С‡РµРє ${Math.round(
        s.avgCheck,
      )} в‚Ѕ${s.topService ? `, Р»СЋР±РёРјР°СЏ СѓСЃР»СѓРіР°: ${s.topService}` : ""}.`,
    };
  }

  if (asksProfile) {
    if (authMode !== "full") {
      return { handled: true, reply: "Р”Р»СЏ РёР·РјРµРЅРµРЅРёСЏ РїСЂРѕС„РёР»СЏ РЅСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." };
    }
    const newPhone = parsePhone(message);
    if (newPhone) {
      const updated = await updateClientPhone({ accountId, clientId, phone: newPhone });
      return { handled: true, reply: `Р“РѕС‚РѕРІРѕ, РѕР±РЅРѕРІРёР»Р° С‚РµР»РµС„РѕРЅ: ${updated.phone}.` };
    }
    return { handled: true, reply: "РњРѕРіСѓ РїРѕРєР°Р·Р°С‚СЊ Рё РѕР±РЅРѕРІРёС‚СЊ РІР°С€ С‚РµР»РµС„РѕРЅ. РќР°РїРёС€РёС‚Рµ РЅРѕРІС‹Р№ РЅРѕРјРµСЂ РІ С„РѕСЂРјР°С‚Рµ +7..." };
  }

  if (asksCancel) {
    if (authMode !== "full") {
      return { handled: true, reply: "Р”Р»СЏ РѕС‚РјРµРЅС‹ Р·Р°РїРёСЃРё РЅСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." };
    }
    const id = parseAppointmentId(messageNorm);
    const all = await getClientBookings({ accountId, clientId, limit: 30 });
    const requestedDateYmd = parseRuDateToYmd(messageNorm, todayYmd);
    const wantsNearestLocal = has(messageNorm, /(Р±Р»РёР¶Р°Р№С€|СЃР»РµРґСѓСЋС‰)/i);
    const wantsLatestLocal = has(messageNorm, /(РїРѕСЃР»РµРґРЅ)/i);
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
    if (!target) return { handled: true, reply: "РќРµ РЅР°С€Р»Р° Р°РєС‚РёРІРЅСѓСЋ Р±СѓРґСѓС‰СѓСЋ Р·Р°РїРёСЃСЊ РґР»СЏ РѕС‚РјРµРЅС‹." };

    if (!id && candidatesByDate.length > 1) {
      return {
        handled: true,
        reply: `РќР° СЌС‚Сѓ РґР°С‚Сѓ Сѓ РІР°СЃ РЅРµСЃРєРѕР»СЊРєРѕ Р·Р°РїРёСЃРµР№:\n${candidatesByDate
          .slice(0, 5)
          .map((x) => `#${x.id} вЂ” ${formatDateTimeInTz(x.startAt, accountTimeZone)} вЂ” ${x.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"}`)
          .join("\n")}\nРќР°РїРёС€РёС‚Рµ: В«РѕС‚РјРµРЅРёС‚СЊ #IDВ».`,
      };
    }

    if (!id) {
      const appt = all.find((x) => x.id === target.id);
      const policy = await getBookingPolicy({ accountId });
      return {
        handled: true,
        reply: `РќР°С€Р»Р° Р·Р°РїРёСЃСЊ #${target.id}${appt ? ` вЂ” ${formatDateTimeInTz(appt.startAt, accountTimeZone)}` : ""}. Р”Р»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РЅР°РїРёС€РёС‚Рµ: В«РїРѕРґС‚РІРµСЂР¶РґР°СЋ РѕС‚РјРµРЅСѓ #${target.id}В».${
          policy.cancellationWindowHours != null
            ? ` РћС‚РјРµРЅР° РґРѕСЃС‚СѓРїРЅР° РЅРµ РїРѕР·РґРЅРµРµ С‡РµРј Р·Р° ${formatPolicyHoursHuman(policy.cancellationWindowHours)} РґРѕ РІРёР·РёС‚Р°.`
            : ""
        }`,
      };
    }

    return {
      handled: true,
      reply: `Р”Р»СЏ Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ РґРµР№СЃС‚РІРёРµ: В«РїРѕРґС‚РІРµСЂР¶РґР°СЋ РѕС‚РјРµРЅСѓ #${id}В».`,
    };
  }

  if (cancelConfirmId || cancelConfirmBare) {
    if (authMode !== "full") {
      return { handled: true, reply: "Р”Р»СЏ РѕС‚РјРµРЅС‹ Р·Р°РїРёСЃРё РЅСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." };
    }
    let id = cancelConfirmId ? Number(cancelConfirmId) : null;
    if (!id) {
      const nearest = await findLatestUpcomingBooking({ accountId, clientId });
      if (!nearest) return { handled: true, reply: "РќРµ РЅР°С€Р»Р° Р·Р°РїРёСЃСЊ РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РѕС‚РјРµРЅС‹. РЈРєР°Р¶РёС‚Рµ РЅРѕРјРµСЂ: В«РїРѕРґС‚РІРµСЂР¶РґР°СЋ РѕС‚РјРµРЅСѓ #IDВ»." };
      id = nearest.id;
    }
    const cancelled = await cancelClientBooking({ accountId, clientId, appointmentId: id });
    if (!cancelled.ok) {
      if ((cancelled as any).reason === "cancellation_window_blocked") {
        const policyHours = (cancelled as any).policyHours;
        return {
          handled: true,
          reply: `РќРµ РјРѕРіСѓ РѕС‚РјРµРЅРёС‚СЊ: РїРѕ РїСЂР°РІРёР»Р°Рј РѕС‚РјРµРЅР° РґРѕСЃС‚СѓРїРЅР° РЅРµ РїРѕР·РґРЅРµРµ С‡РµРј Р·Р° ${formatPolicyHoursHuman(
            policyHours,
          )} РґРѕ РЅР°С‡Р°Р»Р°.`,
        };
      }
      return { handled: true, reply: "РќРµ РїРѕР»СѓС‡РёР»РѕСЃСЊ РѕС‚РјРµРЅРёС‚СЊ Р·Р°РїРёСЃСЊ. РџСЂРѕРІРµСЂСЊС‚Рµ РЅРѕРјРµСЂ Р·Р°РїРёСЃРё Рё СЃС‚Р°С‚СѓСЃ." };
    }
    return { handled: true, reply: `Р—Р°РїРёСЃСЊ #${id} РѕС‚РјРµРЅРµРЅР°.` };
  }

  if (asksReschedule) {
    if (authMode !== "full") {
      return { handled: true, reply: "Р”Р»СЏ РїРµСЂРµРЅРѕСЃР° Р·Р°РїРёСЃРё РЅСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." };
    }

    const idFromText = parseAppointmentId(messageNorm);
    const dt = parseDateTime(messageNorm, todayYmd);
    const all = await getClientBookings({ accountId, clientId, limit: 30 });

    const requestedDateYmd = parseRuDateToYmd(messageNorm, todayYmd);
    const wantsNearestLocal = has(messageNorm, /(Р±Р»РёР¶Р°Р№С€|СЃР»РµРґСѓСЋС‰)/i);
    const wantsLatestLocal = has(messageNorm, /(РїРѕСЃР»РµРґРЅ)/i);
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

    if (!target) return { handled: true, reply: "РќРµ РЅР°С€Р»Р° Р°РєС‚РёРІРЅСѓСЋ Р±СѓРґСѓС‰СѓСЋ Р·Р°РїРёСЃСЊ РґР»СЏ РїРµСЂРµРЅРѕСЃР°." };

    if (!idFromText && candidatesByDate.length > 1) {
      return {
        handled: true,
        reply: `РќР° СЌС‚Сѓ РґР°С‚Сѓ Сѓ РІР°СЃ РЅРµСЃРєРѕР»СЊРєРѕ Р·Р°РїРёСЃРµР№:\n${candidatesByDate
          .slice(0, 5)
          .map((x) => `#${x.id} вЂ” ${formatDateTimeInTz(x.startAt, accountTimeZone)} вЂ” ${x.services[0]?.service.name ?? "РЈСЃР»СѓРіР°"}`)
          .join("\n")}\nРќР°РїРёС€РёС‚Рµ: В«РїРµСЂРµРЅРµСЃС‚Рё #ID РЅР° YYYY-MM-DD HH:MMВ».`,
      };
    }

    if (!dt) {
      return {
        handled: true,
        reply: `Р—Р°РїРёСЃСЊ #${target.id} РЅР°С€Р»Р°. РќР°РїРёС€РёС‚Рµ РЅРѕРІСѓСЋ РґР°С‚Сѓ Рё РІСЂРµРјСЏ, РЅР°РїСЂРёРјРµСЂ: В«РїРµСЂРµРЅРµСЃС‚Рё #${target.id} РЅР° ${todayYmd} 18:00В».`,
      };
    }

    const policy = await getBookingPolicy({ accountId });
    return {
      handled: true,
      reply: `РџСЂРѕРІРµСЂРёР»Р° РїРµСЂРµРЅРѕСЃ #${target.id} РЅР° ${dt.date} ${dt.time}. Р”Р»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РЅР°РїРёС€РёС‚Рµ: В«РїРѕРґС‚РІРµСЂР¶РґР°СЋ РїРµСЂРµРЅРѕСЃ #${target.id} РЅР° ${dt.date} ${dt.time}В».${
        policy.rescheduleWindowHours != null
          ? ` РџРµСЂРµРЅРѕСЃ РґРѕСЃС‚СѓРїРµРЅ РЅРµ РїРѕР·РґРЅРµРµ С‡РµРј Р·Р° ${formatPolicyHoursHuman(policy.rescheduleWindowHours)} РґРѕ РІРёР·РёС‚Р°.`
          : ""
      }`,
    };
  }

  if (rescheduleConfirm) {
    if (authMode !== "full") {
      return { handled: true, reply: "Р”Р»СЏ РїРµСЂРµРЅРѕСЃР° Р·Р°РїРёСЃРё РЅСѓР¶РЅР° Р°РєС‚РёРІРЅР°СЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ." };
    }
    const id = Number(rescheduleConfirm[1]);
    const date = rescheduleConfirm[2]!;
    const hh = String(Number(rescheduleConfirm[3])).padStart(2, "0");
    const mm = rescheduleConfirm[4]!;
    const startAt = zonedTimeToUtc(date, `${hh}:${mm}`, accountTimeZone);
    if (!startAt) return { handled: true, reply: "РќРµ СЂР°СЃРїРѕР·РЅР°Р»Р° РЅРѕРІСѓСЋ РґР°С‚Сѓ/РІСЂРµРјСЏ РґР»СЏ РїРµСЂРµРЅРѕСЃР°." };
    const bookings = await getClientBookings({ accountId, clientId, limit: 50 });
    const current = bookings.find((x) => x.id === id) ?? null;
    const durationMs = current ? Math.max(30 * 60_000, current.endAt.getTime() - current.startAt.getTime()) : 60 * 60_000;
    const endAt = new Date(startAt.getTime() + durationMs);
    const moved = await rescheduleClientBooking({ accountId, clientId, appointmentId: id, startAt, endAt });
    if (!moved.ok) {
      if ((moved as any).reason === "reschedule_window_blocked") {
        const policyHours = (moved as any).policyHours;
        return {
          handled: true,
          reply: `РќРµ РјРѕРіСѓ РїРµСЂРµРЅРµСЃС‚Рё: РїРѕ РїСЂР°РІРёР»Р°Рј РїРµСЂРµРЅРѕСЃ РґРѕСЃС‚СѓРїРµРЅ РЅРµ РїРѕР·РґРЅРµРµ С‡РµРј Р·Р° ${formatPolicyHoursHuman(
            policyHours,
          )} РґРѕ РЅР°С‡Р°Р»Р° РІРёР·РёС‚Р°.`,
        };
      }
      if ((moved as any).reason === "slot_busy") {
        return { handled: true, reply: "РќРµ РїРѕР»СѓС‡РёР»РѕСЃСЊ РїРµСЂРµРЅРµСЃС‚Рё: РІС‹Р±СЂР°РЅРЅС‹Р№ СЃР»РѕС‚ СѓР¶Рµ Р·Р°РЅСЏС‚. РќР°РїРёС€РёС‚Рµ РґСЂСѓРіРѕРµ РІСЂРµРјСЏ." };
      }
      return { handled: true, reply: "РќРµ РїРѕР»СѓС‡РёР»РѕСЃСЊ РїРµСЂРµРЅРµСЃС‚Рё Р·Р°РїРёСЃСЊ. РџСЂРѕРІРµСЂСЊС‚Рµ РЅРѕРјРµСЂ Р·Р°РїРёСЃРё Рё РЅРѕРІРѕРµ РІСЂРµРјСЏ." };
    }
    return { handled: true, reply: `Р“РѕС‚РѕРІРѕ, Р·Р°РїРёСЃСЊ #${id} РїРµСЂРµРЅРµСЃРµРЅР° РЅР° ${date} ${hh}:${mm}.` };
  }

  if (asksRepeat) {
    const items = await getClientBookings({ accountId, clientId, limit: 1 });
    if (!items.length) return { handled: true, reply: "РќРµ РЅР°С€Р»Р° РїСЂРµРґС‹РґСѓС‰РёС… Р·Р°РїРёСЃРµР№ РґР»СЏ РїРѕРІС‚РѕСЂР°." };
    const last = items[0]!;
    return {
      handled: true,
      reply: `РњРѕРіСѓ РїРѕРІС‚РѕСЂРёС‚СЊ РїРѕСЃР»РµРґРЅСЋСЋ Р·Р°РїРёСЃСЊ (#${last.id}: ${last.services[0]?.service.name ?? "СѓСЃР»СѓРіР°"}). РќР°РїРёС€РёС‚Рµ РґР°С‚Сѓ Рё РІСЂРµРјСЏ, Рё СЏ РїРѕРґР±РµСЂСѓ СЃР»РѕС‚.`,
    };
  }

  return { handled: false };
}

