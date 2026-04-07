"use client";

import type { CSSProperties, ReactNode } from "react";

type DetailsCloseButtonProps = {
  className?: string;
  style?: CSSProperties;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export default function DetailsCloseButton({
  className,
  style,
  title,
  ariaLabel,
  children,
}: DetailsCloseButtonProps) {
  return (
    <button
      type="button"
      className={className}
      style={style}
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
