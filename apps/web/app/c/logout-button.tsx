"use client";

import { useState } from "react";

type LogoutButtonProps = {
  accountSlug?: string | null;
};

export default function LogoutButton({ accountSlug }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/v1/auth/client/logout", { method: "POST" });
    } finally {
      const slugFromQuery = new URLSearchParams(window.location.search).get("account") ?? "";
      const slug = (accountSlug ?? slugFromQuery).trim();
      window.location.href = slug ? `/c/login?account=${encodeURIComponent(slug)}` : "/c/login";
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm transition hover:-translate-y-[1px] hover:shadow-sm"
    >
      Выйти
    </button>
  );
}
