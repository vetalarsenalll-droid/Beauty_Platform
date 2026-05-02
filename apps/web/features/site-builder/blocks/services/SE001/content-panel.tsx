import type { CrmPanelCtx } from "../../runtime/contracts";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";

function renderSectionTitle(title: string) {
  return (
    <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
      {title}
    </div>
  );
}

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

function renderFlatEntityListEditor(ctx: CrmPanelCtx, updateData: (patch: Record<string, unknown>) => void) {
  const block = ctx.block;
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []);
  const locationId = typeof block.data.locationId === "number" ? block.data.locationId : null;
  const locationServices = locationId
    ? ctx.services.filter((item) => item.locationIds.includes(locationId))
    : ctx.services;
  const locationServiceIds = new Set(locationServices.map((item) => item.id));

  return (
    <div className="space-y-5">
      {renderFlatSelect(
        "Список локаций",
        String(locationId ?? ""),
        (value) => {
          const nextLocationId = value ? Number(value) : null;
          const nextLocationServices = nextLocationId
            ? ctx.services.filter((item) => item.locationIds.includes(nextLocationId))
            : ctx.services;
          const nextLocationServiceIds = new Set(nextLocationServices.map((item) => item.id));
          updateData({
            locationId: nextLocationId,
            ids: Array.from(selected).filter((id) => nextLocationServiceIds.has(id)),
          });
        },
        [
          { value: "", label: "Все локации" },
          ...ctx.locations.map((location) => ({
            value: String(location.id),
            label: location.name,
          })),
        ]
      )}
      {renderFlatSelect("Список услуг", mode, (value) => updateData({ mode: value }), [
        { value: "all", label: "Все" },
        { value: "selected", label: "Выбранные" },
      ])}
      {mode === "selected" ? (
        <div className="border-b border-[color:var(--bp-stroke)] pb-2">
          <div className="pb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Выберите элементы
          </div>
          <div className="max-h-48 space-y-3 overflow-auto pr-2">
            {locationServices.map((item) => {
              const checked = selected.has(item.id);
              return (
                <div key={item.id} className="border-b border-[color:var(--bp-stroke)] pb-3">
                  <FlatCheckbox
                    checked={checked}
                    onChange={(nextChecked) => {
                      const next = new Set(
                        Array.from(selected).filter((id) => locationServiceIds.has(id))
                      );
                      if (nextChecked) next.add(item.id);
                      else next.delete(item.id);
                      updateData({ ids: Array.from(next) });
                    }}
                    label={item.name}
                  />
                </div>
              );
            })}
            {locationServices.length === 0 ? (
              <div className="pb-3 text-sm text-[color:var(--bp-muted)]">
                В выбранной локации нет услуг.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SE001ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const activeSectionId = ctx.activePanelSectionId;
  const inSection = (...ids: string[]) =>
    ids.length === 0 || activeSectionId === null || ids.includes(activeSectionId);

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-8 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {inSection("text") && (
        <div className="space-y-5">
          {renderFlatTextInput(
            "Заголовок",
            String(block.data.title ?? ""),
            (value) => updateData({ title: value }),
            "Услуги"
          )}
          {renderFlatTextInput(
            "Описание",
            String(block.data.subtitle ?? ""),
            (value) => updateData({ subtitle: value }),
            "Выберите подходящую услугу"
          )}
        </div>
      )}

      {inSection("catalog") && (
        <div className="space-y-5">
          {renderFlatEntityListEditor(ctx, updateData)}
        </div>
      )}
    </div>
  );
}
