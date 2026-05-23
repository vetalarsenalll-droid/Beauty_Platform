"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

type AiBalanceAdjustmentFormProps = {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
};

export function AiBalanceAdjustmentForm({ action, children, className }: AiBalanceAdjustmentFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onSubmit={(event) => {
        const form = formRef.current;
        if (!form) return;
        const formData = new FormData(form);
        if (formData.get("direction") !== "debit") return;

        const accountSelect = form.elements.namedItem("accountId") as HTMLSelectElement | null;
        const accountLabel = accountSelect?.selectedOptions[0]?.textContent || `аккаунт #${formData.get("accountId")}`;
        const amount = formData.get("amountRub")?.toString() || "0";
        const confirmed = window.confirm(`Списать ${amount} ₽ с AI-баланса: ${accountLabel}?`);
        if (!confirmed) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
