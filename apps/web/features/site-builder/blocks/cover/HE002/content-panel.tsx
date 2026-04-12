import { PAGE_KEYS, PAGE_LABELS } from "@/features/site-builder/crm/site-client-core";
import {
  FieldText,
  FieldTextarea,
} from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";

type Slide = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonPage: string | null;
  buttonHref: string;
  imageUrl: string;
};

function normalizeSlides(raw: unknown): Slide[] {
  const input = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  const slides = input
    .map((item, index) => {
      const id = String(item.id ?? `slide-${index + 1}`);
      return {
        id,
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        buttonText: String(item.buttonText ?? ""),
        buttonPage: (item.buttonPage as string) ?? null,
        buttonHref: String(item.buttonHref ?? ""),
        imageUrl: String(item.imageUrl ?? ""),
      };
    })
    .filter((s) => s.id.trim() !== "");
  if (slides.length > 0) return slides;
  return [
    {
      id: "slide-1",
      title: "Красота без компромиссов",
      description: "Запишитесь на любимую услугу в удобное время и доверяйте себя профессионалам.",
      buttonText: "Подробнее",
      buttonPage: "booking",
      buttonHref: "",
      imageUrl: "",
    },
  ];
}

export function CoverV2ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const slides = normalizeSlides((block.data as any).coverSlides);
  const updateData = (patch: Record<string, unknown>) =>
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  const updateSlides = (next: Slide[]) => updateData({ coverSlides: next });

  const uploadSlideImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("type", "siteCover");
      formData.append("file", file);
      const response = await fetch("/api/v1/crm/account/media", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.data?.url !== "string") return null;
      return payload.data.url as string;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Вариант
        </div>
        <select
          value={block.variant}
          onChange={(event) => {
            const nextVariant = event.target.value as "v1" | "v2";
            ctx.updateBlock(block.id, (prev) => ({ ...prev, variant: nextVariant } as any));
          }}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="v1">Вариант 1</option>
          <option value="v2">Вариант 2</option>
        </select>
      </label>

      {slides.map((slide, index) => {
        const updateSlide = (patch: Partial<Slide>) => {
          const next = [...slides];
          next[index] = { ...next[index], ...patch };
          updateSlides(next);
        };
        const moveSlide = (dir: -1 | 1) => {
          const target = index + dir;
          if (target < 0 || target >= slides.length) return;
          const next = [...slides];
          [next[index], next[target]] = [next[target], next[index]];
          updateSlides(next);
        };
        const removeSlide = () => {
          if (slides.length <= 1) return;
          updateSlides(slides.filter((_, i) => i !== index));
        };

        return (
          <div key={slide.id} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Слайд {index + 1}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveSlide(-1)}
                  className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(1)}
                  className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={index === slides.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={removeSlide}
                  className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={slides.length <= 1}
                >
                  Удалить
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <FieldText
                label="Заголовок"
                value={slide.title}
                onChange={(value) => updateSlide({ title: value })}
              />
              <FieldTextarea
                label="Описание"
                value={slide.description}
                onChange={(value) => updateSlide({ description: value })}
              />
              <FieldText
                label="Текст кнопки"
                value={slide.buttonText}
                onChange={(value) => updateSlide({ buttonText: value })}
              />

              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Страница кнопки
                </div>
                <select
                  value={slide.buttonPage ?? ""}
                  onChange={(event) => updateSlide({ buttonPage: event.target.value || null, buttonHref: "" })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="">Не выбрано</option>
                  {PAGE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {PAGE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>

              <FieldText
                label="Ссылка кнопки (внешняя)"
                value={slide.buttonHref}
                onChange={(value) => updateSlide({ buttonHref: value, buttonPage: null })}
              />

              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Изображение слайда
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (!file) return;
                      const url = await uploadSlideImage(file);
                      if (url) updateSlide({ imageUrl: url });
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <FieldText
                  label="URL изображения"
                  value={slide.imageUrl}
                  onChange={(value) => updateSlide({ imageUrl: value })}
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => {
          const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          updateSlides([
            ...slides,
            {
              id: slideId,
              title: "Новый слайд",
              description: "Добавьте описание слайда",
              buttonText: "Подробнее",
              buttonPage: "booking",
              buttonHref: "",
              imageUrl: "",
            },
          ]);
        }}
        className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm font-semibold"
      >
        Добавить слайд
      </button>
    </div>
  );
}
