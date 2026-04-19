"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BusinessType, LegalType } from "@prisma/client";
import { BUSINESS_CATALOG, LEGAL_TYPE_OPTIONS } from "@/lib/business-catalog";

type RegisterStep = 1 | 2 | 3 | 4;

type PlatformLegalDoc = {
  key: string;
  title: string;
  versionId: number;
  url: string;
};

export default function CrmRegisterPage() {
  const params = useSearchParams();
  const inviteToken = String(params.get("invite") ?? "").trim();
  const invitedEmail = String(params.get("email") ?? "").trim();

  const [step, setStep] = useState<RegisterStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaId, setCaptchaId] = useState<string>("");
  const [captchaQuestion, setCaptchaQuestion] = useState<string>("");
  const [captchaAnswer, setCaptchaAnswer] = useState<string>("");

  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [legalType, setLegalType] = useState<LegalType>("IP");
  const [businessType, setBusinessType] = useState<BusinessType>("BEAUTY_SALON");
  const [phone, setPhone] = useState("");
  const [timeZone, setTimeZone] = useState("Europe/Moscow");

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pdConsent, setPdConsent] = useState(false);
  const [dpa, setDpa] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [legalLinks, setLegalLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadLegalDocs = async () => {
      const response = await fetch("/api/v1/public/legal/platform-docs", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { documents?: PlatformLegalDoc[] } }
        | null;
      const docs = payload?.data?.documents ?? [];
      if (!Array.isArray(docs) || cancelled) return;

      const map: Record<string, string> = {};
      for (const doc of docs) {
        if (doc?.key && doc?.url) {
          map[doc.key] = doc.url;
        }
      }

      setLegalLinks(map);
    };

    void loadLegalDocs();

    return () => {
      cancelled = true;
    };
  }, []);

  const canComplete = useMemo(
    () =>
      Boolean(
        businessName.trim() &&
          phone.trim() &&
          legalType &&
          businessType &&
          terms &&
          privacy &&
          pdConsent &&
          dpa
      ),
    [businessName, phone, legalType, businessType, terms, privacy, pdConsent, dpa]
  );

  const legalHref = (key: string) => legalLinks[key] ?? null;

  const withLoading = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить действие";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await withLoading(async () => {
      const response = await fetch("/api/v1/crm/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(captchaId && captchaAnswer ? { captchaId, captchaAnswer } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: Record<string, unknown> | null; error?: { code?: string; message?: string } }
        | null;

      if (!response.ok) {
        if (payload?.error?.code === "CAPTCHA_REQUIRED") {
          const challengeResponse = await fetch("/api/v1/crm/auth/captcha/challenge", {
            method: "POST",
          });
          const challengePayload = (await challengeResponse.json().catch(() => null)) as
            | { data?: { captchaId?: string; question?: string } }
            | null;
          const nextCaptchaId = String(challengePayload?.data?.captchaId ?? "");
          const nextQuestion = String(challengePayload?.data?.question ?? "");
          setCaptchaId(nextCaptchaId);
          setCaptchaQuestion(nextQuestion);
          throw new Error("Подтвердите, что вы не робот");
        }
        throw new Error(payload?.error?.message ?? "Не удалось начать регистрацию");
      }

      setCaptchaId("");
      setCaptchaQuestion("");
      setCaptchaAnswer("");
      setStep(2);
    });
  };

  const verifyEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await withLoading(async () => {
      const response = await fetch("/api/v1/crm/auth/register/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Не удалось подтвердить email");
      }

      setStep(3);
    });
  };

  const submitBusinessData = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError("Укажите название бизнеса");
      return;
    }
    if (!phone.trim()) {
      setError("Укажите телефон");
      return;
    }

    setStep(4);
  };

  const completeRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canComplete) {
      setError("Заполните все обязательные поля и примите обязательные документы");
      return;
    }

    await withLoading(async () => {
      const response = await fetch("/api/v1/crm/auth/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          businessName,
          legalType,
          businessType,
          phone,
          timeZone,
          ...(inviteToken ? { inviteToken } : {}),
          consents: { terms, privacy, pdConsent, dpa, marketing },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Не удалось завершить регистрацию");
      }

      window.location.href = "/crm";
    });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center">
      <div className="w-full rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-8 shadow-[var(--bp-shadow)]">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          ONLAIS CRM
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Регистрация бизнеса</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Шаг {step} из 4
        </p>

        {step === 1 ? (
          <form className="mt-8 flex flex-col gap-4" onSubmit={startRegistration}>
            <label className="text-sm font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@onlais.ru"
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
                readOnly={Boolean(inviteToken)}
              />
            </label>
            <label className="text-sm font-medium">
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 8 символов"
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
              />
            </label>
            {captchaQuestion ? (
              <>
                <label className="text-sm font-medium">
                  Captcha: {captchaQuestion}
                  <input
                    type="text"
                    value={captchaAnswer}
                    onChange={(event) => setCaptchaAnswer(event.target.value)}
                    placeholder="Введите ответ"
                    className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                    required
                  />
                </label>
              </>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--bp-accent-strong)] disabled:opacity-60"
            >
              {loading ? "Отправка..." : "Продолжить"}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form className="mt-8 flex flex-col gap-4" onSubmit={verifyEmail}>
            <label className="text-sm font-medium">
              Код подтверждения email
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6 цифр"
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--bp-accent-strong)] disabled:opacity-60"
            >
              {loading ? "Проверка..." : "Подтвердить email"}
            </button>
          </form>
        ) : null}

        {step === 3 ? (
          <form className="mt-8 grid gap-4" onSubmit={submitBusinessData}>
            <label className="text-sm font-medium">
              Название бизнеса
              <input
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Например, ONLAIS Studio"
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
              />
            </label>

            <label className="text-sm font-medium">
              Организационно-правовая форма
              <select
                value={legalType}
                onChange={(event) => setLegalType(event.target.value as LegalType)}
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
              >
                {LEGAL_TYPE_OPTIONS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Направление деятельности
              <select
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
              >
                {BUSINESS_CATALOG.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Телефон владельца
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 (___) ___-__-__"
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
                required
              />
            </label>

            <label className="text-sm font-medium">
              Часовой пояс
              <select
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)]"
              >
                <option value="Europe/Moscow">Europe/Moscow</option>
                <option value="Europe/Samara">Europe/Samara</option>
                <option value="Asia/Yekaterinburg">Asia/Yekaterinburg</option>
                <option value="Asia/Novosibirsk">Asia/Novosibirsk</option>
                <option value="Asia/Krasnoyarsk">Asia/Krasnoyarsk</option>
                <option value="Asia/Irkutsk">Asia/Irkutsk</option>
                <option value="Asia/Vladivostok">Asia/Vladivostok</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--bp-accent-strong)] disabled:opacity-60"
            >
              Продолжить
            </button>
          </form>
        ) : null}

        {step === 4 ? (
          <form className="mt-8 flex flex-col gap-3" onSubmit={completeRegistration}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
              <span>
                Принимаю Пользовательское соглашение (обязательно){" "}
                {legalHref("user-agreement") ? (
                  <Link
                    href={String(legalHref("user-agreement"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--bp-accent)] underline"
                  >
                    Ознакомиться
                  </Link>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(event) => setPrivacy(event.target.checked)}
              />
              <span>
                Принимаю Политику конфиденциальности (обязательно){" "}
                {legalHref("privacy-policy") ? (
                  <Link
                    href={String(legalHref("privacy-policy"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--bp-accent)] underline"
                  >
                    Ознакомиться
                  </Link>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={pdConsent}
                onChange={(event) => setPdConsent(event.target.checked)}
              />
              <span>
                Даю согласие на обработку персональных данных (обязательно){" "}
                {legalHref("personal-data-consent") ? (
                  <Link
                    href={String(legalHref("personal-data-consent"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--bp-accent)] underline"
                  >
                    Ознакомиться
                  </Link>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={dpa} onChange={(event) => setDpa(event.target.checked)} />
              <span>
                Принимаю Поручение на обработку персональных данных (обязательно){" "}
                {legalHref("pd-processing-order") ? (
                  <Link
                    href={String(legalHref("pd-processing-order"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--bp-accent)] underline"
                  >
                    Ознакомиться
                  </Link>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
              />
              <span>
                Согласен на рекламно-информационные рассылки (опционально){" "}
                {legalHref("marketing-consent") ? (
                  <Link
                    href={String(legalHref("marketing-consent"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--bp-accent)] underline"
                  >
                    Ознакомиться
                  </Link>
                ) : null}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !canComplete}
              className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:bg-[color:var(--bp-accent-strong)] disabled:opacity-60"
            >
              {loading ? "Создание аккаунта..." : "Завершить регистрацию"}
            </button>
          </form>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mt-6 text-center text-sm text-[color:var(--bp-muted)]">
          Уже есть аккаунт?{" "}
          <Link href="/crm/login" className="text-[color:var(--bp-accent)] hover:underline">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
