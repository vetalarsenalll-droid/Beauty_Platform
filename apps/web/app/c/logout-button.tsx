"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/v1/auth/client/logout", { method: "POST" });
    } finally {
      window.location.href = "/c/login";
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm transition hover:-translate-y-[1px] hover:shadow-sm"
    >
      {"Выйти"}
    </button>
  );
}
