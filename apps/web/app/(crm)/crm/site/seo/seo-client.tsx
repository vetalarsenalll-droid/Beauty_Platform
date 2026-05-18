"use client";

import { useState } from "react";

type SeoSettings = {
  title: string;
  description: string;
  ogImageUrl: string;
  robots: string;
  sitemapEnabled: boolean;
  schemaJson: unknown | null;
  verificationMetaTags: string;
  verificationHtmlFilename: string;
  verificationHtmlContent: string;
  verificationHtmlFiles: VerificationHtmlFile[];
  pageSettings: PageSeoSettings[];
};

type SeoClientProps = {
  initialSeo: SeoSettings;
};

type PageSeoSettings = {
  pageKey: string;
  title: string;
  description: string;
  ogImageUrl: string;
  noIndex: boolean;
};

type VerificationHtmlFile = {
  filename: string;
  content: string;
};

export default function SeoClient({ initialSeo }: SeoClientProps) {
  const [seo, setSeo] = useState<SeoSettings>(() => ({
    ...initialSeo,
    verificationHtmlFiles:
      initialSeo.verificationHtmlFiles.length > 0
        ? initialSeo.verificationHtmlFiles
        : initialSeo.verificationHtmlFilename || initialSeo.verificationHtmlContent
          ? [
              {
                filename: initialSeo.verificationHtmlFilename,
                content: initialSeo.verificationHtmlContent,
              },
            ]
          : [],
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveSeo = async () => {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/seo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seo),
    });
    if (response.ok) {
      const data = await response.json();
      setSeo(data.data);
      setMessage("SEO настройки сохранены.");
    } else {
      setMessage("Не удалось сохранить SEO.");
    }
    setSaving(false);
  };

  const updateVerificationFile = (
    index: number,
    patch: Partial<VerificationHtmlFile>
  ) => {
    setSeo((prev) => {
      const files = prev.verificationHtmlFiles.map((file, fileIndex) =>
        fileIndex === index ? { ...file, ...patch } : file
      );
      return {
        ...prev,
        verificationHtmlFiles: files,
        verificationHtmlFilename: files[0]?.filename ?? "",
        verificationHtmlContent: files[0]?.content ?? "",
      };
    });
  };

  const addVerificationFile = () => {
    setSeo((prev) => ({
      ...prev,
      verificationHtmlFiles: [
        ...prev.verificationHtmlFiles,
        { filename: "", content: "" },
      ],
    }));
  };

  const removeVerificationFile = (index: number) => {
    setSeo((prev) => {
      const files = prev.verificationHtmlFiles.filter((_, fileIndex) => fileIndex !== index);
      return {
        ...prev,
        verificationHtmlFiles: files,
        verificationHtmlFilename: files[0]?.filename ?? "",
        verificationHtmlContent: files[0]?.content ?? "",
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">SEO</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Robots.txt и sitemap.xml формируются автоматически. Здесь можно указать
          базовые метаданные сайта.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="text-sm">
            Заголовок страницы
            <input
              value={seo.title}
              onChange={(e) => setSeo((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Описание
            <textarea
              value={seo.description}
              onChange={(e) => setSeo((prev) => ({ ...prev, description: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
              rows={3}
            />
          </label>
          <label className="text-sm">
            Картинка для соцсетей (OG)
            <input
              value={seo.ogImageUrl}
              onChange={(e) => setSeo((prev) => ({ ...prev, ogImageUrl: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Robots.txt (автоматически)
            <textarea
              value={
                seo.robots ||
                [
                  "User-Agent: *",
                  "Disallow: /_next",
                  "Disallow: /api",
                  "",
                  "Sitemap: https://ваш-домен/sitemap.xml",
                ].join("\n")
              }
              readOnly
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              rows={6}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={seo.sitemapEnabled}
              onChange={(e) =>
                setSeo((prev) => ({ ...prev, sitemapEnabled: e.target.checked }))
              }
            />
            Включить sitemap
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Подтверждение сайта</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Для Google Search Console и Яндекс Вебмастера лучше использовать DNS TXT.
          Если сервис выдал meta-тег или файл подтверждения, добавьте его здесь.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="text-sm">
            Meta-теги подтверждения
            <textarea
              value={seo.verificationMetaTags}
              onChange={(e) =>
                setSeo((prev) => ({ ...prev, verificationMetaTags: e.target.value }))
              }
              placeholder={'<meta name="google-site-verification" content="..." />\n<meta name="yandex-verification" content="..." />'}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 font-mono text-xs"
              rows={4}
            />
          </label>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium">HTML-файлы подтверждения</div>
              <button
                type="button"
                onClick={addVerificationFile}
                className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs font-semibold"
              >
                Добавить файл
              </button>
            </div>
            {seo.verificationHtmlFiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[color:var(--bp-stroke)] px-3 py-3 text-xs text-[color:var(--bp-muted)]">
                Добавьте HTML-файл, если Google или Яндекс выдали подтверждение через файл.
              </div>
            ) : (
              seo.verificationHtmlFiles.map((file, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-[color:var(--bp-stroke)] p-3 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto]"
                >
                  <label className="text-sm">
                    Имя файла
                    <input
                      value={file.filename}
                      onChange={(e) =>
                        updateVerificationFile(index, { filename: e.target.value })
                      }
                      placeholder="google1234567890abcdef.html или yandex_1234567890abcdef.html"
                      className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    Содержимое файла
                    <input
                      value={file.content}
                      onChange={(e) =>
                        updateVerificationFile(index, { content: e.target.value })
                      }
                      placeholder="google-site-verification: ... или Verification: ..."
                      className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVerificationFile(index)}
                    className="self-end rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
                  >
                    Удалить
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-chip)] px-3 py-2 text-xs text-[color:var(--bp-muted)]">
            Файл будет доступен по адресу вида
            {" "}
            <span className="font-mono">https://домен-клиента.ru/имя-файла.html</span>.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={saveSeo}
            className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </section>
    </div>
  );
}
