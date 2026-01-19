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
  planId: number | null;
  plans: PlanOption[];
};

const statuses = ["ACTIVE", "SUSPENDED", "ARCHIVED"];

export default function AccountRowActions({
  accountId,
  status,
  planId,
  plans,
}: AccountRowActionsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentPlan, setCurrentPlan] = useState(
    planId !== null ? String(planId) : ""
  );
  const [saving, setSaving] = useState(false);

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
        const message =
          payload?.error?.message ?? "Не удалось сохранить изменения.";
        alert(message);
        return;
      }
      if (payload?.data?.status) {
        setCurrentStatus(payload.data.status);
      }
      const nextPlanId =
        payload?.data?.plan?.id ?? payload?.data?.planId ?? null;
      setCurrentPlan(nextPlanId !== null ? String(nextPlanId) : "");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentStatus}
        onChange={(event) => setCurrentStatus(event.target.value)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-2 py-1 text-xs"
      >
        {statuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        value={currentPlan}
        onChange={(event) => setCurrentPlan(event.target.value)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-2 py-1 text-xs"
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
    </div>
  );
}
