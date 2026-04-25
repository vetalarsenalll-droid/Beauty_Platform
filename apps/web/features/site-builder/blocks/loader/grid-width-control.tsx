import { useEffect, useRef, useState } from "react";
import { CoverGridWidthControl } from "@/features/site-builder/crm/site-editor-panels";

type LoaderGridWidthControlProps = {
  start: number;
  end: number;
  onChange: (nextStart: number, nextEnd: number) => void;
};

export function LoaderGridWidthControl({ start, end, onChange }: LoaderGridWidthControlProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const span = Math.max(1, end - start + 1);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="p-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
        Ширина блока
      </div>
      <div className="relative">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => setOpen((prev) => !prev)}
          className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
          style={{ borderColor: "var(--bp-stroke)" }}
        >
          <span>{span} колонок</span>
          <span className="text-sm leading-none">{open ? "▴" : "▾"}</span>
        </button>
        {open ? (
          <div
            ref={popoverRef}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
            style={{ backgroundColor: "var(--bp-paper)", borderColor: "var(--bp-stroke)" }}
          >
            <CoverGridWidthControl start={start} end={end} onChange={onChange} compact />
          </div>
        ) : null}
      </div>
    </div>
  );
}
