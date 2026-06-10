"use client";

import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { useEffect, useMemo, useState } from "react";

type LegalDoc = {
  id?: number;
  key: string;
  title: string;
  description?: string | null;
  isRequired: boolean;
  sortOrder: number;
  content: string;
  versionId?: number | null;
  version?: number | null;
};

type BookingOnlinePaymentMode = "DISABLED" | "PREPAYMENT_FIXED" | "PREPAYMENT_PERCENT" | "FULL_PAYMENT";

type BookingPaymentSettings = {
  bookingOnlinePaymentMode: BookingOnlinePaymentMode;
  bookingAllowPayLater: boolean;
  bookingAllowPrepaymentFixed: boolean;
  bookingAllowPrepaymentPercent: boolean;
  bookingAllowFullPayment: boolean;
  bookingPrepaymentAmount: number | null;
  bookingPrepaymentPercent: number | null;
  bookingFullPaymentDiscountPercent: number | null;
};

type BookingPolicySettings = {
  slotStepMinutes: number;
  cancellationWindowHours: number | null;
  rescheduleWindowHours: number | null;
  holdTtlMinutes: number | null;
  defaultReminderHours: number | null;
};

const defaultBookingPolicySettings: BookingPolicySettings = {
  slotStepMinutes: 15,
  cancellationWindowHours: null,
  rescheduleWindowHours: null,
  holdTtlMinutes: null,
  defaultReminderHours: null,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const fieldWrapClass = "mt-2 border-b border-[color:var(--bp-stroke)] pb-1";
const fieldClass =
  "w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0";
const textareaClass =
  "min-h-32 w-full resize-y appearance-none rounded-none border-0 bg-transparent px-0 py-1 text-sm font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0";
const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]";

function updateDocAt(docs: LegalDoc[], index: number, patch: Partial<LegalDoc>) {
  return docs.map((doc, docIndex) => (docIndex === index ? { ...doc, ...patch } : doc));
}

function deriveBookingOnlinePaymentMode(settings: BookingPaymentSettings): BookingOnlinePaymentMode {
  if (settings.bookingAllowFullPayment) return "FULL_PAYMENT";
  if (settings.bookingAllowPrepaymentPercent) return "PREPAYMENT_PERCENT";
  if (settings.bookingAllowPrepaymentFixed) return "PREPAYMENT_FIXED";
  return "DISABLED";
}

function renderTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string
) {
  return (
    <label className={labelClass}>
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className={fieldWrapClass}>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={fieldClass}
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
      </div>
    </label>
  );
}

function renderNumberInput(
  label: string,
  value: number | null,
  onChange: (value: number | null) => void,
  options: { min?: number; step?: number | string } = {}
) {
  return (
    <label className={labelClass}>
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className={fieldWrapClass}>
        <input
          type="number"
          min={options.min}
          step={options.step}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
          className={fieldClass}
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
      </div>
    </label>
  );
}

export function BO001ContentPanel(ctx: CrmPanelCtx) {
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>(ctx.editableLegalDocuments);
  const [bookingPayment, setBookingPayment] = useState<BookingPaymentSettings>({
    bookingOnlinePaymentMode: ctx.bookingSettings.bookingOnlinePaymentMode,
    bookingAllowPayLater: ctx.bookingSettings.bookingAllowPayLater,
    bookingAllowPrepaymentFixed: ctx.bookingSettings.bookingAllowPrepaymentFixed,
    bookingAllowPrepaymentPercent: ctx.bookingSettings.bookingAllowPrepaymentPercent,
    bookingAllowFullPayment: ctx.bookingSettings.bookingAllowFullPayment,
    bookingPrepaymentAmount: ctx.bookingSettings.bookingPrepaymentAmount,
    bookingPrepaymentPercent: ctx.bookingSettings.bookingPrepaymentPercent,
    bookingFullPaymentDiscountPercent: ctx.bookingSettings.bookingFullPaymentDiscountPercent,
  });
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicySettings>({
    slotStepMinutes: ctx.bookingSettings.slotStepMinutes,
    cancellationWindowHours: ctx.bookingSettings.cancellationWindowHours,
    rescheduleWindowHours: ctx.bookingSettings.rescheduleWindowHours,
    holdTtlMinutes: ctx.bookingSettings.holdTtlMinutes,
    defaultReminderHours: ctx.bookingSettings.defaultReminderHours,
  });
  const [saving, setSaving] = useState(false);
  const [savingBookingPolicy, setSavingBookingPolicy] = useState(false);
  const [savingBookingPayment, setSavingBookingPayment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sectionTitle = ctx.currentPanelSections[0]?.label ?? "Документы и согласия";
  const loading = false;
  const bookingLoading = false;

  useEffect(() => {
    setLegalDocs(ctx.editableLegalDocuments);
  }, [ctx.editableLegalDocuments]);

  useEffect(() => {
    setBookingPayment({
      bookingOnlinePaymentMode: ctx.bookingSettings.bookingOnlinePaymentMode,
      bookingAllowPayLater: ctx.bookingSettings.bookingAllowPayLater,
      bookingAllowPrepaymentFixed: ctx.bookingSettings.bookingAllowPrepaymentFixed,
      bookingAllowPrepaymentPercent: ctx.bookingSettings.bookingAllowPrepaymentPercent,
      bookingAllowFullPayment: ctx.bookingSettings.bookingAllowFullPayment,
      bookingPrepaymentAmount: ctx.bookingSettings.bookingPrepaymentAmount,
      bookingPrepaymentPercent: ctx.bookingSettings.bookingPrepaymentPercent,
      bookingFullPaymentDiscountPercent: ctx.bookingSettings.bookingFullPaymentDiscountPercent,
    });
    setBookingPolicy({
      slotStepMinutes: ctx.bookingSettings.slotStepMinutes,
      cancellationWindowHours: ctx.bookingSettings.cancellationWindowHours,
      rescheduleWindowHours: ctx.bookingSettings.rescheduleWindowHours,
      holdTtlMinutes: ctx.bookingSettings.holdTtlMinutes,
      defaultReminderHours: ctx.bookingSettings.defaultReminderHours,
    });
  }, [ctx.bookingSettings]);

  const requiredCount = useMemo(
    () => legalDocs.filter((doc) => doc.isRequired).length,
    [legalDocs]
  );

  const saveLegal = async () => {
    setSaving(true);
    setMessage(null);
    const documents = legalDocs.map((doc, index) => ({
      ...doc,
      key: doc.key || slugify(doc.title || `doc-${index + 1}`),
      sortOrder: Number.isFinite(Number(doc.sortOrder)) ? Number(doc.sortOrder) : index + 1,
    }));

    try {
      const response = await fetch("/api/v1/crm/settings/legal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.message ?? "Не удалось сохранить документы.");
        return;
      }
      const nextDocuments = Array.isArray(payload?.data) ? payload.data : documents;
      setLegalDocs(nextDocuments);
      ctx.updateEditableLegalDocuments?.(nextDocuments);
      setMessage("Документы сохранены.");
    } catch {
      setMessage("Не удалось сохранить документы.");
    } finally {
      setSaving(false);
    }
  };

  const saveBookingPolicy = async () => {
    setSavingBookingPolicy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/crm/settings/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPolicy),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: Partial<BookingPolicySettings>; message?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data) {
        setMessage(payload?.error?.message ?? payload?.message ?? "Не удалось сохранить политики записи.");
        return;
      }
      const nextSettings = { ...ctx.bookingSettings, ...payload.data };
      setBookingPolicy({
        slotStepMinutes: nextSettings.slotStepMinutes,
        cancellationWindowHours: nextSettings.cancellationWindowHours,
        rescheduleWindowHours: nextSettings.rescheduleWindowHours,
        holdTtlMinutes: nextSettings.holdTtlMinutes,
        defaultReminderHours: nextSettings.defaultReminderHours,
      });
      ctx.updateBookingSettings?.(nextSettings);
      setMessage("Политики записи сохранены.");
    } catch {
      setMessage("Не удалось сохранить политики записи.");
    } finally {
      setSavingBookingPolicy(false);
    }
  };

  const saveBookingPayment = async () => {
    setSavingBookingPayment(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/crm/settings/booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bookingPayment,
          bookingOnlinePaymentMode: deriveBookingOnlinePaymentMode(bookingPayment),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: Partial<BookingPaymentSettings>; message?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data) {
        setMessage(payload?.error?.message ?? payload?.message ?? "Не удалось сохранить правила онлайн-оплаты.");
        return;
      }
      const nextSettings = { ...ctx.bookingSettings, ...payload.data };
      setBookingPayment({
        bookingOnlinePaymentMode: nextSettings.bookingOnlinePaymentMode,
        bookingAllowPayLater: nextSettings.bookingAllowPayLater,
        bookingAllowPrepaymentFixed: nextSettings.bookingAllowPrepaymentFixed,
        bookingAllowPrepaymentPercent: nextSettings.bookingAllowPrepaymentPercent,
        bookingAllowFullPayment: nextSettings.bookingAllowFullPayment,
        bookingPrepaymentAmount: nextSettings.bookingPrepaymentAmount,
        bookingPrepaymentPercent: nextSettings.bookingPrepaymentPercent,
        bookingFullPaymentDiscountPercent: nextSettings.bookingFullPaymentDiscountPercent,
      });
      ctx.updateBookingSettings?.(nextSettings);
      setMessage("Правила онлайн-оплаты записи сохранены.");
    } catch {
      setMessage("Не удалось сохранить правила онлайн-оплаты.");
    } finally {
      setSavingBookingPayment(false);
    }
  };

  return (
    <div className="space-y-6 pb-8" onClick={(event) => event.stopPropagation()}>
      <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
        {sectionTitle}
      </div>

      {message ? (
        <div className="border-b border-[color:var(--bp-stroke)] pb-3 text-sm text-[color:var(--bp-ink)]">
          {message}
        </div>
      ) : null}

      <div className="border-b border-[color:var(--bp-stroke)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Политики записи</div>
            <div className="mt-2 text-xs leading-5 text-[color:var(--bp-muted)]">
              Эти правила управляют шагом слотов, удержанием выбранного времени и окнами отмены или переноса записи.
            </div>
          </div>
          <button
            type="button"
            onClick={saveBookingPolicy}
            disabled={savingBookingPolicy || bookingLoading}
            className="shrink-0 rounded-none bg-[color:var(--bp-ink)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingBookingPolicy ? "Сохранение..." : "Сохранить правила"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {renderNumberInput(
            "Шаг слота (мин)",
            bookingPolicy.slotStepMinutes,
            (value) =>
              setBookingPolicy((current) => ({
                ...current,
                slotStepMinutes: value ?? defaultBookingPolicySettings.slotStepMinutes,
              })),
            { min: 5, step: 5 }
          )}
          {renderNumberInput(
            "Время удержания слота (мин)",
            bookingPolicy.holdTtlMinutes,
            (value) => setBookingPolicy((current) => ({ ...current, holdTtlMinutes: value })),
            { min: 1 }
          )}
          {renderNumberInput(
            "Окно отмены (часы)",
            bookingPolicy.cancellationWindowHours,
            (value) => setBookingPolicy((current) => ({ ...current, cancellationWindowHours: value })),
            { min: 0 }
          )}
          {renderNumberInput(
            "Окно переноса (часы)",
            bookingPolicy.rescheduleWindowHours,
            (value) => setBookingPolicy((current) => ({ ...current, rescheduleWindowHours: value })),
            { min: 0 }
          )}
          {renderNumberInput(
            "Напоминание по умолчанию (часы)",
            bookingPolicy.defaultReminderHours,
            (value) => setBookingPolicy((current) => ({ ...current, defaultReminderHours: value })),
            { min: 0 }
          )}
        </div>
      </div>

      <div className="border-b border-[color:var(--bp-stroke)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Онлайн-оплата записи</div>
            <div className="mt-2 text-xs leading-5 text-[color:var(--bp-muted)]">
              Эти правила показываются в публичной онлайн-записи. Подключение ЮKassa, Т-Банка,
              Сбера или Альфы настраивается в разделе Оплаты/Финансы.
            </div>
          </div>
          <button
            type="button"
            onClick={saveBookingPayment}
            disabled={savingBookingPayment || bookingLoading}
            className="shrink-0 rounded-none bg-[color:var(--bp-ink)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingBookingPayment ? "Сохранение..." : "Сохранить оплату"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-[color:var(--bp-ink)]">
          <FlatCheckbox
            checked={bookingPayment.bookingAllowPayLater}
            onChange={(checked) =>
              setBookingPayment((current) => ({ ...current, bookingAllowPayLater: checked }))
            }
            label="Можно записаться без онлайн-оплаты"
          />
          <FlatCheckbox
            checked={bookingPayment.bookingAllowPrepaymentFixed}
            onChange={(checked) =>
              setBookingPayment((current) => ({
                ...current,
                bookingAllowPrepaymentFixed: checked,
                bookingAllowPrepaymentPercent: checked ? false : current.bookingAllowPrepaymentPercent,
              }))
            }
            label="Предоплата фиксированной суммой"
          />
          <FlatCheckbox
            checked={bookingPayment.bookingAllowPrepaymentPercent}
            onChange={(checked) =>
              setBookingPayment((current) => ({
                ...current,
                bookingAllowPrepaymentFixed: checked ? false : current.bookingAllowPrepaymentFixed,
                bookingAllowPrepaymentPercent: checked,
              }))
            }
            label="Предоплата процентом"
          />
          <FlatCheckbox
            checked={bookingPayment.bookingAllowFullPayment}
            onChange={(checked) =>
              setBookingPayment((current) => ({ ...current, bookingAllowFullPayment: checked }))
            }
            label="Полная онлайн-оплата"
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            <div className="min-h-[32px] leading-4">Предоплата, ₽</div>
            <div className={fieldWrapClass}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={bookingPayment.bookingPrepaymentAmount ?? ""}
                onChange={(event) =>
                  setBookingPayment((current) => ({
                    ...current,
                    bookingPrepaymentAmount: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
                disabled={!bookingPayment.bookingAllowPrepaymentFixed || bookingLoading}
                className={fieldClass}
                style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
              />
            </div>
          </label>

          <label className={labelClass}>
            <div className="min-h-[32px] leading-4">Предоплата, %</div>
            <div className={fieldWrapClass}>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={bookingPayment.bookingPrepaymentPercent ?? ""}
                onChange={(event) =>
                  setBookingPayment((current) => ({
                    ...current,
                    bookingPrepaymentPercent: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
                disabled={!bookingPayment.bookingAllowPrepaymentPercent || bookingLoading}
                className={fieldClass}
                style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
              />
            </div>
          </label>

          <label className={labelClass}>
            <div className="min-h-[32px] leading-4">Скидка полной оплаты, %</div>
            <div className={fieldWrapClass}>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={bookingPayment.bookingFullPaymentDiscountPercent ?? ""}
                onChange={(event) =>
                  setBookingPayment((current) => ({
                    ...current,
                    bookingFullPaymentDiscountPercent:
                      event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
                disabled={!bookingPayment.bookingAllowFullPayment || bookingLoading}
                className={fieldClass}
                style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
              />
            </div>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[color:var(--bp-muted)]">Загрузка документов...</div>
      ) : (
        <div>
          <div className="border-b border-[color:var(--bp-stroke)] pb-5">
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Документы и согласия</div>
            <div className="mt-2 text-xs leading-5 text-[color:var(--bp-muted)]">
              Эти документы используются на шаге контактов в онлайн-записи. Обязательные документы
              показываются как чекбоксы согласия.
            </div>
            <div className="mt-3 text-xs text-[color:var(--bp-muted)]">
              Всего: {legalDocs.length}. Обязательных: {requiredCount}.
            </div>
          </div>

          {legalDocs.map((doc, index) => (
            <details key={`${doc.id ?? "new"}-${index}`} className="group border-b border-[color:var(--bp-stroke)] py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[color:var(--bp-ink)]">
                    {doc.title || "Новый документ"}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    {doc.isRequired ? "Обязательный" : "Необязательный"} / порядок {doc.sortOrder}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[color:var(--bp-muted)] group-open:hidden">Открыть</span>
                <span className="hidden shrink-0 text-xs text-[color:var(--bp-muted)] group-open:inline">Свернуть</span>
              </summary>

              <div className="mt-5 space-y-5">
                {renderTextInput("Название", doc.title, (value) =>
                  setLegalDocs((prev) => updateDocAt(prev, index, { title: value }))
                )}

                {renderTextInput("Описание", doc.description ?? "", (value) =>
                  setLegalDocs((prev) => updateDocAt(prev, index, { description: value }))
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_96px] items-end gap-4">
                  <FlatCheckbox
                    checked={doc.isRequired}
                    onChange={(checked) =>
                      setLegalDocs((prev) => updateDocAt(prev, index, { isRequired: checked }))
                    }
                    label="Обязательный"
                  />

                  <label className={labelClass}>
                    <div className="min-h-[32px] leading-4">Порядок</div>
                    <div className={fieldWrapClass}>
                      <input
                        type="number"
                        min={0}
                        value={doc.sortOrder}
                        onChange={(event) =>
                          setLegalDocs((prev) =>
                            updateDocAt(prev, index, { sortOrder: Number(event.target.value) })
                          )
                        }
                        className={fieldClass}
                        style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
                      />
                    </div>
                  </label>
                </div>

                <label className={labelClass}>
                  <div className="min-h-[32px] leading-4">Текст документа</div>
                  <div className={fieldWrapClass}>
                    <textarea
                      value={doc.content}
                      onChange={(event) =>
                        setLegalDocs((prev) => updateDocAt(prev, index, { content: event.target.value }))
                      }
                      className={textareaClass}
                      placeholder="Текст документа"
                      style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
                    />
                  </div>
                </label>
              </div>
            </details>
          ))}

          {legalDocs.length === 0 ? (
            <div className="border-b border-[color:var(--bp-stroke)] pb-4 text-sm text-[color:var(--bp-muted)]">
              Документы пока не созданы.
            </div>
          ) : null}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 pb-1 pt-3">
        <button
          type="button"
          onClick={saveLegal}
          disabled={saving || loading}
          className="w-full rounded-none bg-[color:var(--bp-ink)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить документы"}
        </button>
      </div>
    </div>
  );
}
