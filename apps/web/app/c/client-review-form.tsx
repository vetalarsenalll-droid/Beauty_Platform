"use client";

import { useState } from "react";

type ClientReviewFormProps = {
  accountSlug: string;
  initialRating: number | null;
  initialComment: string | null;
  onSaved: (payload: { rating: number; comment: string | null; createdAt: string }) => void;
};

export default function ClientReviewForm({
  accountSlug,
  initialRating,
  initialComment,
  onSaved,
}: ClientReviewFormProps) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/client/reviews?account=${encodeURIComponent(accountSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "Не удалось сохранить отзыв.");
        return;
      }
      onSaved({
        rating: payload?.data?.review?.rating ?? rating,
        comment: payload?.data?.review?.comment ?? comment,
        createdAt: payload?.data?.review?.createdAt ?? new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="text-sm font-semibold">Ваш отзыв</div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              rating >= value
                ? "border-[color:var(--site-client-button)] bg-[color:var(--site-client-button)] text-[color:var(--site-client-button-text)]"
                : "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)]"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Что понравилось? Что можно улучшить?"
        className="min-h-[110px] w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
      />
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-fit items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Сохранение..." : "Сохранить отзыв"}
      </button>
    </form>
  );
}
