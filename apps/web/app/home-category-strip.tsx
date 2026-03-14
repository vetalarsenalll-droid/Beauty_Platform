"use client";

import { useEffect, useRef, useState } from "react";

type HomeCategoryStripProps = {
  categories: string[];
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
          className="bp-scrollbar-hidden grid grid-rows-2 grid-flow-col auto-cols-[160px] gap-4 overflow-x-auto"
          style={{ scrollSnapType: "x proximity" }}
          onScroll={updateScrollState}
        >
          {categories.map((item) => (
            <div
              key={item}
              className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[22px] border border-[color:var(--bp-stroke)] bg-white p-4 text-center text-xs font-semibold"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="h-12 w-12 rounded-full bg-[color:var(--bp-blue)]/15" />
              {item}
            </div>
          ))}
        </div>
        {canScrollLeft ? (
          <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
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
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
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
