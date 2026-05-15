"use client";

import { useId, type CSSProperties } from "react";

type RatingBadgeProps = {
  ratingAvg?: number | null;
  ratingCount?: number | null;
  compact?: boolean;
  textColor?: string;
  starColor?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundRadius?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string | null;
};

function formatRating(value: number) {
  return value.toFixed(1).replace(".", ",");
}

export function RatingBadge({
  ratingAvg,
  ratingCount,
  compact = false,
  textColor = "#111827",
  starColor = "#ffb020",
  backgroundColor = "transparent",
  backgroundOpacity = 50,
  backgroundRadius = 0,
  fontSize,
  fontFamily,
  fontWeight,
}: RatingBadgeProps) {
  const clipId = `rating-star-${useId().replace(/:/g, "")}`;
  const count = Number(ratingCount ?? 0);
  const rating = Number(ratingAvg ?? 0);
  if (!Number.isFinite(rating) || !Number.isFinite(count)) return null;

  const rounded = Math.max(0, Math.min(5, rating));
  const fillPercent = `${Math.max(0, Math.min(100, (rounded / 5) * 100))}%`;
  const baseFontSize = fontSize ?? (compact ? 13 : 16);
  const resolvedFontSize = compact ? Math.min(baseFontSize, 13) : baseFontSize;
  const textStyle: CSSProperties = {
    color: textColor,
    backgroundColor:
      backgroundColor && backgroundColor !== "transparent"
        ? `color-mix(in srgb, ${backgroundColor} ${Math.max(0, Math.min(100, backgroundOpacity))}%, transparent)`
        : "transparent",
    borderRadius: `${Math.max(0, backgroundRadius)}px`,
    fontSize: `${resolvedFontSize}px`,
    fontFamily,
    fontWeight: fontWeight ?? undefined,
  };
  const starSize = Math.round(resolvedFontSize * 1.08);
  const reviewCount = Math.max(0, count);

  return (
    <div
      className="relative z-[1] inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 leading-none"
      style={textStyle}
      aria-label={`Рейтинг ${formatRating(rounded)} из 5, отзывов ${count}`}
    >
      <span
        className="relative inline-block shrink-0 leading-none"
        style={{ width: `${starSize}px`, height: `${starSize}px`, fontSize: `${starSize}px`, lineHeight: 1 }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width={starSize} height={starSize} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={fillPercent} height="24" />
            </clipPath>
          </defs>
          <path
            d="m12 2.7 2.77 5.62 6.2.9-4.49 4.37 1.06 6.17L12 16.85l-5.54 2.91 1.06-6.17-4.49-4.37 6.2-.9L12 2.7Z"
            fill={starColor}
            clipPath={`url(#${clipId})`}
          />
          <path
            d="m12 2.7 2.77 5.62 6.2.9-4.49 4.37 1.06 6.17L12 16.85l-5.54 2.91 1.06-6.17-4.49-4.37 6.2-.9L12 2.7Z"
            fill="none"
            stroke={textColor}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        {reviewCount > 0 ? formatRating(rounded) : "0,0"}| {reviewCount} Отзывов
      </span>
    </div>
  );
}
