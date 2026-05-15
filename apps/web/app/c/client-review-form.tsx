"use client";

import { useMemo, useState } from "react";

type ReviewableAppointment = {
  id: number;
  dateLabel: string;
  timeLabel: string;
  locationName: string;
  specialistName: string | null;
  servicesLabel: string | null;
};

type ClientReviewFormProps = {
  accountSlug: string;
  appointments: ReviewableAppointment[];
  onSaved: (payload: { appointmentId: number; rating: number; comment: string | null; createdAt: string }) => void;
};

export default function ClientReviewForm({ accountSlug, appointments, onSaved }: ClientReviewFormProps) {
  const [appointmentId, setAppointmentId] = useState<number>(appointments[0]?.id ?? 0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAppointmentIds, setSavedAppointmentIds] = useState<Set<number>>(new Set());

  const availableAppointments = useMemo(
    () => appointments.filter((appointment) => !savedAppointmentIds.has(appointment.id)),
    [appointments, savedAppointmentIds]
  );
  const selectedAppointment = availableAppointments.find((appointment) => appointment.id === appointmentId) ?? availableAppointments[0] ?? null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAppointment) {
      setError("Нет завершенных записей, по которым можно оставить отзыв.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/client/reviews?account=${encodeURIComponent(accountSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: selectedAppointment.id, rating, comment }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "Не удалось сохранить отзыв.");
        return;
      }
      const saved = {
        appointmentId: payload?.data?.review?.appointmentId ?? selectedAppointment.id,
        rating: payload?.data?.review?.rating ?? rating,
        comment: payload?.data?.review?.comment ?? (comment || null),
        createdAt: payload?.data?.review?.createdAt ?? new Date().toISOString(),
      };
      onSaved(saved);
      setSavedAppointmentIds((prev) => new Set(prev).add(saved.appointmentId));
      setAppointmentId(availableAppointments.find((item) => item.id !== saved.appointmentId)?.id ?? 0);
      setRating(0);
      setComment("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>
        <div className="text-sm font-semibold">Оставить отзыв</div>
        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
          Отзыв доступен только по завершенной записи.
        </div>
      </div>

      {availableAppointments.length > 0 ? (
        <>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--bp-muted)]">
            Завершенная запись
            <select
              value={String(selectedAppointment?.id ?? appointmentId)}
              onChange={(event) => setAppointmentId(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm font-normal normal-case tracking-normal text-[color:var(--bp-ink)]"
            >
              {availableAppointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.dateLabel} · {appointment.servicesLabel || "Услуга"}
                </option>
              ))}
            </select>
          </label>

          {selectedAppointment ? (
            <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]/60 px-4 py-3 text-sm">
              <div className="font-semibold">{selectedAppointment.servicesLabel || "Услуга"}</div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {selectedAppointment.dateLabel}, {selectedAppointment.timeLabel}
              </div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {[selectedAppointment.specialistName, selectedAppointment.locationName].filter(Boolean).join(" · ")}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5" aria-label="Оценка">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`text-3xl leading-none transition ${rating >= value ? "text-[#ff9f0a]" : "text-slate-300"}`}
                aria-label={`${value} из 5`}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Что понравилось? Что можно улучшить?"
            className="min-h-[130px] w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
          />
        </>
      ) : (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]/70 px-4 py-4 text-sm text-[color:var(--bp-muted)]">
          Завершенных записей без отзыва пока нет.
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={saving || rating < 1 || !selectedAppointment}
        className="inline-flex w-fit items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить отзыв"}
      </button>
    </form>
  );
}
