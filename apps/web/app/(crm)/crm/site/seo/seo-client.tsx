"use client";

import { useState } from "react";

type SeoSettings = {
  title: string;
  description: string;
  ogImageUrl: string;
  robots: string;
  sitemapEnabled: boolean;
  schemaJson: object | null;
};

type SeoClientProps = {
  initialSeo: SeoSettings;
};

export default function SeoClient({ initialSeo }: SeoClientProps) {
  const [seo, setSeo] = useState(initialSeo);
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
                  "Disallow: /crm",
                  "Disallow: /platform",
                  "Disallow: /api",
                  "Disallow: /booking",
                  "Disallow: /legal",
                  "Disallow: /_next",
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
