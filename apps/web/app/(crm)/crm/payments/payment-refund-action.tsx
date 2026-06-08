"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type PaymentRefundActionProps = {
  intentId: number;
  status: string;
  providerRef: string | null;
  amountRub: number;
  refundedRub: number;
  currency: string;
};

function money(value: number, currency: string) {
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function userRefundError(message: string) {
  if (message.includes("T-Bank Cancel request failed")) {
    return "Банк не подтвердил возврат. Проверьте операцию в кабинете Т-Банка или повторите позже.";
  }
  if (message.includes("Auth required") || message.includes("UNAUTHENTICATED")) {
    return "Сессия CRM истекла. Обновите страницу и повторите действие.";
  }
  if (message.includes("Refund amount must be greater than zero")) {
    return "Сумма возврата должна быть больше нуля.";
  }
  if (message.includes("Refund amount cannot exceed remaining amount")) {
    return "Сумма возврата больше доступного остатка.";
  }
  if (message.includes("Only succeeded payments can be refunded")) {
    return "Можно вернуть только оплаченный платеж.";
  }
  if (message.includes("Payment intent not found")) {
    return "Платеж не найден.";
  }
  if (message.includes("Provider payment id is missing")) {
    return "У платежа нет банковского идентификатора для возврата.";
  }
  return message || "Не удалось выполнить возврат.";
}

export default function PaymentRefundAction({
  intentId,
  status,
  providerRef,
  amountRub,
  refundedRub,
  currency,
}: PaymentRefundActionProps) {
  const router = useRouter();
  const remainingRub = useMemo(() => Math.max(0, Math.round((amountRub - refundedRub) * 100) / 100), [amountRub, refundedRub]);
  const [amount, setAmount] = useState(remainingRub ? String(remainingRub) : "");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ amountRub: number; reason: string | null } | null>(null);

  const canRefund = status === "SUCCEEDED" && Boolean(providerRef) && remainingRub > 0;

  useEffect(() => {
    setAmount(remainingRub ? String(remainingRub) : "");
  }, [intentId, remainingRub]);

  async function executeRefund(amountRubValue: number, reasonValue: string | null) {
    if (!canRefund || pending) return;

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/crm/account-payments/intents/${intentId}/refund`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRub: amountRubValue,
          reason: reasonValue || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Не удалось выполнить возврат");
      }
      setMessage("Возврат отправлен");
      setConfirmation(null);
      router.refresh();
    } catch (error) {
      setMessage(userRefundError(error instanceof Error ? error.message : "Не удалось выполнить возврат"));
    } finally {
      setPending(false);
    }
  }

  async function syncRefund() {
    if (!providerRef || syncing) return;
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/crm/account-payments/intents/${intentId}/sync-refund`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { refund?: { id: number } | null; providerStatus?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Не удалось сверить возврат с банком");
      }
      if (payload?.data?.refund) {
        setMessage("Возврат найден в банке и записан в CRM");
        router.refresh();
      } else {
        setMessage("Банк не показывает возврат по этому платежу");
      }
    } catch (error) {
      setMessage(userRefundError(error instanceof Error ? error.message : "Не удалось сверить возврат с банком"));
    } finally {
      setSyncing(false);
    }
  }

  function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRefund || pending) return;

    const amountRubValue = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(amountRubValue) || amountRubValue <= 0 || amountRubValue > remainingRub) {
      setMessage(`Укажите сумму от 0,01 до ${money(remainingRub, currency)}`);
      return;
    }

    setMessage(null);
    setConfirmation({
      amountRub: amountRubValue,
      reason: reason.trim() || null,
    });
  }

  if (!canRefund) {
    return (
      <div className="text-xs text-[color:var(--bp-muted)]">
        {remainingRub <= 0 ? "Возвращено полностью" : "Возврат недоступен"}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={submitRefund} className="mt-2 grid max-w-[190px] gap-2">
        <input
          type="number"
          min="0.01"
          max={remainingRub}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1 text-xs"
          aria-label={`Сумма возврата по платежу ${intentId}`}
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Причина"
          className="w-full rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1 text-xs"
          aria-label={`Причина возврата по платежу ${intentId}`}
        />
        <button
          type="submit"
          disabled={pending || syncing}
          className="rounded-lg bg-[color:var(--bp-ink)] px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Возвращаем..." : "Вернуть"}
        </button>
        <button
          type="button"
          disabled={pending || syncing || !providerRef}
          onClick={syncRefund}
          className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "Сверяем..." : "Сверить с банком"}
        </button>
        {message ? <div className="text-xs text-[color:var(--bp-muted)]">{message}</div> : null}
      </form>

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <h3 className="text-lg font-semibold">Подтвердить возврат</h3>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--bp-muted)]">
              <p>Платеж #{intentId}</p>
              <p>Сумма возврата: <span className="font-medium text-[color:var(--bp-ink)]">{money(confirmation.amountRub, currency)}</span></p>
              {confirmation.reason ? <p>Причина: {confirmation.reason}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmation(null)}
                className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => executeRefund(confirmation.amountRub, confirmation.reason)}
                className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Возвращаем..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
