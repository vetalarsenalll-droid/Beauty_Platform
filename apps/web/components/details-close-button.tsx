"use client";

import type { ReactNode } from "react";

type DetailsCloseButtonProps = {
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export default function DetailsCloseButton({
  className,
  title,
  ariaLabel,
  children,
}: DetailsCloseButtonProps) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={(event) => {
        const details = event.currentTarget.closest("details");
        if (details instanceof HTMLDetailsElement) {
          details.open = false;
        }
      }}
    >
      {children}
    </button>
  );
}
