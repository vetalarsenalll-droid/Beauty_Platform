"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SiteAishaWidgetConfig } from "@/lib/site-builder";

type Message = { id?: number; role: "user" | "assistant"; content: string };
type ChatAction = { type: "open_booking"; bookingUrl: string } | null;
type QuickReply = { label: string; value: string; href?: string };
type ChatUi =
  | { kind: "quick_replies"; options: QuickReply[] }
  | { kind: "consent"; options: QuickReply[]; legalLinks: string[]; consentValue: string }
  | { kind: "date_picker"; minDate: string; maxDate: string; initialDate?: string | null; availableDates?: string[] | null };
type ChatMessage = Message & { ui?: ChatUi | null };

type StoredThreadState = { threadId: number; threadKey: string | null };

type PublicAiChatWidgetProps = {
  accountSlug: string;
  widgetConfig?: SiteAishaWidgetConfig | null;
  mode?: "floating" | "inline";
  defaultOpen?: boolean;
  className?: string;
  themeMode?: "light" | "dark";
};

function stripLegalRefs(text: string) {
  return text
    .replace(/\/[A-Za-z0-9_-]+\/legal\/\d+/g, "")
    .replace(/\S*\/legal\/\S*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isDateTimeInfoReply(content: string) {
  const text = content.trim();
  if (/^Сейчас\s+\d{2}\.\d{2}\.\d{4},\s*(?:[01]\d|2[0-3]):[0-5]\d\.?$/i.test(text)) return true;
  if (/^Сегодня\s+\d{2}\.\d{2}\.\d{4}\.?$/i.test(text)) return true;
  return false;
}

function shouldExtractTimeQuickReplies(content: string) {
  if (isDateTimeInfoReply(content)) return false;
  if (/\u0444\u0438\u043b\u0438\u0430\u043b/i.test(content) || /location/i.test(content)) return false;
  if (/проверьте данные:|как завершим запись|для оформления нужно согласие/i.test(content)) return false;
  // If assistant asks to choose location/branch, show only branch buttons.
  if (/(выберите филиал|можно выбрать филиал|филиал кнопкой ниже)/i.test(content)) return false;
  return (
    /(?:выберите|напишите|укажите|доступны|свободны|окна|слоты|времена|как завершим запись|подтверждени|согласен)/i.test(
      content,
    ) || /(?:^|\n)\s*\d{1,2}\.\s+/.test(content)
  );
}

function extractQuickReplies(content: string): QuickReply[] {
  const replies: QuickReply[] = [];
  const isLocationSelectionReply =
    /(\u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0438\u043b\u0438\u0430\u043b|\u043c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0438\u043b\u0438\u0430\u043b|\u0444\u0438\u043b\u0438\u0430\u043b \u043a\u043d\u043e\u043f\u043a\u043e\u0439 \u043d\u0438\u0436\u0435)/i.test(content) ||
    /\u0444\u0438\u043b\u0438\u0430\u043b/i.test(content) ||
    /location/i.test(content);
  const add = (label: string, value?: string, href?: string) => {
    const l = label.trim();
    const v = (value ?? label).trim();
    if (!l || !v) return;
    if (replies.some((x) => x.value === v || (!!href && x.href === href))) return;
    replies.push({ label: l, value: v, href });
  };
  const hasMoreTimes = /\(\+\s*ещ[её]\s*\d+\)/iu.test(content);

  // Priority actions must be visible even when we cap quick replies.
  if (hasMoreTimes) {
    add("Показать все", "покажи все свободное время");
  }

  const numberedLines = Array.from(content.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+([^\n]+)/g));
  if (numberedLines.length) {
    for (const m of numberedLines.slice(0, 10)) {
      const indexValue = m[1]?.trim() ?? "";
      const raw = (m[2] ?? "").trim();
      const normalized = raw.replace(/\s+/g, " ");
      const beforeColon = normalized.split(":")[0]?.trim() ?? normalized;
      const cleanLabel = beforeColon
        .replace(/^(сам|сама)\b.*$/i, "Самостоятельно")
        .replace(/^(оформить|через ассистента)\b.*$/i, "Через ассистента")
        .replace(/\(\+\s*ещ[её]\s*\d+\)/iu, "")
        .replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48);
      if (cleanLabel) {
        add(cleanLabel, cleanLabel);
      } else if (!isLocationSelectionReply && indexValue) {
        add(indexValue, indexValue);
      }
    }
  } else {
    const numbered = Array.from(content.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+/g)).map((m) => m[1]);
    if (numbered.length && !isLocationSelectionReply) {
      for (const n of numbered.slice(0, 10)) add(n ?? "");
    }
  }

  const times = Array.from(content.matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)).map((m) => `${m[1]}:${m[2]}`);
  if (times.length && shouldExtractTimeQuickReplies(content) && !isLocationSelectionReply) {
    const hasNegativeSingleTimeError = /нет доступных услуг|недоступн|укажите другое время/i.test(content) && times.length <= 1;
    const hasTimeListContext =
      /доступны времена|есть окна|ближайшие времена|свободных окон|в филиалах|выберите время/i.test(content) || times.length >= 2;
    if (hasNegativeSingleTimeError || !hasTimeListContext) {
      // Do not create a looping single-time button from error messages.
    } else {
    const hasCollapsedTail = /\(\+\s*ещ[её]\s*\d+\)/iu.test(content);
    const timeLimit = hasCollapsedTail ? 12 : 120;
    for (const tm of times.slice(0, timeLimit)) add(tm, tm);
    }
  }

  if (/сам\(а\)|сам в форме|онлайн-записи|как завершим запись/i.test(content)) {
    add("Самостоятельно", "самостоятельно");
    add("Через ассистента", "оформи через ассистента");
  }
  if (/нажмите кнопку «?записаться»? ниже|если все верно.*\b«?да»?\b/i.test(content)) add("Записаться", "да");

  const hasCollapsedTail = /\(\+\s*ещ[её]\s*\d+\)/iu.test(content);
  const finalLimit = hasCollapsedTail ? 24 : 120;
  const filtered = isLocationSelectionReply ? replies.filter((x) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.value)) : replies;
  return filtered.slice(0, finalLimit);
}

function parseYmd(ymd: string) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatYmdRuDate(ymd: string) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return `${String(p.d).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}

function monthStartYmd(ymd: string) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  return `${p.y}-${String(p.m).padStart(2, "0")}-01`;
}

function addMonthsYmd(ymd: string, delta: number) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const dt = new Date(Date.UTC(p.y, p.m - 1, 1, 12, 0, 0));
  dt.setUTCMonth(dt.getUTCMonth() + delta);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function getMonthLabelRu(ymd: string) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const names = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  return `${names[(p.m - 1 + 12) % 12]} ${p.y}`;
}

function buildDatePickerSubmitValue(selectedYmd: string, assistantText: string) {
  const dateRu = formatYmdRuDate(selectedYmd);
  const idMatch = assistantText.match(/запись\s*#\s*(\d{1,8})/i);
  const rescheduleContext = /(перенос|перенести|новую дату)/i.test(assistantText);
  if (idMatch?.[1] && rescheduleContext) {
    return `перенести #${idMatch[1]} на ${dateRu}`;
  }
  return dateRu;
}

function buildCalendarCells(viewMonthYmd: string, minDate: string, maxDate: string) {
  const p = parseYmd(viewMonthYmd);
  if (!p) return [] as Array<{ ymd: string; day: number; inMonth: boolean; disabled: boolean }>;
  const first = new Date(Date.UTC(p.y, p.m - 1, 1, 12, 0, 0));
  const firstWeekday = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - firstWeekday);
  const cells: Array<{ ymd: string; day: number; inMonth: boolean; disabled: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const inMonth = m === p.m;
    const disabled = ymd < minDate || ymd > maxDate;
    cells.push({ ymd, day, inMonth, disabled });
  }
  return cells;
}

function parseStoredThreadState(raw: string | null): StoredThreadState | null {
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) return { threadId: numeric, threadKey: null };
  try {
    const parsed = JSON.parse(raw) as { threadId?: unknown; threadKey?: unknown };
    const threadId = Number(parsed?.threadId);
    if (!Number.isInteger(threadId) || threadId <= 0) return null;
    const threadKey = typeof parsed?.threadKey === "string" && parsed.threadKey.trim().length >= 16 ? parsed.threadKey.trim() : null;
    return { threadId, threadKey };
  } catch {
    return null;
  }
}

function saveThreadState(storageKey: string, threadId: number, threadKey: string | null) {
  window.localStorage.setItem(storageKey, JSON.stringify({ threadId, threadKey }));
}

export default function PublicAiChatWidget(props: PublicAiChatWidgetProps) {
  const {
    accountSlug,
    widgetConfig,
    mode = "floating",
    defaultOpen = false,
    className,
    themeMode,
  } = props;
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [threadKey, setThreadKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [typingTarget, setTypingTarget] = useState("");
  const [typingVisible, setTypingVisible] = useState("");
  const [consentCheckedByMessage, setConsentCheckedByMessage] = useState<Record<string, boolean>>({});
  const [dateByMessage, setDateByMessage] = useState<Record<string, string>>({});
  const [dateMonthByMessage, setDateMonthByMessage] = useState<Record<string, string>>({});
  const [calendarHintByMessage, setCalendarHintByMessage] = useState<Record<string, string>>({});
  const [currentMode, setCurrentMode] = useState<"light" | "dark">(themeMode ?? "light");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(() => `ai-thread:${accountSlug}`, [accountSlug]);

  useEffect(() => {
    if (themeMode) setCurrentMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    // Inline mode in CRM preview is controlled by `themeMode` prop, not shared site storage.
    if (mode === "inline") return;

    const readStoredMode = () => {
      if (typeof window === "undefined") return null;
      const stored = window.localStorage.getItem("site-theme-mode");
      return stored === "light" || stored === "dark" ? stored : null;
    };

    const stored = readStoredMode();
    if (stored) setCurrentMode(stored);

    const onThemeChange = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: "light" | "dark" }>;
      const modeFromEvent = custom.detail?.mode;
      if (modeFromEvent === "light" || modeFromEvent === "dark") {
        setCurrentMode(modeFromEvent);
        return;
      }
      const next = readStoredMode();
      if (next) setCurrentMode(next);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "site-theme-mode") return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setCurrentMode(event.newValue);
      }
    };

    window.addEventListener("site-theme-change", onThemeChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("site-theme-change", onThemeChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [mode]);
  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);
  const widgetRootStyle = useMemo(() => {
    const vars: Record<string, string | number> = {};
    if (mode === "floating") {
      const bottom = Number(widgetConfig?.offsetBottomPx ?? 16);
      const right = Number(widgetConfig?.offsetRightPx ?? 16);
      vars.bottom = `${bottom}px`;
      vars.right = `${right}px`;
    }

    const setVar = (key: string, value?: string | null) => {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed) vars[key] = trimmed;
    };

    setVar("--ai-panel-light", widgetConfig?.panelColorLight ?? widgetConfig?.panelColor);
    setVar("--ai-panel-dark", widgetConfig?.panelColorDark ?? widgetConfig?.panelColor);
    setVar("--ai-text-light", widgetConfig?.textColorLight ?? widgetConfig?.textColor);
    setVar("--ai-text-dark", widgetConfig?.textColorDark ?? widgetConfig?.textColor);
    setVar("--ai-border-light", widgetConfig?.borderColorLight ?? widgetConfig?.borderColor);
    setVar("--ai-border-dark", widgetConfig?.borderColorDark ?? widgetConfig?.borderColor);
    setVar("--ai-button-light", widgetConfig?.buttonColorLight ?? widgetConfig?.buttonColor);
    setVar("--ai-button-dark", widgetConfig?.buttonColorDark ?? widgetConfig?.buttonColor);
    setVar("--ai-button-text-light", widgetConfig?.buttonTextColorLight ?? widgetConfig?.buttonTextColor);
    setVar("--ai-button-text-dark", widgetConfig?.buttonTextColorDark ?? widgetConfig?.buttonTextColor);
    setVar("--ai-header-bg-light", widgetConfig?.headerBgColorLight ?? widgetConfig?.headerBgColor);
    setVar("--ai-header-bg-dark", widgetConfig?.headerBgColorDark ?? widgetConfig?.headerBgColor);
    setVar("--ai-header-text-light", widgetConfig?.headerTextColorLight ?? widgetConfig?.headerTextColor);
    setVar("--ai-header-text-dark", widgetConfig?.headerTextColorDark ?? widgetConfig?.headerTextColor);
    setVar("--ai-assistant-bubble-light", widgetConfig?.assistantBubbleColorLight ?? widgetConfig?.assistantBubbleColor);
    setVar("--ai-assistant-bubble-dark", widgetConfig?.assistantBubbleColorDark ?? widgetConfig?.assistantBubbleColor);
    setVar("--ai-assistant-text-light", widgetConfig?.assistantTextColorLight ?? widgetConfig?.assistantTextColor);
    setVar("--ai-assistant-text-dark", widgetConfig?.assistantTextColorDark ?? widgetConfig?.assistantTextColor);
    setVar("--ai-client-bubble-light", widgetConfig?.clientBubbleColorLight ?? widgetConfig?.clientBubbleColor);
    setVar("--ai-client-bubble-dark", widgetConfig?.clientBubbleColorDark ?? widgetConfig?.clientBubbleColor);
    setVar("--ai-client-text-light", widgetConfig?.clientTextColorLight ?? widgetConfig?.clientTextColor);
    setVar("--ai-client-text-dark", widgetConfig?.clientTextColorDark ?? widgetConfig?.clientTextColor);
    setVar("--ai-quick-reply-button-light", widgetConfig?.quickReplyButtonColorLight ?? widgetConfig?.quickReplyButtonColor);
    setVar("--ai-quick-reply-button-dark", widgetConfig?.quickReplyButtonColorDark ?? widgetConfig?.quickReplyButtonColor);
    setVar("--ai-quick-reply-text-light", widgetConfig?.quickReplyTextColorLight ?? widgetConfig?.quickReplyTextColor);
    setVar("--ai-quick-reply-text-dark", widgetConfig?.quickReplyTextColorDark ?? widgetConfig?.quickReplyTextColor);

    const pickMode = (light?: string | null, dark?: string | null, base?: string | null) =>
      currentMode === "dark" ? dark ?? light ?? base : light ?? dark ?? base;

    setVar("--ai-panel", pickMode(widgetConfig?.panelColorLight, widgetConfig?.panelColorDark, widgetConfig?.panelColor));
    setVar("--ai-text", pickMode(widgetConfig?.textColorLight, widgetConfig?.textColorDark, widgetConfig?.textColor));
    setVar("--ai-border", pickMode(widgetConfig?.borderColorLight, widgetConfig?.borderColorDark, widgetConfig?.borderColor));
    setVar("--ai-button", pickMode(widgetConfig?.buttonColorLight, widgetConfig?.buttonColorDark, widgetConfig?.buttonColor));
    setVar("--ai-button-text", pickMode(widgetConfig?.buttonTextColorLight, widgetConfig?.buttonTextColorDark, widgetConfig?.buttonTextColor));
    setVar("--ai-header-bg", pickMode(widgetConfig?.headerBgColorLight, widgetConfig?.headerBgColorDark, widgetConfig?.headerBgColor));
    setVar("--ai-header-text", pickMode(widgetConfig?.headerTextColorLight, widgetConfig?.headerTextColorDark, widgetConfig?.headerTextColor));
    setVar("--ai-assistant-bubble", pickMode(widgetConfig?.assistantBubbleColorLight, widgetConfig?.assistantBubbleColorDark, widgetConfig?.assistantBubbleColor));
    setVar("--ai-assistant-text", pickMode(widgetConfig?.assistantTextColorLight, widgetConfig?.assistantTextColorDark, widgetConfig?.assistantTextColor));
    setVar("--ai-client-bubble", pickMode(widgetConfig?.clientBubbleColorLight, widgetConfig?.clientBubbleColorDark, widgetConfig?.clientBubbleColor));
    setVar("--ai-client-text", pickMode(widgetConfig?.clientTextColorLight, widgetConfig?.clientTextColorDark, widgetConfig?.clientTextColor));
    setVar("--ai-quick-reply-button", pickMode(widgetConfig?.quickReplyButtonColorLight, widgetConfig?.quickReplyButtonColorDark, widgetConfig?.quickReplyButtonColor));
    setVar("--ai-quick-reply-text", pickMode(widgetConfig?.quickReplyTextColorLight, widgetConfig?.quickReplyTextColorDark, widgetConfig?.quickReplyTextColor));

    return vars as CSSProperties;
  }, [widgetConfig, mode, currentMode]);


  const panelWidth = Number(widgetConfig?.panelWidthPx ?? 380);
  const panelHeightVh = Number(widgetConfig?.panelHeightVh ?? 70);
  const panelRadius = Number(widgetConfig?.radiusPx ?? 16);
  const messageRadius = Number(widgetConfig?.messageRadiusPx ?? 16);
  const panelShadowSize = Math.max(0, Number(widgetConfig?.panelShadowSize ?? 16));
  const panelShadowColor = widgetConfig?.panelShadowColor?.trim() || "rgba(0,0,0,0.16)";
  const headerTitle = (widgetConfig?.headerTitle || "AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u0437\u0430\u043f\u0438\u0441\u0438").trim() || "AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u0437\u0430\u043f\u0438\u0441\u0438";
  const fabRadius = Number(widgetConfig?.buttonRadiusPx ?? 999);
  const buttonRadiusStyle = { borderRadius: `${fabRadius}px` };
  const messageRadiusStyle = { borderRadius: `${messageRadius}px` };
  const fabLabel = (widgetConfig?.label || "AI-\u0447\u0430\u0442").trim() || "AI-\u0447\u0430\u0442";
  const inlineFabPosition: CSSProperties =
    mode === "inline"
      ? {
          position: "absolute",
          right: `${Number(widgetConfig?.offsetRightPx ?? 16)}px`,
          bottom: `${Number(widgetConfig?.offsetBottomPx ?? 16)}px`,
        }
      : {};
  const gradientEnabledByMode =
    currentMode === "dark"
      ? (widgetConfig?.gradientEnabledDark ?? widgetConfig?.gradientEnabled)
      : (widgetConfig?.gradientEnabledLight ?? widgetConfig?.gradientEnabled);
  const gradientDirectionByMode =
    currentMode === "dark"
      ? (widgetConfig?.gradientDirectionDark ?? widgetConfig?.gradientDirection)
      : (widgetConfig?.gradientDirectionLight ?? widgetConfig?.gradientDirection);
  const panelGradientFromByMode =
    currentMode === "dark"
      ? (widgetConfig?.panelGradientFromDark ?? widgetConfig?.panelGradientFrom)
      : (widgetConfig?.panelGradientFromLight ?? widgetConfig?.panelGradientFrom);
  const panelGradientToByMode =
    currentMode === "dark"
      ? (widgetConfig?.panelGradientToDark ?? widgetConfig?.panelGradientTo)
      : (widgetConfig?.panelGradientToLight ?? widgetConfig?.panelGradientTo);
  const panelBackground =
    gradientEnabledByMode && panelGradientFromByMode && panelGradientToByMode
      ? `linear-gradient(${gradientDirectionByMode === "horizontal" ? "to right" : "to bottom"}, ${panelGradientFromByMode}, ${panelGradientToByMode})`
      : undefined;
  const calendarShellClass =
    currentMode === "dark"
      ? "mt-2 rounded-xl border border-[color:var(--ai-border,#334155)] bg-white/5 p-2"
      : "mt-2 rounded-xl border border-[color:var(--ai-border,#e5e7eb)] bg-white/70 p-2";
  const consentShellClass =
    currentMode === "dark"
      ? "mt-2 rounded-xl border border-[color:var(--ai-border,#334155)] bg-white/5 p-2"
      : "mt-2 rounded-xl border border-[color:var(--ai-border,#e5e7eb)] bg-white/60 p-2";
  const loadingBubbleClass =
    currentMode === "dark"
      ? "max-w-[90%] bg-white/10 px-3 py-2 text-sm text-[color:var(--ai-muted,#9ca3af)]"
      : "max-w-[90%] bg-black/5 px-3 py-2 text-sm text-[color:var(--ai-muted,#6b7280)]";

  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  useEffect(() => {
    if (!open) return
    const node = bottomRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, loading, open, typingVisible]);

  useEffect(() => {
    if (!open) return
    if (messages.length > 0) return;
    const greeting = "Здравствуйте! Я Аиша. Напишите, что хотите: например услугу, дату или время, и я помогу с записью.";
    const greetingUi: ChatUi = {
      kind: "quick_replies",
      options: [
        { label: "Записаться сегодня", value: "запиши меня сегодня" },
      ],
    };
    setMessages((prev) => {
      if (prev.length) return prev;
      const next: ChatMessage[] = [{ role: "assistant", content: greeting, ui: greetingUi }];
      setTypingMessageIndex(0);
      setTypingTarget(stripLegalRefs(greeting));
      setTypingVisible("");
      return next;
    });
  }, [open, messages.length]);

  useEffect(() => {
    if (typingMessageIndex == null) return;
    if (!typingTarget) return;
    if (typingVisible === typingTarget) return;
    const step = Math.max(1, Math.ceil(typingTarget.length / 80));
    const next = typingTarget.slice(0, typingVisible.length + step);
    const timer = window.setTimeout(() => setTypingVisible(next), 14);
    return () => window.clearTimeout(timer);
  }, [typingMessageIndex, typingTarget, typingVisible]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const savedThread = parseStoredThreadState(window.localStorage.getItem(storageKey));
      const threadQuery =
        savedThread && savedThread.threadId > 0
          ? `&threadId=${savedThread.threadId}${savedThread.threadKey ? `&threadKey=${encodeURIComponent(savedThread.threadKey)}` : ""}`
          : "";
      const response = await fetch(
        `/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}${threadQuery}`,
        { cache: "no-store", credentials: "include" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data || cancelled) return;

      const nextThreadId = Number(payload.data.threadId);
      const nextThreadKey = typeof payload.data.threadKey === "string" ? payload.data.threadKey : null;
      if (Number.isInteger(nextThreadId) && nextThreadId > 0) {
        setThreadId(nextThreadId);
        setThreadKey(nextThreadKey);
        saveThreadState(storageKey, nextThreadId, nextThreadKey);
      }
      const apiMessages = Array.isArray(payload.data.messages) ? (payload.data.messages as Message[]) : [];
      setMessages(apiMessages.length > 0 ? apiMessages.map((m) => ({ ...m, ui: null })) : []);
      setTypingMessageIndex(null);
      setTypingTarget("");
      setTypingVisible("");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountSlug, storageKey]);

  const sendRawMessage = async (rawText: string) => {
    const userText = rawText.trim();
    if (!userText || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const now = new Date();
      const clientTodayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`;
      const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await fetch(`/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userText,
          threadId,
          threadKey,
          clientTodayYmd,
          clientTimeZone,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data?.reply) {
        throw new Error(payload?.error?.message || "Не удалось получить ответ ассистента.");
      }

      const nextThreadId = Number(payload.data.threadId);
      if (Number.isInteger(nextThreadId) && nextThreadId > 0) {
        setThreadId(nextThreadId);
        window.localStorage.setItem(storageKey, String(nextThreadId));
      }

      const action = (payload.data.action ?? null) as ChatAction;
      if (action?.type === "open_booking") {
        if (typeof window !== "undefined") {
          window.location.assign(action.bookingUrl);
          return;
        }
      }

      const assistantReply = String(payload.data.reply);
      const assistantUi = (payload.data.ui ?? null) as ChatUi | null;
      const assistantTypingText = stripLegalRefs(assistantReply);
      const isStructuredReply =
        Boolean(
          assistantUi &&
            ((assistantUi.kind === "quick_replies" && assistantUi.options.length > 0) || assistantUi.kind === "consent" || assistantUi.kind === "date_picker"),
        ) ||
        extractQuickReplies(assistantReply).length > 0;
      if (isStructuredReply) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
      }
      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: "assistant", content: assistantReply, ui: assistantUi }];
        setTypingMessageIndex(next.length - 1);
        setTypingTarget(assistantTypingText);
        setTypingVisible("");
        return next;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Сейчас не получилось ответить. Попробуйте еще раз.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const userText = text.trim();
    setText("");
    await sendRawMessage(userText);
  };

  const clearChat = async () => {
    if (threadId) {
      try {
        const response = await fetch(
          `/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}&threadId=${threadId}${threadKey ? `&threadKey=${encodeURIComponent(threadKey)}` : ""}`,
          { method: "DELETE", credentials: "include" }
        );
        const payload = await response.json().catch(() => null);
        const nextThreadId = Number(payload?.data?.threadId);
        const nextThreadKey = typeof payload?.data?.threadKey === "string" ? payload.data.threadKey : null;
        if (response.ok && Number.isInteger(nextThreadId) && nextThreadId > 0) {
          setThreadId(nextThreadId);
          setThreadKey(nextThreadKey);
          saveThreadState(storageKey, nextThreadId, nextThreadKey);
        } else {
          window.localStorage.removeItem(storageKey);
          setThreadId(null);
          setThreadKey(null);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
        setThreadId(null);
        setThreadKey(null);
      }
    } else {
      window.localStorage.removeItem(storageKey);
      setThreadId(null);
      setThreadKey(null);
    }
    setMessages([]);
    setConsentCheckedByMessage({});
  };

  const rootClass = mode === "floating" ? "public-ai-widget fixed z-[140]" : `public-ai-widget absolute z-[1] ${className ?? ""}`;
  const panelStyle: CSSProperties =
    mode === "floating"
      ? {
          height: `${panelHeightVh}vh`,
          width: `min(${panelWidth}px, calc(100vw - 2rem))`,
          borderRadius: panelRadius,
          backgroundImage: panelBackground,
          boxShadow: panelShadowSize > 0 ? `0 ${Math.round(panelShadowSize)}px ${Math.round(panelShadowSize * 3)}px ${panelShadowColor}` : "none",
        }
      : {
          position: "absolute",
          right: 0,
          bottom: 0,
          height: `${panelHeightVh}vh`,
          maxHeight: `${panelHeightVh}vh`,
          width: `${panelWidth}px`,
          maxWidth: "100%",
          borderRadius: panelRadius,
          backgroundImage: panelBackground,
          backgroundColor: widgetConfig?.panelColor || undefined,
          boxShadow: panelShadowSize > 0 ? `0 ${Math.round(panelShadowSize)}px ${Math.round(panelShadowSize * 3)}px ${panelShadowColor}` : "none",
        };

  const headerStyle: CSSProperties = {
    backgroundColor: "var(--ai-header-bg, var(--ai-panel, transparent))",
    color: "var(--ai-header-text, var(--ai-text,#111827))",
  };
  const headerActionStyle: CSSProperties = {
    color: "var(--ai-header-text, var(--ai-text,#111827))",
  };

  return (
    <div className={rootClass} style={widgetRootStyle}>
      {open ? (
        <div className="flex flex-col overflow-hidden border border-[color:var(--ai-border,#e5e7eb)] bg-[color:var(--ai-panel,#fff)]" style={panelStyle}>
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ai-border,#e5e7eb)] px-4 py-3" style={headerStyle}>
            <div className="text-sm font-semibold text-[color:var(--ai-text,#111827)]" style={headerActionStyle}>
              {headerTitle}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg px-2 py-1 text-xs text-[color:var(--ai-muted,#6b7280)] hover:bg-black/5"
                style={headerActionStyle}
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-[color:var(--ai-muted,#6b7280)] hover:bg-black/5"
                style={headerActionStyle}
              >
                Закрыть
              </button>
            </div>
          </div>

          <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((msg, index) => (
              (() => {
                const messageKey = `${msg.role}-${msg.id ?? index}`;
                const isLastAssistant = msg.role === "assistant" && index === lastAssistantIndex;
                const ui = msg.ui ?? null;
                const options =
                  msg.role === "assistant"
                    ? ui?.kind === "quick_replies"
                      ? ui.options
                      : ui
                      ? []
                      : extractQuickReplies(msg.content)
                    : [];
                const legalLinks =
                  ui?.kind === "consent"
                    ? ui.legalLinks
                    : Array.from(new Set(Array.from(msg.content.matchAll(/\/[A-Za-z0-9_-]+\/legal\/\d+/g)).map((m) => m[0]).filter(Boolean)));
                const showConsentControl =
                  msg.role === "assistant" &&
                  (ui?.kind === "consent" || /согласие на обработку персональных данных/i.test(msg.content));
                const consentChecked = consentCheckedByMessage[messageKey] ?? false;
                const datePickerValue =
                  ui?.kind === "date_picker"
                    ? dateByMessage[messageKey] ?? ui.initialDate ?? ""
                    : "";
                const datePickerViewMonth =
                  ui?.kind === "date_picker"
                    ? dateMonthByMessage[messageKey] ?? monthStartYmd(datePickerValue || ui.initialDate || ui.minDate)
                    : "";
                const datePickerCells =
                  ui?.kind === "date_picker"
                    ? buildCalendarCells(datePickerViewMonth, ui.minDate, ui.maxDate)
                    : [];
                const availableDateSet =
                  ui?.kind === "date_picker" && Array.isArray(ui.availableDates)
                    ? new Set(ui.availableDates)
                    : null;
                const isDateAvailable = (ymd: string) => (availableDateSet ? availableDateSet.has(ymd) : true);
                const datePickerHint = calendarHintByMessage[messageKey] ?? "";
                const selectedDateIsAvailable = datePickerValue ? isDateAvailable(datePickerValue) : false;
                const prevMonth = ui?.kind === "date_picker" ? addMonthsYmd(datePickerViewMonth, -1) : "";
                const nextMonth = ui?.kind === "date_picker" ? addMonthsYmd(datePickerViewMonth, 1) : "";
                const canPrevMonth = ui?.kind === "date_picker" ? prevMonth >= monthStartYmd(ui.minDate) : false;
                const canNextMonth = ui?.kind === "date_picker" ? nextMonth <= monthStartYmd(ui.maxDate) : false;
                const isTypingThis =
                  msg.role === "assistant" &&
                  typingMessageIndex === index &&
                  typingVisible !== typingTarget;
                const sourceText =
                  msg.role === "assistant" && typingMessageIndex === index
                    ? typingVisible || ""
                    : msg.content;
                const safeSourceText = isTypingThis ? sourceText : sourceText || msg.content;
                const sourceTextNoLegal = stripLegalRefs(safeSourceText);
                const shownText = msg.role === "assistant" ? sourceTextNoLegal || safeSourceText : safeSourceText;
                const effectiveOptions = showConsentControl
                  ? options.filter((o) => !/согласен на обработку персональных данных/i.test(o.value))
                  : options;
                const isTimeValue = (v: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.trim());
                const normalizeQuick = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
                const timeControlKind = (option: QuickReply): "show_all" | "part_of_day" | null => {
                  const value = normalizeQuick(option.value);
                  const label = normalizeQuick(option.label);
                  const merged = `${value} ${label}`;
                  if (/(покажи|показать).*(все|всё).*(врем|слот|окошк)/iu.test(merged)) return "show_all";
                  if (/(утро|утром|день|днем|днём|вечер|вечером)/iu.test(merged)) return "part_of_day";
                  return null;
                };
                const timeControlOptions = effectiveOptions.filter((o) => timeControlKind(o) !== null);
                const showAllTimeOptions = timeControlOptions.filter((o) => timeControlKind(o) === "show_all");
                const partOfDayOptions = timeControlOptions.filter((o) => timeControlKind(o) === "part_of_day");
                const regularOptions = effectiveOptions.filter((o) => timeControlKind(o) === null);
                const hasAnyTimeOptions = regularOptions.some((o) => isTimeValue(o.value) || isTimeValue(o.label));
                const consentSubmitValue =
                  ui?.kind === "consent"
                    ? ui.consentValue
                    : "\u0421\u043e\u0433\u043b\u0430\u0441\u0435\u043d \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445";
                return (
                  <div
                    key={messageKey}
                    className={`max-w-[92%] px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-auto bg-[color:var(--ai-client-bubble,var(--ai-button,#111827))] text-[color:var(--ai-client-text,var(--ai-button-text,#fff))]"
                        : "bg-[color:var(--ai-assistant-bubble,rgba(0,0,0,0.05))] text-[color:var(--ai-assistant-text,var(--ai-text,#111827))]"
                    }`}
                    style={messageRadiusStyle}
                  >
                    {shownText ? <div>{shownText}</div> : null}
                    {effectiveOptions.length && !isTypingThis ? (
                      <div className="mt-2 space-y-2">
                        {timeControlOptions.length ? (
                          <div className="space-y-1">
                            {showAllTimeOptions.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {showAllTimeOptions.map((option) => (
                                  <button
                                    key={`${option.label}:${option.value}`}
                                    type="button"
                                    disabled={loading || !isLastAssistant}
                                    onClick={() => {
                                      if (option.href) {
                                        if (typeof window !== "undefined") {
                                          window.location.assign(option.href);
                                        }
                                        return;
                                      }
                                      void sendRawMessage(option.value);
                                    }}
                                    style={buttonRadiusStyle}
                                    className={`border px-3 py-1.5 text-xs font-medium transition rounded-full ${
                                      isLastAssistant
                                        ? (currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-[color:var(--ai-quick-reply-button,var(--ai-button,#1f2937))] text-[color:var(--ai-quick-reply-text,var(--ai-text,#f9fafb))] hover:brightness-110" : "border-transparent bg-[color:var(--ai-quick-reply-button,var(--ai-button,#111827))] text-[color:var(--ai-quick-reply-text,var(--ai-button-text,#fff))] hover:brightness-95")
                                        : "border-[color:var(--ai-border,#d1d5db)] bg-black/0 text-[color:var(--ai-muted,#6b7280)]"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {partOfDayOptions.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {partOfDayOptions.map((option) => (
                                  <button
                                    key={`${option.label}:${option.value}`}
                                    type="button"
                                    disabled={loading || !isLastAssistant}
                                    onClick={() => {
                                      if (option.href) {
                                        if (typeof window !== "undefined") {
                                          window.location.assign(option.href);
                                        }
                                        return;
                                      }
                                      void sendRawMessage(option.value);
                                    }}
                                    style={buttonRadiusStyle}
                                    className={`border px-3 py-1.5 text-xs font-medium transition rounded-full ${
                                      isLastAssistant
                                        ? (currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-[color:var(--ai-quick-reply-button,var(--ai-button,#1f2937))] text-[color:var(--ai-quick-reply-text,var(--ai-text,#f9fafb))] hover:brightness-110" : "border-transparent bg-[color:var(--ai-quick-reply-button,var(--ai-button,#111827))] text-[color:var(--ai-quick-reply-text,var(--ai-button-text,#fff))] hover:brightness-95")
                                        : "border-[color:var(--ai-border,#d1d5db)] bg-black/0 text-[color:var(--ai-muted,#6b7280)]"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {regularOptions.length ? (
                          <div className={`flex flex-wrap gap-1.5 ${hasAnyTimeOptions ? "items-stretch" : ""}`}>
                            {regularOptions.map((option) => (
                              (() => {
                                const isTimeOption = isTimeValue(option.value) || isTimeValue(option.label);
                                return (
                                  <button
                                    key={`${option.label}:${option.value}`}
                                    type="button"
                                    disabled={loading || !isLastAssistant}
                                    onClick={() => {
                                      if (option.href) {
                                        if (typeof window !== "undefined") {
                                          window.location.assign(option.href);
                                        }
                                        return;
                                      }
                                      void sendRawMessage(option.value);
                                    }}
                                    style={buttonRadiusStyle}
                                    className={`border px-3 py-1.5 text-xs font-medium transition ${
                                      isTimeOption
                                        ? "w-[62px] rounded-lg text-center [font-variant-numeric:tabular-nums]"
                                        : "rounded-full"
                                    } ${
                                      isLastAssistant
                                        ? (currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-[color:var(--ai-quick-reply-button,var(--ai-button,#1f2937))] text-[color:var(--ai-quick-reply-text,var(--ai-text,#f9fafb))] hover:brightness-110" : "border-transparent bg-[color:var(--ai-quick-reply-button,var(--ai-button,#111827))] text-[color:var(--ai-quick-reply-text,var(--ai-button-text,#fff))] hover:brightness-95")
                                        : "border-[color:var(--ai-border,#d1d5db)] bg-black/0 text-[color:var(--ai-muted,#6b7280)]"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })()
                            ))}
                          </div>
                        ) : null}
                      </div>
                     ) : null}
                    {ui?.kind === "date_picker" && !isTypingThis ? (
                      <div className={calendarShellClass}>
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            disabled={loading || !isLastAssistant || !canPrevMonth}
                            onClick={() =>
                              setDateMonthByMessage((prev) => ({
                                ...prev,
                                [messageKey]: prevMonth,
                              }))
                            }
                            style={buttonRadiusStyle}
                            className={`h-7 w-7 rounded-md border text-xs disabled:opacity-40 ${currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-white/5 text-[color:var(--ai-text,#f3f4f6)]" : "border-[color:var(--ai-border,#d1d5db)] bg-white text-[color:var(--ai-text,#111827)]"}`}
                          >
                            ‹
                          </button>
                          <div className={`text-xs font-medium ${currentMode === "dark" ? "text-[color:var(--ai-text,#f3f4f6)]" : "text-[color:var(--ai-text,#111827)]"}`}>{getMonthLabelRu(datePickerViewMonth)}</div>
                          <button
                            type="button"
                            disabled={loading || !isLastAssistant || !canNextMonth}
                            onClick={() =>
                              setDateMonthByMessage((prev) => ({
                                ...prev,
                                [messageKey]: nextMonth,
                              }))
                            }
                            style={buttonRadiusStyle}
                            className={`h-7 w-7 rounded-md border text-xs disabled:opacity-40 ${currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-white/5 text-[color:var(--ai-text,#f3f4f6)]" : "border-[color:var(--ai-border,#d1d5db)] bg-white text-[color:var(--ai-text,#111827)]"}`}
                          >
                            ›
                          </button>
                        </div>
                        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-[color:var(--ai-muted,#6b7280)]">
                          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => (
                            <div key={`${messageKey}-${d}`}>{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {datePickerCells.map((cell) => {
                            const isUnavailable = !isDateAvailable(cell.ymd);
                            const inactive = cell.disabled || isUnavailable || !cell.inMonth;
                            const selected = cell.ymd === datePickerValue;
                            return (
                              <button
                                key={`${messageKey}-${cell.ymd}`}
                                type="button"
                                disabled={loading || !isLastAssistant}
                                onClick={() => {
                                  if (inactive) {
                                    setCalendarHintByMessage((prev) => ({
                                      ...prev,
                                      [messageKey]: `На ${formatYmdRuDate(cell.ymd)} свободного времени для записи нет.`,
                                    }));
                                    return;
                                  }
                                  setCalendarHintByMessage((prev) => ({
                                    ...prev,
                                    [messageKey]: "",
                                  }));
                                  setDateByMessage((prev) => ({
                                    ...prev,
                                    [messageKey]: cell.ymd,
                                  }));
                                }}
                                style={buttonRadiusStyle}
                                className={`h-7 rounded-md text-[11px] ${selected ? (currentMode === 'dark' ? 'bg-[color:var(--ai-client-bubble,#0b1220)] text-[color:var(--ai-client-text,#f8fafc)] ring-1 ring-[color:var(--ai-border,#334155)]' : 'bg-[color:var(--ai-button,#111827)] text-[color:var(--ai-button-text,#fff)]') : inactive ? (currentMode === 'dark' ? 'bg-white/5 text-[color:var(--ai-muted,#9ca3af)]' : 'bg-black/5 text-[color:var(--ai-muted,#9ca3af)]') : cell.inMonth ? (currentMode === 'dark' ? 'bg-white/10 text-[color:var(--ai-text,#f3f4f6)]' : 'bg-white text-[color:var(--ai-text,#111827)]') : (currentMode === 'dark' ? 'bg-white/5 text-[color:var(--ai-muted,#9ca3af)]' : 'bg-black/5 text-[color:var(--ai-muted,#9ca3af)]')} ${inactive ? 'cursor-not-allowed' : ''} disabled:opacity-35`}
                              >
                                {cell.day}
                              </button>
                            );
                          })}
                        </div>
                        {datePickerHint ? <div className={`mt-2 text-[11px] ${currentMode === "dark" ? "text-amber-300" : "text-amber-700"}`}>{datePickerHint}</div> : null}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-[11px] text-[color:var(--ai-muted,#6b7280)]">{datePickerValue ? formatYmdRuDate(datePickerValue) : "Выберите дату"}</div>
                          <button
                            type="button"
                            disabled={loading || !isLastAssistant || !datePickerValue || !selectedDateIsAvailable}
                            onClick={() => void sendRawMessage(buildDatePickerSubmitValue(datePickerValue, msg.content))}
                            style={buttonRadiusStyle}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${currentMode === "dark" ? "bg-[color:var(--ai-button,#1f2937)] text-[color:var(--ai-button-text,#f9fafb)] ring-1 ring-[color:var(--ai-border,#334155)]" : "bg-[color:var(--ai-button,#111827)] text-[color:var(--ai-button-text,#fff)]"}`}
                          >
                            Выбрать
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {showConsentControl && !isTypingThis ? (
                      <div className={consentShellClass}>
                        {legalLinks.length ? (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {legalLinks.map((href, i) => (
                              <button
                                key={`consent-link-${i}-${href}`}
                                type="button"
                                disabled={!isLastAssistant}
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    window.open(href, "_blank", "noopener,noreferrer");
                                  }
                                }}
                                style={buttonRadiusStyle}
                                className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60 ${currentMode === "dark" ? "border-[color:var(--ai-border,#334155)] bg-white/5 text-[color:var(--ai-text,#f3f4f6)] hover:bg-white/10" : "border-[color:var(--ai-border,#d1d5db)] bg-white text-[color:var(--ai-text,#111827)]"}`}
                              >
                                Текст ПДн {i + 1}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <label className="flex items-start gap-2 text-xs text-[color:var(--ai-text,#111827)]">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={consentChecked}
                            disabled={!isLastAssistant}
                            onChange={(e) =>
                              setConsentCheckedByMessage((prev) => ({
                                ...prev,
                                [messageKey]: e.target.checked,
                              }))
                            }
                          />
                          <span>Согласен на обработку персональных данных</span>
                        </label>
                        <button
                          type="button"
                          disabled={loading || !isLastAssistant || !consentChecked}
                          onClick={() => void sendRawMessage(consentSubmitValue)}
                          style={buttonRadiusStyle}
                          className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${currentMode === "dark" ? "bg-[color:var(--ai-button,#1f2937)] text-[color:var(--ai-button-text,#f9fafb)] ring-1 ring-[color:var(--ai-border,#334155)]" : "bg-[color:var(--ai-button,#111827)] text-[color:var(--ai-button-text,#fff)]"}`}
                        >
                          Подтвердить
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ))}
            {loading ? (
              <div className={loadingBubbleClass} style={messageRadiusStyle}>
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ai-muted,#6b7280)]"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ai-muted,#6b7280)]"
                    style={{ animationDelay: "120ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ai-muted,#6b7280)]"
                    style={{ animationDelay: "240ms" }}
                  />
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-[color:var(--ai-border,#e5e7eb)] p-3">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Введите сообщение"
                className="h-10 flex-1 rounded-xl border border-[color:var(--ai-border,#e5e7eb)] bg-transparent px-3 text-sm text-[color:var(--ai-text,#111827)] outline-none"
              />
              <button
                type="submit"
                disabled={!canSend}
                style={buttonRadiusStyle}
                className="h-10 rounded-xl bg-[color:var(--ai-button,#111827)] px-3 text-sm font-medium text-[color:var(--ai-button-text,#fff)] disabled:opacity-50"
              >
                Отпр.
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 bg-[color:var(--ai-button,#111827)] px-4 py-3 text-sm font-semibold text-[color:var(--ai-button-text,#fff)] shadow-[0_10px_28px_rgba(0,0,0,0.28)] ring-1 ring-white/20 transition hover:brightness-105" style={{ borderRadius: fabRadius, ...inlineFabPosition }}
          aria-label="Открыть AI-ассистента"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.22)]" />
          <span className="whitespace-nowrap">{fabLabel}</span>
        </button>
      )}
    </div>
  );
}


