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
      {renderCoverFlatTextInput("Подпись раздела", readString(data, "cabinetSectionLabel", "Клиентский кабинет"), (value) => updateData({ cabinetSectionLabel: value }))}
      {renderCoverFlatTextInput("Карточка записи", readString(data, "appointmentTitle", "Следующая запись"), (value) => updateData({ appointmentTitle: value }))}
      {renderCoverFlatTextInput("Текст без записи", readString(data, "appointmentEmptyText", "Пока нет ближайших записей."), (value) => updateData({ appointmentEmptyText: value }))}
      {renderCoverFlatTextInput("Карточка подсказок", readString(data, "smartHintTitle", "Умные подсказки"), (value) => updateData({ smartHintTitle: value }))}
      {renderCoverFlatTextInput("Текст подсказки", readString(data, "smartHintText", "Вы недавно были у нас. Хотите повторить услугу позже?"), (value) => updateData({ smartHintText: value }))}
      {renderCoverFlatTextInput("Карточка лояльности", readString(data, "loyaltyTitle", "Лояльность"), (value) => updateData({ loyaltyTitle: value }))}
      {renderCoverFlatTextInput("Подпись статуса", readString(data, "loyaltyStatusText", "Статус: Базовый"), (value) => updateData({ loyaltyStatusText: value }))}
      {renderCoverFlatTextInput("Карточка контактов", readString(data, "contactsTitle", "Контакты"), (value) => updateData({ contactsTitle: value }))}
      {renderCoverFlatTextInput("Карточка каталога", readString(data, "organizationsTitle", "Каталог организаций"), (value) => updateData({ organizationsTitle: value }))}
    </div>
  );
}
