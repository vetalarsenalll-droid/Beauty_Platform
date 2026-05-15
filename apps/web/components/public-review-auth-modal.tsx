"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import { UnoptimizedImage } from "@/components/unoptimized-image";

type ReviewAppointmentService = {
  id: number;
  name: string;
};

type ReviewAppointment = {
  id: number;
  startAt: string;
  locationId: number;
  locationName: string;
  specialistId: number | null;
  specialistName: string | null;
  services: ReviewAppointmentService[];
  servicesLabel: string | null;
};

type ReviewTarget = {
  type: "account" | "location" | "service" | "specialist";
  id: string;
  label: string;
};

type PublicReviewAuthModalProps = {
  accountSlug: string;
  accountName?: string;
  buttonLabel?: string;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  modalStyle?: CSSProperties;
  modalTextColor?: string;
  modalMutedColor?: string;
  modalButtonStyle?: CSSProperties;
  modalFieldStyle?: CSSProperties;
  starColor?: string;
};

type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  label: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  fieldStyle: CSSProperties;
  mutedColor: string;
  disabled?: boolean;
};

type UploadedReviewPhoto = {
  id: number;
  url: string;
  name: string;
};

const MAX_REVIEW_PHOTOS = 5;

function CustomSelect({ label, value, options, onChange, fieldStyle, mutedColor, disabled = false }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative text-sm font-semibold">
      <div>{label}</div>
      <button
        type="button"
        className="mt-2 flex w-full items-center justify-between gap-3 border bg-transparent px-4 py-3 text-left text-sm font-normal outline-none transition hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-black/10 disabled:cursor-not-allowed disabled:opacity-60"
        style={fieldStyle}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ""}</span>
        <span className="text-xs leading-none" style={{ color: mutedColor }} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border py-1 shadow-[0_16px_34px_rgba(15,23,42,0.16)]"
          style={{ ...fieldStyle, backgroundColor: String(fieldStyle.backgroundColor || "#ffffff") }}
          role="listbox"
        >
          {options.map((option) => {
            const active = option.value === value;
            const hovered = option.value === hoveredValue;
            return (
              <button
                key={option.value}
                type="button"
                className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-black/[0.06]"
                style={{
                  color: fieldStyle.color,
                  backgroundColor: active || hovered ? "rgba(148, 163, 184, 0.18)" : "transparent",
                }}
                onMouseEnter={() => setHoveredValue(option.value)}
                onMouseLeave={() => setHoveredValue(null)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function appointmentLabel(appointment: ReviewAppointment) {
  const date = new Date(appointment.startAt);
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${dateLabel}, ${timeLabel} - ${appointment.servicesLabel || "Услуга"}`;
}

function reviewTargetValue(target: ReviewTarget) {
  return `${target.type}:${target.id}`;
}

function parseReviewTargetValue(value: string): Pick<ReviewTarget, "type" | "id"> | null {
  const [type, id] = value.split(":");
  if (!id || !["account", "location", "service", "specialist"].includes(type)) return null;
  return { type: type as ReviewTarget["type"], id };
}

function reviewTargets(appointment: ReviewAppointment | null, accountName: string): ReviewTarget[] {
  if (!appointment) return [];

  const targets: ReviewTarget[] = [
    { type: "account", id: "account", label: accountName || "Организация" },
    { type: "location", id: String(appointment.locationId), label: `Локация: ${appointment.locationName}` },
  ];

  appointment.services.forEach((service) => {
    targets.push({ type: "service", id: String(service.id), label: `Услуга: ${service.name}` });
  });

  if (appointment.specialistId) {
    targets.push({
      type: "specialist",
      id: String(appointment.specialistId),
      label: `Специалист: ${appointment.specialistName || "Специалист"}`,
    });
  }

  return targets;
}

export default function PublicReviewAuthModal({
  accountSlug,
  accountName = "",
  buttonLabel = "Авторизоваться",
  buttonClassName,
  buttonStyle,
  modalStyle,
  modalTextColor = "#111827",
  modalMutedColor = "#6b7280",
  modalButtonStyle,
  modalFieldStyle,
  starColor = "#ff9f0a",
}: PublicReviewAuthModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointments, setAppointments] = useState<ReviewAppointment[]>([]);
  const [appointmentId, setAppointmentId] = useState<number>(0);
  const [targetValue, setTargetValue] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<UploadedReviewPhoto[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  const selectedAppointment =
    appointments.find((appointment) => appointment.id === appointmentId) ??
    appointments[0] ??
    null;
  const targets = useMemo(() => reviewTargets(selectedAppointment, accountName), [accountName, selectedAppointment]);
  const appointmentOptions = useMemo(
    () => appointments.map((appointment) => ({ value: String(appointment.id), label: appointmentLabel(appointment) })),
    [appointments]
  );
  const targetOptions = useMemo(
    () => targets.map((target) => ({ value: reviewTargetValue(target), label: target.label })),
    [targets]
  );
  const selectedTarget = parseReviewTargetValue(targetValue) ?? parseReviewTargetValue(reviewTargetValue(targets[0] ?? { type: "account", id: "account", label: "" }));
  const fieldStyle = {
    borderColor: "rgba(148, 163, 184, 0.32)",
    backgroundColor: "var(--review-card-bg, #ffffff)",
    color: modalTextColor,
    ...modalFieldStyle,
  } as CSSProperties;
  const actionButtonStyle = {
    borderRadius: 8,
    backgroundColor: "#111827",
    color: "#ffffff",
    ...modalButtonStyle,
  } as CSSProperties;
  const resolvedButtonLabel = authenticated ? "Оставить отзыв" : buttonLabel;

  useEffect(() => {
    if (targets.length === 0) {
      setTargetValue("");
      return;
    }
    if (!targets.some((target) => reviewTargetValue(target) === targetValue)) {
      setTargetValue(reviewTargetValue(targets[0]));
    }
  }, [targetValue, targets]);

  const loadReviewState = async () => {
    const response = await fetch(`/api/v1/client/reviews?account=${encodeURIComponent(accountSlug)}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(errorMessage(payload, "Не удалось загрузить завершенные записи."));
    }

    const nextAppointments = Array.isArray(payload?.data?.appointments)
      ? (payload.data.appointments as ReviewAppointment[])
      : [];
    setAppointments(nextAppointments);
    setAppointmentId(nextAppointments[0]?.id ?? 0);
  };

  const checkSession = async () => {
    setChecking(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/v1/auth/client/me?account=${encodeURIComponent(accountSlug)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setAuthenticated(false);
        return;
      }
      setAuthenticated(true);
      await loadReviewState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось проверить вход.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    const checkInitialSession = async () => {
      try {
        const response = await fetch(`/api/v1/auth/client/me?account=${encodeURIComponent(accountSlug)}`, {
          cache: "no-store",
        });
        if (active) setAuthenticated(response.ok);
      } catch {
        if (active) setAuthenticated(false);
      }
    };

    void checkInitialSession();
    return () => {
      active = false;
    };
  }, [accountSlug]);

  const openModal = () => {
    setOpen(true);
    void checkSession();
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, accountSlug }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(data, "Ошибка входа."));
        return;
      }
      setAuthenticated(true);
      await loadReviewState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить вход.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
          setError(errorMessage(payload, "Не удалось загрузить фотографию."));
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
      setError(errorMessage(payload, "Не удалось удалить фотографию."));
      return;
    }
    setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
  };


  const handleReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAppointment) {
      setError("Нет завершенных записей, по которым можно оставить отзыв.");
      return;
    }
    if (!selectedTarget) {
      setError("Выберите, к чему относится отзыв.");
      return;
    }
    if (rating < 1) {
      setError("Выберите оценку от 1 до 5.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/client/reviews?account=${encodeURIComponent(accountSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          entityType: selectedTarget.type,
          entityId: selectedTarget.id,
          rating,
          comment,
          photoAssetIds: photos.map((photo) => photo.id),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(payload, "Не удалось сохранить отзыв."));
        return;
      }

      const nextAppointments = appointments.filter((appointment) => appointment.id !== selectedAppointment.id);
      setAppointments(nextAppointments);
      setAppointmentId(nextAppointments[0]?.id ?? 0);
      setRating(0);
      setComment("");
      setPhotos([]);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить отзыв.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className={buttonClassName} style={buttonStyle} onClick={openModal}>
        {resolvedButtonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
          <div
            className="relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto p-6 shadow-[0_24px_70px_rgba(15,23,42,0.25)]"
            style={{ backgroundColor: "#ffffff", borderRadius: 8, color: modalTextColor, ...modalStyle }}
          >
            <button
              type="button"
              className="absolute right-4 top-3 z-10 px-1 py-1 text-2xl leading-none transition-colors hover:text-black"
              style={{ color: closeHovered ? "#000000" : modalMutedColor }}
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>

            <div className="pr-8">
              <div className="text-lg font-semibold">Оставить отзыв</div>
              <div className="mt-2 text-sm leading-6" style={{ color: modalMutedColor }}>
                {authenticated
                  ? "Вы можете выбрать завершенный визит и оставить отзыв."
                  : "Войдите, чтобы выбрать завершенный визит и оставить отзыв."}
              </div>
            </div>

            {checking ? <div className="mt-6 text-sm" style={{ color: modalMutedColor }}>Проверяем вход...</div> : null}

            {!checking && !authenticated ? (
              <form className="mt-6 grid gap-4" onSubmit={handleAuth}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  className="border bg-transparent px-4 py-3 text-sm outline-none"
                  style={fieldStyle}
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  className="border bg-transparent px-4 py-3 text-sm outline-none"
                  style={fieldStyle}
                  required
                />

                {error ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" style={{ borderRadius: modalStyle?.borderRadius ?? 8 }}>{error}</div> : null}

                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-60" style={actionButtonStyle}>
                  {submitting ? "Подождите..." : "Войти"}
                </button>
              </form>
            ) : null}

            {!checking && authenticated ? (
              <form className="mt-6 grid gap-4" onSubmit={handleReview}>
                {appointments.length > 0 ? (
                  <>
                    <CustomSelect
                      label="Завершенный визит"
                      value={String(selectedAppointment?.id ?? "")}
                      options={appointmentOptions}
                      onChange={(value) => setAppointmentId(Number(value))}
                      fieldStyle={fieldStyle}
                      mutedColor={modalMutedColor}
                    />

                    <CustomSelect
                      label="Отзыв о"
                      value={targetValue}
                      options={targetOptions}
                      onChange={setTargetValue}
                      fieldStyle={fieldStyle}
                      mutedColor={modalMutedColor}
                    />

                    {selectedAppointment ? (
                      <div className="border px-4 py-3 text-sm" style={{ ...fieldStyle, backgroundColor: "rgba(148, 163, 184, 0.08)" }}>
                        <div className="font-semibold">{selectedAppointment.servicesLabel || "Услуга"}</div>
                        <div className="mt-1 text-xs" style={{ color: modalMutedColor }}>
                          {[selectedAppointment.specialistName, selectedAppointment.locationName].filter(Boolean).join(" - ")}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex gap-1" aria-label="Оценка">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          className="text-3xl leading-none"
                          style={{ color: rating >= value ? starColor : "rgba(148, 163, 184, 0.55)" }}
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
                      className="min-h-[120px] border bg-transparent px-4 py-3 text-sm outline-none"
                      style={fieldStyle}
                    />

                    <div className="border border-dashed px-4 py-4" style={{ ...fieldStyle, backgroundColor: "transparent" }}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Фотографии</div>
                          <div className="mt-1 text-xs" style={{ color: modalMutedColor }}>
                            До {MAX_REVIEW_PHOTOS} изображений JPG, PNG, WebP или HEIC.
                          </div>
                        </div>
                        <label
                          className={`inline-flex cursor-pointer items-center justify-center border px-4 py-2 text-xs font-semibold transition hover:bg-black/[0.03] ${
                            photos.length >= MAX_REVIEW_PHOTOS ? "pointer-events-none opacity-50" : ""
                          }`}
                          style={fieldStyle}
                        >
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
                            <div key={photo.id} className="group relative aspect-square overflow-hidden border" style={fieldStyle}>
                              <UnoptimizedImage src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => void handlePhotoDelete(photo)}
                                className="absolute right-1 top-1 bg-black/65 px-2 py-1 text-[10px] font-semibold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                                style={{ borderRadius: 999 }}
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
                  <div className="border px-4 py-4 text-sm" style={{ ...fieldStyle, color: modalMutedColor, backgroundColor: "rgba(148, 163, 184, 0.08)" }}>
                    Завершенных записей без отзыва пока нет.
                  </div>
                )}

                {saved ? <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" style={{ borderRadius: modalStyle?.borderRadius ?? 8 }}>Отзыв сохранен.</div> : null}
                {error ? <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" style={{ borderRadius: modalStyle?.borderRadius ?? 8 }}>{error}</div> : null}

                <button
                  type="submit"
                  disabled={submitting || uploadingPhotos || rating < 1 || !selectedAppointment}
                  className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold disabled:opacity-50"
                  style={actionButtonStyle}
                >
                  {submitting ? "Сохраняем..." : "Оставить отзыв"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
