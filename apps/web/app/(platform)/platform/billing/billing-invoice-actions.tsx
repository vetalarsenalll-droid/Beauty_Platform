type BillingInvoiceActionsProps = {
  status: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Выставлен",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

export default function BillingInvoiceActions({
  status,
}: BillingInvoiceActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[color:var(--bp-muted)]">
        {statusLabels[status] ?? status}
      </span>
    </div>
  );
}
