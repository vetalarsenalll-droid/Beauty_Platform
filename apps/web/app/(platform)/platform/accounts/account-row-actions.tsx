"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanOption = {
  id: number;
  name: string;
};

type AccountRowActionsProps = {
  accountId: number;
  status: string;
  onboardingStatus: string;
  planId: number | null;
  plans: PlanOption[];
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  ARCHIVED: "Архив",
};

export default function AccountRowActions({
  accountId,
  status,
  onboardingStatus,
  planId,
  plans,
}: AccountRowActionsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPlan, setCurrentPlan] = useState(planId !== null ? String(planId) : "");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/platform/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: currentStatus,
          planId: currentPlan ? Number(currentPlan) : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.message ?? "Не удалось обновить данные аккаунта.";
        alert(message);
        return;
      }
      if (payload?.data?.status) {
        setCurrentStatus(payload.data.status);
      }
      const nextPlanId = payload?.data?.plan?.id ?? payload?.data?.planId ?? null;
      setCurrentPlan(nextPlanId !== null ? String(nextPlanId) : "");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) {
      alert("Укажите email для приглашения");
      return;
    }

    setInviting(true);
    try {
      const response = await fetch(`/api/v1/platform/accounts/${accountId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.message ?? "Не удалось отправить приглашение.";
        alert(message);
        return;
      }

      const inviteUrl = payload?.data?.inviteUrl;
      if (inviteUrl) {
        alert(`Приглашение сформировано.\n${inviteUrl}`);
      } else {
        alert("Приглашение отправлено.");
      }
      setInviteEmail("");
      router.refresh();
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentStatus}
        onChange={(event) => setCurrentStatus(event.target.value)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs text-[color:var(--bp-ink)]"
      >
        {Object.keys(statusLabels).map((item) => (
          <option key={item} value={item}>
            {statusLabels[item] ?? item}
          </option>
        ))}
      </select>

      <select
        value={currentPlan}
        onChange={(event) => setCurrentPlan(event.target.value)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs text-[color:var(--bp-ink)]"
      >
        <option value="">Без тарифа</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={save}
        className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
        disabled={saving}
      >
        {saving ? "..." : "Сохранить"}
      </button>

      {onboardingStatus !== "ACTIVE" ? (
        <>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="email приглашения"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs text-[color:var(--bp-ink)]"
          />
          <button
            type="button"
            onClick={invite}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
            disabled={inviting}
          >
            {inviting ? "..." : "Пригласить"}
          </button>
        </>
      ) : null}
    </div>
  );
}
