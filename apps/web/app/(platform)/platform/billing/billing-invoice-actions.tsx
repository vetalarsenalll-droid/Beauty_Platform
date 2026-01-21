"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BillingInvoiceActionsProps = {
  invoiceId: number;
  status: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Выставлен",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

export default function BillingInvoiceActions({
  invoiceId,
  status,
}: BillingInvoiceActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const markPaid = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/platform/billing/invoices/${invoiceId}/pay`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[color:var(--bp-muted)]">
        {statusLabels[status] ?? status}
      </span>
      {status !== "PAID" ? (
        <button
          type="button"
          onClick={markPaid}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
        >
          {saving ? "..." : "Отметить оплату"}
        </button>
      ) : null}
    </div>
  );
}
