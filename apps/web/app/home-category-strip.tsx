"use client";

import { useEffect, useRef, useState } from "react";

type HomeCategoryStripProps = {
  categories: Array<{ key: string; label: string; imageUrl?: string | null }>;
};

type ChevronProps = {
  size: string;
};

const ChevronRight = ({ size }: ChevronProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path
      fill="none"
      stroke="#000000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="m8.417 20l6.587-6.587a2.013 2.013 0 0 0 0-2.826L8.417 4"
    />
  </svg>
);

const ChevronLeft = ({ size }: ChevronProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path
      fill="none"
      stroke="#000000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="m15.583 4l-6.587 6.587a2.013 2.013 0 0 0 0 2.826L15.583 20"
    />
  </svg>
);

export default function HomeCategoryStrip({ categories }: HomeCategoryStripProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 4);
  };

  const handleScrollRight = () => {
    scrollerRef.current?.scrollBy({ left: 360, behavior: "smooth" });
  };

  const handleScrollLeft = () => {
    scrollerRef.current?.scrollBy({ left: -360, behavior: "smooth" });
  };

  useEffect(() => {
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [categories.length]);

  return (
    <div className="relative">
      <div className="relative rounded-[24px]">
        <div
          ref={scrollerRef}
        className="bp-scrollbar-hidden grid grid-rows-2 grid-flow-col auto-cols-[46vw] gap-4 overflow-x-auto sm:auto-cols-[190px]"
          style={{ scrollSnapType: "x proximity" }}
          onScroll={updateScrollState}
        >
        {categories.map((item) => (
          <div
            key={item.key}
            className="flex min-h-[120px] flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[color:var(--bp-stroke)] bg-white text-center text-xs font-semibold"
            style={{ scrollSnapAlign: "start" }}
          >
            {item.imageUrl ? (
              <div className="relative h-full w-full text-white">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%), url(${item.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <span className="relative z-10 flex h-full w-full items-center justify-center px-4 text-center text-sm font-semibold leading-snug">
                  {item.label}
                </span>
              </div>
            ) : (
              <span className="px-3">{item.label}</span>
            )}
          </div>
        ))}
      </div>
        {canScrollLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-2 hidden items-center sm:flex">
          <button
            type="button"
            onClick={handleScrollLeft}
            className="pointer-events-auto rounded-full border border-white/60 bg-white/70 p-3 shadow-[var(--bp-shadow)] backdrop-blur-md"
            aria-label="Прокрутить влево"
          >
            <ChevronLeft size="24" />
          </button>
          </div>
        ) : null}
        {canScrollRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-2 hidden items-center sm:flex">
          <button
            type="button"
            onClick={handleScrollRight}
            className="pointer-events-auto rounded-full border border-white/60 bg-white/70 p-3 shadow-[var(--bp-shadow)] backdrop-blur-md"
            aria-label="Прокрутить вправо"
          >
            <ChevronRight size="24" />
          </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
