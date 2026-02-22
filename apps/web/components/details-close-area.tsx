"use client";

import type { ReactNode } from "react";

type DetailsCloseAreaProps = {
  children: ReactNode;
  selectors?: string;
};

export default function DetailsCloseArea({
  children,
  selectors = "a,button,input,[role='button']",
}: DetailsCloseAreaProps) {
  return (
    <div
      onClickCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest(selectors)) return;
        const details = target.closest("details");
        if (details instanceof HTMLDetailsElement) {
          details.open = false;
        }
      }}
    >
      {children}
    </div>
  );
}
