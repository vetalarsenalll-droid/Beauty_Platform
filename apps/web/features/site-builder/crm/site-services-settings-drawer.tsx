import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

function renderFlatTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        />
      </div>
    </label>
  );
}

function renderFlatSelect(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: Array<{ value: string; label: string }>
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
          ▾
        </span>
      </div>
    </label>
  );
}

export function SiteServicesSettingsDrawer({
  block,
  _activeTheme,
  activeSectionId,
  updateBlock,
}: {
  block: SiteBlock;
  _activeTheme: SiteTheme;
  activeSectionId: string;
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
}) {
  const data = (block.data as Record<string, unknown>) ?? {};
  const updateData = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={Boolean(data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать основную кнопку записи"
        />
        {renderFlatTextInput(
          "Текст основной кнопки",
          String(data.buttonText ?? "Записаться"),
          (value) => updateData({ buttonText: value || "Записаться" }),
          "Записаться"
        )}
        {renderFlatTextInput(
          "Текст кнопки подробностей",
          String(data.detailsButtonText ?? "Подробнее"),
          (value) => updateData({ detailsButtonText: value || "Подробнее" }),
          "Подробнее"
        )}
      </div>
    );
  }

  if (activeSectionId === "servicePage") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect(
          "Действие кнопки подробностей",
          String(data.servicePageButtonMode ?? "entityPage"),
          (value) => updateData({ servicePageButtonMode: value }),
          [
            { value: "entityPage", label: "Открыть страницу услуги" },
            { value: "booking", label: "Сразу вести к записи" },
          ]
        )}
        <FlatCheckbox
          checked={data.modalImageClickEnabled !== false}
          onChange={(checked) => updateData({ modalImageClickEnabled: checked })}
          label="Оставлять переход в страницу услуги по клику на фото"
        />
      </div>
    );
  }

  return null;
}
