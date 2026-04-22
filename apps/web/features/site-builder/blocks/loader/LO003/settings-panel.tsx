import { LEGACY_WIDTH_REFERENCE, MAX_BLOCK_COLUMNS } from "@/features/site-builder/crm/site-client-core";
import { CoverGridWidthControl } from "@/features/site-builder/crm/site-editor-panels";
import type { CrmPanelCtx } from "../../runtime/contracts";

export function LoaderSettingsPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const style = ((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {};
  const start = Number.isFinite(Number(style.gridStartColumn)) ? Number(style.gridStartColumn) : 1;
  const end = Number.isFinite(Number(style.gridEndColumn)) ? Number(style.gridEndColumn) : 12;

  const applyRange = (nextStart: number, nextEnd: number) => {
    const nextColumns = Math.max(1, nextEnd - nextStart + 1);
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: {
        ...(prev.data as Record<string, unknown>),
        style: {
          ...(((prev.data as Record<string, unknown>).style as Record<string, unknown>) ?? {}),
          useCustomWidth: true,
          blockWidthColumns: nextColumns,
          blockWidth: Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
          gridStartColumn: nextStart,
          gridEndColumn: nextEnd,
        },
      },
    }));
  };

  return (
    <div className="space-y-4" onClick={(event) => event.stopPropagation()}>
      <CoverGridWidthControl start={start} end={end} onChange={applyRange} />
    </div>
  );
}
