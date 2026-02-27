"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = { id?: number; role: "user" | "assistant"; content: string };
type ChatAction = { type: "open_booking"; bookingUrl: string } | null;
type QuickReply = { label: string; value: string; href?: string };

type PublicAiChatWidgetProps = {
  accountSlug: string;
};

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
  if (/выберите (дату|другую дату)/i.test(content)) add("Завтра", "завтра");
  const hasCollapsedTail = /\(\+\s*ещ[её]\s*\d+\)/iu.test(content);
  const finalLimit = hasCollapsedTail ? 24 : 120;
  const filtered = isLocationSelectionReply ? replies.filter((x) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.value)) : replies;
  return filtered.slice(0, finalLimit);
}

function compactAssistantText(content: string, options: QuickReply[]) {
  if (!options.length) return content;
  const lines = content
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const hasDenseLists = lines.some((line) => {
    if (/^\d{1,2}\.\s+/i.test(line)) return true;
    if (/\/[A-Za-z0-9_-]+\/legal\/\d+/i.test(line)) return false;
    const timeMatches = line.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/g) ?? [];
    return timeMatches.length >= 3;
  });

  const filtered = lines.filter((line) => {
    if (/^\d{1,2}\.\s+/i.test(line)) return false;
    if (/\/[A-Za-z0-9_-]+\/legal\/\d+/i.test(line)) return false;
    if (/^(можно|выберите|напишите|укажите|наши локации:|доступные услуги:)\b/i.test(line)) return false;
    if (/^(нашла окна|на \d{2}\.\d{2}\.\d{4} .*есть окна|на \d{2}\.\d{2}\.\d{4} доступны времена)/i.test(line)) return false;
    const timeMatches = line.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/g) ?? [];
    if (timeMatches.length >= 3) return false;
    return true;
  });

  if (filtered.length) {
    return filtered.join("\n");
  }

  if (hasDenseLists) return "";
  return lines[0] ?? content;
}

export default function PublicAiChatWidget({ accountSlug }: PublicAiChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(null);
  const [typingTarget, setTypingTarget] = useState("");
  const [typingVisible, setTypingVisible] = useState("");
  const [consentCheckedByMessage, setConsentCheckedByMessage] = useState<Record<string, boolean>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(() => `ai-thread:${accountSlug}`, [accountSlug]);
  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const node = bottomRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading, open]);

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
      const savedThreadIdRaw = window.localStorage.getItem(storageKey);
      const savedThreadId = savedThreadIdRaw ? Number(savedThreadIdRaw) : null;
      const threadQuery =
        Number.isInteger(savedThreadId) && savedThreadId! > 0
          ? `&threadId=${savedThreadId}`
          : "";
      const response = await fetch(
        `/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}${threadQuery}`,
        { cache: "no-store", credentials: "include" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data || cancelled) return;

      const nextThreadId = Number(payload.data.threadId);
      if (Number.isInteger(nextThreadId) && nextThreadId > 0) {
        setThreadId(nextThreadId);
        window.localStorage.setItem(storageKey, String(nextThreadId));
      }
      const apiMessages = Array.isArray(payload.data.messages)
        ? (payload.data.messages as Message[])
        : [];
      setMessages(apiMessages.length > 0 ? apiMessages : []);
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
      setMessages((prev) => {
        const next: Message[] = [...prev, { role: "assistant", content: assistantReply } as Message];
        setTypingMessageIndex(next.length - 1);
        setTypingTarget(assistantReply);
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
          `/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}&threadId=${threadId}`,
          { method: "DELETE", credentials: "include" }
        );
        const payload = await response.json().catch(() => null);
        const nextThreadId = Number(payload?.data?.threadId);
        if (response.ok && Number.isInteger(nextThreadId) && nextThreadId > 0) {
          setThreadId(nextThreadId);
          window.localStorage.setItem(storageKey, String(nextThreadId));
        } else {
          window.localStorage.removeItem(storageKey);
          setThreadId(null);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
        setThreadId(null);
      }
    } else {
      window.localStorage.removeItem(storageKey);
      setThreadId(null);
    }
    setMessages([]);
    setConsentCheckedByMessage({});
  };

  return (
    <div className="fixed bottom-4 right-4 z-[140]">
      {open ? (
        <div className="flex h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col rounded-2xl border border-[color:var(--site-border,#e5e7eb)] bg-[color:var(--site-panel,#fff)] shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--site-border,#e5e7eb)] px-4 py-3">
            <div className="text-sm font-semibold text-[color:var(--site-text,#111827)]">
              AI-ассистент записи
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg px-2 py-1 text-xs text-[color:var(--site-muted,#6b7280)] hover:bg-black/5"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-[color:var(--site-muted,#6b7280)] hover:bg-black/5"
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
                const options = msg.role === "assistant" ? extractQuickReplies(msg.content) : [];
                const hasStructuredChoices = options.length > 0;
                const legalLinks = Array.from(
                  new Set(
                    Array.from(msg.content.matchAll(/\/[A-Za-z0-9_-]+\/legal\/\d+/g)).map((m) => m[0]).filter(Boolean),
                  ),
                );
                const showConsentControl =
                  msg.role === "assistant" &&
                  /согласие на обработку персональных данных/i.test(msg.content);
                const consentChecked = consentCheckedByMessage[messageKey] ?? false;
                const isTypingThis =
                  msg.role === "assistant" &&
                  typingMessageIndex === index &&
                  typingVisible !== typingTarget &&
                  !hasStructuredChoices;
                const sourceText =
                  msg.role === "assistant" && typingMessageIndex === index && !hasStructuredChoices
                    ? typingVisible || ""
                    : msg.content;
                const sourceTextNoLegal = sourceText.replace(/\/[A-Za-z0-9_-]+\/legal\/\d+/g, "").replace(/\s{2,}/g, " ").trim();
                const shownText =
                  msg.role === "assistant"
                    ? compactAssistantText(sourceTextNoLegal || sourceText || msg.content, options)
                    : sourceText || msg.content;
                const effectiveOptions = showConsentControl
                  ? options.filter((o) => !/согласен на обработку персональных данных/i.test(o.value))
                  : options;
                return (
                  <div
                    key={messageKey}
                    className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-auto bg-[color:var(--site-button,#111827)] text-[color:var(--site-button-text,#fff)]"
                        : "bg-black/5 text-[color:var(--site-text,#111827)]"
                    }`}
                  >
                    {shownText ? <div>{shownText}</div> : null}
                    {effectiveOptions.length && !isTypingThis ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {effectiveOptions.map((option) => (
                          <button
                            key={`${option.label}:${option.value}`}
                            type="button"
                            disabled={loading || !isLastAssistant}
                            onClick={() => {
                              if (option.href) {
                                if (typeof window !== "undefined") {
                                  window.open(option.href, "_blank", "noopener,noreferrer");
                                }
                                return;
                              }
                              void sendRawMessage(option.value);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              isLastAssistant
                                ? "border-transparent bg-black/5 text-[color:var(--site-text,#111827)] hover:border-[color:var(--site-border,#d1d5db)] hover:bg-black/10"
                                : "border-[color:var(--site-border,#d1d5db)] bg-black/0 text-[color:var(--site-muted,#6b7280)]"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {showConsentControl ? (
                      <div className="mt-2 rounded-xl border border-[color:var(--site-border,#e5e7eb)] bg-white/60 p-2">
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
                                className="rounded-lg border border-[color:var(--site-border,#d1d5db)] px-3 py-1.5 text-xs disabled:opacity-60"
                              >
                                Текст ПДн {i + 1}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <label className="flex items-start gap-2 text-xs text-[color:var(--site-text,#111827)]">
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
                          onClick={() => void sendRawMessage("Согласен на обработку персональных данных")}
                          className="mt-2 rounded-lg bg-[color:var(--site-button,#111827)] px-3 py-1.5 text-xs font-medium text-[color:var(--site-button-text,#fff)] disabled:opacity-50"
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
              <div className="max-w-[90%] rounded-2xl bg-black/5 px-3 py-2 text-sm text-[color:var(--site-muted,#6b7280)]">
                <div className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--site-muted,#6b7280)] animate-pulse"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--site-muted,#6b7280)] animate-pulse"
                    style={{ animationDelay: "140ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--site-muted,#6b7280)] animate-pulse"
                    style={{ animationDelay: "280ms" }}
                  />
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-[color:var(--site-border,#e5e7eb)] p-3">
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Например: маникюр завтра в 17:00"
                className="h-10 flex-1 rounded-xl border border-[color:var(--site-border,#e5e7eb)] bg-transparent px-3 text-sm text-[color:var(--site-text,#111827)] outline-none"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="h-10 rounded-xl bg-[color:var(--site-button,#111827)] px-3 text-sm font-medium text-[color:var(--site-button-text,#fff)] disabled:opacity-50"
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
          className="rounded-full bg-[color:var(--site-button,#111827)] px-4 py-3 text-sm font-semibold text-[color:var(--site-button-text,#fff)] shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
        >
          AI запись
        </button>
      )}
    </div>
  );
}
