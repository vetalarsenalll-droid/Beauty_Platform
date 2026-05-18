"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
      close?: () => void;
    };
  }
}

export default function MaxWebAppClient() {
  const [message, setMessage] = useState("Проверяем вход через MAX ID...");

  useEffect(() => {
    const submit = async () => {
      window.WebApp?.ready?.();
      window.WebApp?.expand?.();
      const initData = window.WebApp?.initData ?? "";
      if (!initData) {
        setMessage("Откройте эту страницу из MAX, чтобы войти.");
        return;
      }

      const response = await fetch("/api/v1/auth/client/social/max/webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Не удалось войти через MAX ID.");
        return;
      }
      window.location.href = payload?.data?.returnTo || "/c";
    };

    void submit();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6 py-12 text-[#111827]">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-lg font-semibold">MAX ID</div>
        <div className="mt-3 text-sm text-slate-500">{message}</div>
      </div>
    </main>
  );
}
