import { useState } from "react";
import { clamp01, hexToRgbaString, parseBackdropColor } from "@/features/site-builder/crm/site-client-core";
import { FlatCheckbox, SliderTrack } from "@/features/site-builder/crm/site-renderer";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import type { CrmPanelCtx } from "../../runtime/contracts";

function readLoaderPalette(blockData: Record<string, unknown>) {
  const parsedLight = parseBackdropColor(blockData.backdropColor);
  const parsedDark = parseBackdropColor(blockData.backdropColorDark);
  const backdropHexLight =
    typeof blockData.backdropHex === "string" && blockData.backdropHex.trim()
      ? blockData.backdropHex.trim()
      : parsedLight.hex;
  const backdropOpacityLight = Number.isFinite(Number(blockData.backdropOpacity))
    ? clamp01(Number(blockData.backdropOpacity))
    : parsedLight.alpha;
  const backdropHexDark =
    typeof blockData.backdropHexDark === "string" && blockData.backdropHexDark.trim()
      ? blockData.backdropHexDark.trim()
      : parsedDark.hex || backdropHexLight;
  const backdropOpacityDark = Number.isFinite(Number(blockData.backdropOpacityDark))
    ? clamp01(Number(blockData.backdropOpacityDark))
    : parsedDark.alpha;
  const loaderColorLight =
    typeof blockData.color === "string" && blockData.color.trim()
      ? blockData.color.trim()
      : "#111827";
  const loaderColorDark =
    typeof blockData.colorDark === "string" && blockData.colorDark.trim()
      ? blockData.colorDark.trim()
      : loaderColorLight;
  return {
    backdropHexLight,
    backdropOpacityLight,
    backdropHexDark,
    backdropOpacityDark,
    loaderColorLight,
    loaderColorDark,
  };
}

export function LoaderContentPanel(ctx: CrmPanelCtx) {
  const [darkOpen, setDarkOpen] = useState(false);
  const block = ctx.block;
  const blockData = ((block.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  const {
    backdropHexLight,
    backdropOpacityLight,
    backdropHexDark,
    backdropOpacityDark,
    loaderColorLight,
    loaderColorDark,
  } = readLoaderPalette(blockData);

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  const updateBackdropLight = (hex: string, alpha: number) =>
    updateData({
      backdropHex: hex,
      backdropOpacity: alpha,
      backdropColor: hexToRgbaString(hex, alpha),
    });

  const updateBackdropDark = (hex: string, alpha: number) =>
    updateData({
      backdropHexDark: hex,
      backdropOpacityDark: alpha,
      backdropColorDark: hexToRgbaString(hex, alpha),
    });

  return (
    <div
      className="space-y-6 [&_input:not([type='checkbox']):not([type='range'])]:!rounded-none [&_input:not([type='checkbox']):not([type='range'])]:!border-0 [&_input:not([type='checkbox']):not([type='range'])]:!border-b [&_input:not([type='checkbox']):not([type='range'])]:!border-[color:var(--bp-stroke)] [&_input:not([type='checkbox']):not([type='range'])]:!bg-transparent [&_input:not([type='checkbox']):not([type='range'])]:!px-0 [&_input:not([type='checkbox']):not([type='range'])]:!py-1 [&_input:not([type='checkbox']):not([type='range'])]:!shadow-none [&_input:not([type='checkbox']):not([type='range'])]:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus:!ring-0 [&_input:not([type='checkbox']):not([type='range'])]:focus:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus-visible:!outline-none"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="block">
          <FlatCheckbox
            checked={blockData.enabled !== false}
            onChange={(checked) => updateData({ enabled: checked })}
            label="Включить лоадер"
          />
        </div>
        <div className="block">
          <FlatCheckbox
            checked={blockData.showPageOverlay !== false}
            onChange={(checked) => updateData({ showPageOverlay: checked })}
            label="Показывать на сайте"
          />
        </div>
        <div className="block">
          <FlatCheckbox
            checked={blockData.showBookingInline !== false}
            onChange={(checked) => updateData({ showBookingInline: checked })}
            label="Показывать в онлайн-записи"
          />
        </div>
        <div className="block">
          <FlatCheckbox
            checked={Boolean(blockData.backdropEnabled)}
            onChange={(checked) => updateData({ backdropEnabled: checked })}
            label="Затемнять фон"
          />
        </div>
      </div>

      <div className="space-y-4">
        <TildaInlineColorField
          compact
          label="Цвет затемнения"
          value={backdropHexLight}
          placeholder="#111827"
          onChange={(value) => updateBackdropLight(value, backdropOpacityLight)}
          onClear={() => updateBackdropLight("#111827", backdropOpacityLight)}
        />
        <SliderTrack
          label="Прозрачность затемнения"
          value={Math.round(backdropOpacityLight * 100)}
          min={0}
          max={100}
          onChange={(value) => updateBackdropLight(backdropHexLight, value / 100)}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />
        <TildaInlineColorField
          compact
          label="Цвет лоадера"
          value={loaderColorLight}
          placeholder="#111827"
          onChange={(value) => updateData({ color: value })}
          onClear={() => updateData({ color: "#111827" })}
        />
      </div>

      <button
        type="button"
        onClick={() => setDarkOpen((prev) => !prev)}
        className="flex w-full items-center justify-between border-b border-[color:var(--bp-stroke)] py-2 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]"
      >
        <span>Темная тема</span>
        <span className="text-xs leading-none">{darkOpen ? "−" : "+"}</span>
      </button>

      {darkOpen && (
        <div className="space-y-4">
          <TildaInlineColorField
          compact
          label="Цвет затемнения"
            value={backdropHexDark}
            placeholder="#111827"
            onChange={(value) => updateBackdropDark(value, backdropOpacityDark)}
            onClear={() => updateBackdropDark("#111827", backdropOpacityDark)}
          />
          <SliderTrack
            label="Прозрачность затемнения"
            value={Math.round(backdropOpacityDark * 100)}
            min={0}
            max={100}
            onChange={(value) => updateBackdropDark(backdropHexDark, value / 100)}
            accentColor="#ff5a5f"
            railColor="var(--bp-stroke)"
          />
          <TildaInlineColorField
          compact
          label="Цвет лоадера"
            value={loaderColorDark}
            placeholder="#111827"
            onChange={(value) => updateData({ colorDark: value })}
            onClear={() => updateData({ colorDark: "#111827" })}
          />
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Размер</div>
          <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {Number(blockData.size ?? 36)} px
          </div>
        </label>
        <SliderTrack
          label="Размер лоадера"
          value={Number(blockData.size ?? 36)}
          min={16}
          max={120}
          onChange={(value) => updateData({ size: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />

        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Скорость анимации</div>
          <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {Number(blockData.speedMs ?? 900)} мс
          </div>
        </label>
        <SliderTrack
          label="Скорость анимации"
          value={Number(blockData.speedMs ?? 900)}
          min={300}
          max={4000}
          onChange={(value) => updateData({ speedMs: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />

        <div className="block">
          <FlatCheckbox
            checked={Boolean(blockData.fixedDurationEnabled)}
            onChange={(checked) => updateData({ fixedDurationEnabled: checked })}
            label="Фиксированное время показа"
          />
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Время показа</div>
          <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {Number(blockData.fixedDurationSec ?? 1)} сек
          </div>
        </label>
        <SliderTrack
          label="Время показа"
          value={Number(blockData.fixedDurationSec ?? 1)}
          min={1}
          max={10}
          onChange={(value) => updateData({ fixedDurationSec: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />

        <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          <div className="min-h-[32px] leading-4">Толщина</div>
          <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {Number(blockData.thickness ?? 1)} px
          </div>
        </label>
        <SliderTrack
          label="Толщина"
          value={Number(blockData.thickness ?? 1)}
          min={1}
          max={10}
          onChange={(value) => updateData({ thickness: value })}
          accentColor="#ff5a5f"
          railColor="var(--bp-stroke)"
        />
      </div>
    </div>
  );
}



