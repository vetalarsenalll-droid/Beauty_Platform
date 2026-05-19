import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";

function readString(data: Record<string, unknown>, key: string, fallback: string) {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

export function ClientCabinetContentPanel(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(ctx.block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch, clientView: "cabinet" },
    }));
  };

  return (
    <div className="space-y-6 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {renderCoverFlatTextInput("Заголовок кабинета", readString(data, "cabinetTitle", "Личный кабинет"), (value) => updateData({ cabinetTitle: value }))}
      {renderCoverFlatTextInput("Email в превью", readString(data, "cabinetEmail", "client@example.com"), (value) => updateData({ cabinetEmail: value }))}
      {renderCoverFlatTextInput("Карточка записи", readString(data, "appointmentTitle", "Следующая запись"), (value) => updateData({ appointmentTitle: value }))}
      {renderCoverFlatTextInput("Текст без записи", readString(data, "appointmentEmptyText", "Пока нет ближайших записей."), (value) => updateData({ appointmentEmptyText: value }))}
      {renderCoverFlatTextInput("Карточка лояльности", readString(data, "loyaltyTitle", "Лояльность"), (value) => updateData({ loyaltyTitle: value }))}
      {renderCoverFlatTextInput("Значение лояльности", readString(data, "loyaltyValue", "0 ₽"), (value) => updateData({ loyaltyValue: value }))}
    </div>
  );
}
