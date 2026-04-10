import type { PanelTheme } from "./site-shell-theme";

type SiteRightPanelOverlaysProps = {
  rightPanel: "content" | "settings" | null;
  isRightPanelVisible: boolean;
  floatingPanelsTop: number;
  onRequestClosePanel: () => void;
  showPanelExitConfirm: boolean;
  onCancelExitConfirm: () => void;
  onClosePanelWithoutSave: () => void;
  pendingDeleteTitle: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  panelTheme: PanelTheme;
};

export function SiteRightPanelOverlays({
  rightPanel,
  isRightPanelVisible,
  floatingPanelsTop,
  onRequestClosePanel,
  showPanelExitConfirm,
  onCancelExitConfirm,
  onClosePanelWithoutSave,
  pendingDeleteTitle,
  onCancelDelete,
  onConfirmDelete,
  panelTheme,
}: SiteRightPanelOverlaysProps) {
  return (
    <>
      {rightPanel && (
        <button
          type="button"
          aria-label="Закрыть панель"
          className={`fixed inset-0 z-[219] cursor-default bg-transparent transition-opacity duration-[220ms] ease-out ${
            isRightPanelVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ top: floatingPanelsTop }}
          onClick={onRequestClosePanel}
        />
      )}

      {showPanelExitConfirm && rightPanel && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/30 p-4">
          <div
            className="w-full max-w-[520px] rounded-xl border p-6 shadow-2xl"
            style={{
              backgroundColor: panelTheme.panel,
              borderColor: panelTheme.border,
              color: panelTheme.text,
            }}
          >
            <h3 className="text-xl font-semibold">Панель не сохранена</h3>
            <p className="mt-3 text-sm" style={{ color: panelTheme.muted }}>
              В текущей панели есть изменения. Закрыть её сейчас без сохранения?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancelExitConfirm}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{
                  borderColor: panelTheme.border,
                  backgroundColor: panelTheme.panel,
                  color: panelTheme.text,
                }}
              >
                Назад
              </button>
              <button
                type="button"
                onClick={onClosePanelWithoutSave}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: panelTheme.saveClose }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteTitle && (
        <div className="fixed inset-0 z-[261] flex items-center justify-center bg-black/30 p-4">
          <div
            className="w-full max-w-[520px] rounded-xl border p-6 shadow-2xl"
            style={{
              backgroundColor: panelTheme.panel,
              borderColor: panelTheme.border,
              color: panelTheme.text,
            }}
          >
            <h3 className="text-xl font-semibold">{pendingDeleteTitle}</h3>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancelDelete}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{
                  borderColor: panelTheme.border,
                  backgroundColor: panelTheme.panel,
                  color: panelTheme.text,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "#dc2626" }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

