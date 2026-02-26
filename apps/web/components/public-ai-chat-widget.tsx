"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Message = { id?: number; role: "user" | "assistant"; content: string };
type ChatAction = { type: "open_booking"; bookingUrl: string } | null;

type PublicAiChatWidgetProps = {
  accountSlug: string;
};

export default function PublicAiChatWidget({ accountSlug }: PublicAiChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const storageKey = useMemo(() => `ai-thread:${accountSlug}`, [accountSlug]);
  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);

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
        { cache: "no-store" }
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
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountSlug, storageKey]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;

    const userText = text.trim();
    setText("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          threadId,
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

      setMessages((prev) => [...prev, { role: "assistant", content: String(payload.data.reply) }]);
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

  const clearChat = async () => {
    if (threadId) {
      try {
        const response = await fetch(
          `/api/v1/public/ai/chat?account=${encodeURIComponent(accountSlug)}&threadId=${threadId}`,
          { method: "DELETE" }
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

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${msg.id ?? index}`}
                className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "ml-auto bg-[color:var(--site-button,#111827)] text-[color:var(--site-button-text,#fff)]"
                    : "bg-black/5 text-[color:var(--site-text,#111827)]"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading ? (
              <div className="max-w-[90%] rounded-2xl bg-black/5 px-3 py-2 text-sm text-[color:var(--site-muted,#6b7280)]">
                Печатает...
              </div>
            ) : null}
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
