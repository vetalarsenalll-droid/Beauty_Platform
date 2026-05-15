"use client";

import { useMemo, useState } from "react";
import { UnoptimizedImage } from "@/components/unoptimized-image";

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
  onSaved: (payload: { appointmentId: number; rating: number; comment: string | null; createdAt: string; photoUrls: string[] }) => void;
};

type UploadedReviewPhoto = {
  id: number;
  url: string;
  name: string;
};

const MAX_REVIEW_PHOTOS = 5;

export default function ClientReviewForm({ accountSlug, appointments, onSaved }: ClientReviewFormProps) {
  const [appointmentId, setAppointmentId] = useState<number>(appointments[0]?.id ?? 0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<UploadedReviewPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAppointmentIds, setSavedAppointmentIds] = useState<Set<number>>(new Set());

  const availableAppointments = useMemo(
    () => appointments.filter((appointment) => !savedAppointmentIds.has(appointment.id)),
    [appointments, savedAppointmentIds]
  );
  const selectedAppointment = availableAppointments.find((appointment) => appointment.id === appointmentId) ?? availableAppointments[0] ?? null;

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).slice(0, MAX_REVIEW_PHOTOS - photos.length);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    setError(null);
    setUploadingPhotos(true);
    let nextPhotos = photos;
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/v1/client/reviews/media?account=${encodeURIComponent(accountSlug)}`, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setError(payload?.error?.message ?? "Не удалось загрузить фотографию.");
          return;
        }

        const photo = {
          id: Number(payload?.data?.id),
          url: String(payload?.data?.url ?? ""),
          name: file.name,
        };
        if (!Number.isInteger(photo.id) || !photo.url) {
          setError("Не удалось загрузить фотографию.");
          return;
        }

        nextPhotos = [...nextPhotos, photo].slice(0, MAX_REVIEW_PHOTOS);
        setPhotos(nextPhotos);
      }
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handlePhotoDelete = async (photo: UploadedReviewPhoto) => {
    setError(null);
    const response = await fetch(`/api/v1/client/reviews/media?account=${encodeURIComponent(accountSlug)}&id=${photo.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Не удалось удалить фотографию.");
      return;
    }
    setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
  };


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
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          rating,
          comment,
          photoAssetIds: photos.map((photo) => photo.id),
        }),
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
        photoUrls: Array.isArray(payload?.data?.review?.photoUrls)
          ? payload.data.review.photoUrls.filter((url: unknown): url is string => typeof url === "string")
          : photos.map((photo) => photo.url),
      };
      onSaved(saved);
      setSavedAppointmentIds((prev) => new Set(prev).add(saved.appointmentId));
      setAppointmentId(availableAppointments.find((item) => item.id !== saved.appointmentId)?.id ?? 0);
      setRating(0);
      setComment("");
      setPhotos([]);
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
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Фотографии</div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">До {MAX_REVIEW_PHOTOS} изображений JPG, PNG, WebP или HEIC.</div>
              </div>
              <label className={`inline-flex cursor-pointer items-center justify-center rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold transition hover:border-[color:var(--site-client-button)] ${photos.length >= MAX_REVIEW_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
                {uploadingPhotos ? "Загрузка..." : "Добавить фото"}
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  disabled={uploadingPhotos || photos.length >= MAX_REVIEW_PHOTOS}
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            {photos.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-[color:var(--bp-stroke)]">
                    <UnoptimizedImage src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => void handlePhotoDelete(photo)}
                      className="absolute right-1 top-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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
        disabled={saving || uploadingPhotos || rating < 1 || !selectedAppointment}
        className="inline-flex w-fit items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить отзыв"}
      </button>
    </form>
  );
}
