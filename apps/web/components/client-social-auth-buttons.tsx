"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type ClientSocialAuthButtonsProps = {
  accountSlug?: string | null;
  returnTo?: string | null;
  className?: string;
  buttonClassName?: string;
  divider?: boolean;
};

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    [key: `onTelegramClientAuth_${string}`]: ((user: TelegramUser) => void) | undefined;
  }
}

function providerUrl(provider: "vk" | "yandex", accountSlug: string | null, returnTo: string) {
  const url = new URL(`/api/v1/auth/client/social/${provider}/start`, "http://local");
  if (accountSlug) url.searchParams.set("account", accountSlug);
  url.searchParams.set("returnTo", returnTo);
  return `${url.pathname}${url.search}`;
}

function encodeMaxStartParam(accountSlug: string | null, returnTo: string) {
  const value = JSON.stringify({ accountSlug, returnTo });
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function ClientSocialAuthButtons({
  accountSlug = null,
  returnTo,
  className = "",
  buttonClassName = "",
  divider = true,
}: ClientSocialAuthButtonsProps) {
  const id = useId().replace(/[^a-zA-Z0-9_]/g, "_");
  const telegramRef = useRef<HTMLDivElement | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const maxBot = process.env.NEXT_PUBLIC_MAX_BOT_USERNAME;
  const resolvedReturnTo = useMemo(() => {
    if (returnTo) return returnTo;
    if (typeof window === "undefined") return "/c";
    return `${window.location.pathname}${window.location.search}`;
  }, [returnTo]);
  const baseButton =
    buttonClassName ||
    "flex w-full items-center justify-center rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-black/[0.03]";

  const handleTelegramClick = () => {
    if (!telegramBot) {
      setTelegramError("Telegram вход не настроен.");
      return;
    }
    const button = telegramRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
    button?.click();
    setTelegramError("Нажмите кнопку Telegram ниже, чтобы продолжить.");
  };

  useEffect(() => {
    if (!telegramBot || !telegramRef.current) return;
    const callbackName = `onTelegramClientAuth_${id}` as const;
    window[callbackName] = async (user: TelegramUser) => {
      setTelegramError(null);
      const response = await fetch("/api/v1/auth/client/social/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...user,
          accountSlug,
          returnTo: resolvedReturnTo,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setTelegramError(payload?.error?.message ?? "Не удалось войти через Telegram.");
        return;
      }
      window.location.href = payload?.data?.returnTo || resolvedReturnTo;
    };

    const target = telegramRef.current;
    target.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", telegramBot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    target.appendChild(script);

    return () => {
      window[callbackName] = undefined;
      target.innerHTML = "";
    };
  }, [accountSlug, id, resolvedReturnTo, telegramBot]);

  return (
    <div className={className}>
      <div className="grid gap-2">
        <button type="button" className={baseButton} onClick={handleTelegramClick}>
          Telegram
        </button>
        <div className={telegramBot ? "flex min-h-[44px] justify-center overflow-hidden rounded-[var(--site-button-radius)]" : "hidden"} ref={telegramRef} />
        {telegramError ? <div className="text-xs text-red-600">{telegramError}</div> : null}
        <a className={baseButton} href={providerUrl("vk", accountSlug, resolvedReturnTo)}>
          VK ID
        </a>
        <a className={baseButton} href={providerUrl("yandex", accountSlug, resolvedReturnTo)}>
          Яндекс ID
        </a>
        <a
          className={baseButton}
          href={maxBot ? `https://max.ru/${maxBot}?startapp=${encodeMaxStartParam(accountSlug, resolvedReturnTo)}` : "#"}
          onClick={(event) => {
            if (!maxBot) {
              event.preventDefault();
              setTelegramError("MAX ID не настроен.");
            }
          }}
        >
          MAX ID
        </a>
      </div>
      {divider ? (
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          <div className="h-px flex-1 bg-[color:var(--bp-stroke)]" />
          или
          <div className="h-px flex-1 bg-[color:var(--bp-stroke)]" />
        </div>
      ) : null}
    </div>
  );
}
