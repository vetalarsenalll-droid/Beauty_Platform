import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../runtime/contracts";

export function SharedLoaderContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const blockData = ((block.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <div className="grid grid-cols-2 gap-3">
        <FlatCheckbox
          checked={blockData.enabled !== false}
          onChange={(checked) => updateData({ enabled: checked })}
          label="Включить лоадер"
        />
        <FlatCheckbox
          checked={blockData.showPageOverlay !== false}
          onChange={(checked) => updateData({ showPageOverlay: checked })}
          label="Показывать на сайте"
        />
        <FlatCheckbox
          checked={blockData.showBookingInline !== false}
          onChange={(checked) => updateData({ showBookingInline: checked })}
          label="Показывать в онлайн-записи"
        />
      </div>
    </div>
  );
}
