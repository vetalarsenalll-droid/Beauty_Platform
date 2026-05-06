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

export function BO001ContentPanel(ctx: CrmPanelCtx) {
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sectionTitle = ctx.currentPanelSections[0]?.label ?? "Документы и согласия";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/v1/crm/settings/legal")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setLegalDocs(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch(() => {
        if (!cancelled) setMessage("Не удалось загрузить документы.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setLegalDocs(Array.isArray(payload?.data) ? payload.data : documents);
      setMessage("Документы сохранены.");
    } catch {
      setMessage("Не удалось сохранить документы.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8" onClick={(event) => event.stopPropagation()}>
      <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
        {sectionTitle}
      </div>

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

      {message ? (
        <div className="border-b border-[color:var(--bp-stroke)] pb-3 text-sm text-[color:var(--bp-ink)]">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-[color:var(--bp-muted)]">Загрузка документов...</div>
      ) : (
        <div>
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
