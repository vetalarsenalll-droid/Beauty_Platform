import type { DraftLike } from "@/lib/booking-tools";

type Mode = "SELF" | "ASSISTANT";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const draftView = (d: {
  locationId: number | null;
  serviceId: number | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  mode: string | null;
  status: string;
  consentConfirmedAt: Date | null;
}): DraftLike => ({
  locationId: d.locationId,
  serviceId: d.serviceId,
  specialistId: d.specialistId,
  date: d.date,
  time: d.time,
  clientName: d.clientName,
  clientPhone: d.clientPhone,
  mode: d.mode === "SELF" || d.mode === "ASSISTANT" ? (d.mode as Mode) : null,
  status: d.status,
  consentConfirmedAt: d.consentConfirmedAt ? d.consentConfirmedAt.toISOString() : null,
});

export const toYmd = (dt: Date) => dt.toISOString().slice(0, 10);
export const addDaysYmd = (ymd: string, days: number) => {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmd(dt);
};

export const isIsoYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const pickSafeNluDate = (candidate: unknown, today: string) => {
  if (!isIsoYmd(candidate)) return null;
  // Ignore clearly stale model dates (e.g. 2023) and unrealistic far future.
  const min = addDaysYmd(today, -1);
  const max = addDaysYmd(today, 730);
  if (candidate < min || candidate > max) return null;
  return candidate;
};

export const parseDate = (m: string, today: string) => {
  const t = norm(m);
  const afterDm = t.match(
    /\bпосле\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b/,
  );
  if (afterDm) {
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
    const day = Number(afterDm[1]);
    const month = monthMap.get(afterDm[2]) ?? "01";
    let year = Number(today.slice(0, 4));
    let candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    if (candidate < today) {
      year += 1;
      candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    return addDaysYmd(candidate, 1);
  }
  if (/\b(сегодня|today)\b/.test(t)) return today;
  if (/\b(послезавтра|day after tomorrow)\b/.test(t)) return addDaysYmd(today, 2);
  if (/\b(завтра|tomorrow)\b/.test(t)) return addDaysYmd(today, 1);

  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmText = t.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/);
  if (dmText) {
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
    const day = Number(dmText[1]);
    const month = monthMap.get(dmText[2]) ?? "01";
    let year = dmText[3] ? Number(dmText[3]) : Number(today.slice(0, 4));
    let candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    if (!dmText[3] && candidate < today) {
      year += 1;
      candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    return candidate;
  }

  const monthOnly = t.match(
    /\b(?:в\s+)?(?:перв(?:ых|ые)\s+числ(?:ах|а)\s+)?(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b/,
  );
  if (monthOnly) {
    const monthMap = new Map<string, string>([
      ["январе", "01"],
      ["января", "01"],
      ["феврале", "02"],
      ["февраля", "02"],
      ["марте", "03"],
      ["марта", "03"],
      ["апреле", "04"],
      ["апреля", "04"],
      ["мае", "05"],
      ["мая", "05"],
      ["июне", "06"],
      ["июня", "06"],
      ["июле", "07"],
      ["июля", "07"],
      ["августе", "08"],
      ["августа", "08"],
      ["сентябре", "09"],
      ["сентября", "09"],
      ["октябре", "10"],
      ["октября", "10"],
      ["ноябре", "11"],
      ["ноября", "11"],
      ["декабре", "12"],
      ["декабря", "12"],
    ]);
    const month = monthMap.get(monthOnly[1] ?? "") ?? "01";
    let year = Number(today.slice(0, 4));
    let candidate = `${year}-${month}-01`;
    if (candidate < today) {
      year += 1;
      candidate = `${year}-${month}-01`;
    }
    return candidate;
  }
  return null;
};

export const parseTime = (m: string) => {
  const t = norm(m);
  const hasDateToken =
    /\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/.test(t) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(t);
  const hhmmColon = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmmColon) return `${String(Number(hhmmColon[1])).padStart(2, "0")}:${hhmmColon[2]}`;
  if (!hasDateToken) {
    const hhmmDotOrSpace = t.match(/\b([01]?\d|2[0-3])[. ]([0-5]\d)\b/);
    if (hhmmDotOrSpace) return `${String(Number(hhmmDotOrSpace[1])).padStart(2, "0")}:${hhmmDotOrSpace[2]}`;
  }
  const prepHour = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (prepHour) {
    const n = Number(prepHour[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }
  return null;
};

export const parsePhone = (m: string) => {
  const candidates = m.match(/(?:\+7|8)[\d\s().-]*/g) ?? [];
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length !== 11) continue;
    if (d.startsWith("8")) return `+7${d.slice(1)}`;
    if (d.startsWith("7")) return `+${d}`;
  }
  return null;
};

export const parseName = (m: string) => {
  const explicit = m.match(/(?:меня зовут|имя)\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,})?)/iu)?.[1];
  if (explicit) return explicit.trim();
  const inlineWithPhone = m.match(/^\s*([\p{L}-]{2,})(?:\s+([\p{L}-]{2,}))?[\s,;:]+(?:\+7|8|\d{3,})/iu);
  if (inlineWithPhone) return [inlineWithPhone[1], inlineWithPhone[2]].filter(Boolean).join(" ").trim();
  return null;
};
