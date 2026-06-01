"use client";

import { useMemo, useState } from "react";

export type AiBalanceHistoryRow = {
  id: number;
  type: string;
  amountTokens: number;
  createdAtIso: string;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  provider: string | null;
  model: string | null;
  purpose: string | null;
  comment: string | null;
  userMessage: string | null;
  assistantReply: string | null;
};

type HistoryTab = "all" | "income" | "expense";
type PeriodFilter = "all" | "day" | "month" | "year";

function int(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function typeLabel(type: string) {
  if (type === "usage") return "Расход ассистента";
  if (type === "purchase") return "Покупка пакета";
  if (type === "manual_credit") return "Пополнение";
  if (type === "manual_debit") return "Корректировка";
  if (type === "bonus") return "Бонус";
  return "Операция";
}

function amountLabel(row: AiBalanceHistoryRow) {
  const amount = row.type === "usage" ? -(row.totalTokens ?? Math.abs(row.amountTokens)) : row.amountTokens;
  if (amount > 0) return `+${int(amount)} токенов`;
  if (amount < 0) return `-${int(Math.abs(amount))} токенов`;
  return "0 токенов";
}

function isIncome(row: AiBalanceHistoryRow) {
  return row.amountTokens > 0 && row.type !== "usage";
}

function isExpense(row: AiBalanceHistoryRow) {
  return row.type === "usage" || row.amountTokens < 0;
}

function inPeriod(row: AiBalanceHistoryRow, period: PeriodFilter) {
  if (period === "all") return true;
  const date = new Date(row.createdAtIso);
  const now = new Date();
  if (period === "day") return date.toDateString() === now.toDateString();
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return date.getFullYear() === now.getFullYear();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiBalanceHistory({ rows }: { rows: AiBalanceHistoryRow[] }) {
  const [tab, setTab] = useState<HistoryTab>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!inPeriod(row, period)) return false;
        if (tab === "income") return isIncome(row);
        if (tab === "expense") return isExpense(row);
        return true;
      }),
    [period, rows, tab],
  );

  return (
    <article className="h-[542px] overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">История баланса</h2>
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
          className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm outline-none"
        >
          <option value="all">За всё время</option>
          <option value="day">Сегодня</option>
          <option value="month">Этот месяц</option>
          <option value="year">Этот год</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[color:var(--input-bg)] p-1 text-sm">
        {[
          ["all", "Все"],
          ["income", "Поступления"],
          ["expense", "Расход"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as HistoryTab)}
            className={`rounded-lg px-3 py-2 font-medium ${tab === value ? "bg-white shadow-sm" : "text-[color:var(--bp-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid max-h-[396px] gap-3 overflow-y-auto pr-1 text-sm">
        {filteredRows.map((row) => {
          const opened = openId === row.id;
          const expense = isExpense(row);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setOpenId(opened ? null : row.id)}
              className="grid gap-3 rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3 text-left transition hover:border-[color:var(--bp-accent)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{typeLabel(row.type)}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{formatDate(row.createdAtIso)}</div>
                </div>
                <div className={expense ? "text-rose-600" : "text-emerald-600"}>{amountLabel(row)}</div>
              </div>

              {opened ? (
                <div className="grid gap-3 border-t border-[color:var(--bp-stroke)] pt-3 text-xs text-[color:var(--bp-muted)]">
                  {row.userMessage || row.assistantReply ? (
                    <div className="grid gap-2">
                      {row.userMessage ? (
                        <div>
                          <div className="font-medium text-[color:var(--bp-text)]">Сообщение клиента</div>
                          <div className="mt-1 rounded-lg bg-[color:var(--input-bg)] px-3 py-2">{row.userMessage}</div>
                        </div>
                      ) : null}
                      {row.assistantReply ? (
                        <div>
                          <div className="font-medium text-[color:var(--bp-text)]">Ответ ассистента</div>
                          <div className="mt-1 rounded-lg bg-[color:var(--input-bg)] px-3 py-2">{row.assistantReply}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {expense ? <div>Списано: {int(row.totalTokens ?? Math.abs(row.amountTokens))} токенов</div> : null}
                </div>
              ) : null}
            </button>
          );
        })}
        {!filteredRows.length ? <div className="text-[color:var(--bp-muted)]">Операций за выбранный период нет.</div> : null}
      </div>
    </article>
  );
}
