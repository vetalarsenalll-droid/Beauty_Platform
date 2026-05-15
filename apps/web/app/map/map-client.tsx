"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";

export type PublicMapPoint = {
  id: string;
  accountName: string;
  locationName: string;
  address: string;
  logoUrl: string | null;
  href: string;
  bookingHref: string;
  servicesCount: number;
  lat: number;
  lng: number;
};

type MapClientProps = {
  points: PublicMapPoint[];
};

type Size = {
  width: number;
  height: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startCenterWorld: { x: number; y: number };
};

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lonToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    2 ** zoom
  );
}

function tileXToLon(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function pointToWorld(point: { lat: number; lng: number }, zoom: number) {
  return {
    x: lonToTileX(point.lng, zoom) * TILE_SIZE,
    y: latToTileY(point.lat, zoom) * TILE_SIZE,
  };
}

function worldToPoint(world: { x: number; y: number }, zoom: number) {
  return {
    lat: tileYToLat(world.y / TILE_SIZE, zoom),
    lng: tileXToLon(world.x / TILE_SIZE, zoom),
  };
}

function fitView(points: PublicMapPoint[], size: Size) {
  if (!points.length) return { center: { lat: 55.751244, lng: 37.618423 }, zoom: 11 };
  if (points.length === 1) {
    return { center: { lat: points[0].lat, lng: points[0].lng }, zoom: 14 };
  }

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const projected = points.map((point) => pointToWorld(point, zoom));
    const minX = Math.min(...projected.map((point) => point.x));
    const maxX = Math.max(...projected.map((point) => point.x));
    const minY = Math.min(...projected.map((point) => point.y));
    const maxY = Math.max(...projected.map((point) => point.y));
    if (maxX - minX <= size.width - 160 && maxY - minY <= size.height - 140) {
      return {
        center: worldToPoint({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, zoom),
        zoom,
      };
    }
  }

  const avgLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const avgLng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return { center: { lat: avgLat, lng: avgLng }, zoom: MIN_ZOOM };
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function MapClient({ points }: MapClientProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState<Size>({ width: 900, height: 560 });
  const initialView = useMemo(() => fitView(points, { width: 900, height: 560 }), [points]);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [center, setCenter] = useState(initialView.center);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const centerWorld = useMemo(() => pointToWorld(center, zoom), [center, zoom]);
  const topLeft = {
    x: centerWorld.x - size.width / 2,
    y: centerWorld.y - size.height / 2,
  };
  const tileMinX = Math.floor(topLeft.x / TILE_SIZE);
  const tileMaxX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
  const tileMinY = Math.floor(topLeft.y / TILE_SIZE);
  const tileMaxY = Math.floor((topLeft.y + size.height) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles = [];

  for (let x = tileMinX; x <= tileMaxX; x += 1) {
    for (let y = tileMinY; y <= tileMaxY; y += 1) {
      if (y < 0 || y >= tileCount) continue;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - topLeft.x,
        top: y * TILE_SIZE - topLeft.y,
      });
    }
  }

  const markers = points.map((point) => {
    const world = pointToWorld(point, zoom);
    return {
      ...point,
      left: world.x - topLeft.x,
      top: world.y - topLeft.y,
    };
  });

  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    const root = rootRef.current;
    if (!root || nextZoom === zoom) return;

    const rect = root.getBoundingClientRect();
    const cursor = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const currentWorldUnderCursor = {
      x: topLeft.x + cursor.x,
      y: topLeft.y + cursor.y,
    };
    const mapPointUnderCursor = worldToPoint(currentWorldUnderCursor, zoom);
    const nextWorldUnderCursor = pointToWorld(mapPointUnderCursor, nextZoom);
    const nextCenterWorld = {
      x: nextWorldUnderCursor.x - cursor.x + size.width / 2,
      y: nextWorldUnderCursor.y - cursor.y + size.height / 2,
    };

    setZoom(nextZoom);
    setCenter(worldToPoint(nextCenterWorld, nextZoom));
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    zoomAt(event.clientX, event.clientY, clamp(zoom + direction, MIN_ZOOM, MAX_ZOOM));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("a,button")) return;

    const root = rootRef.current;
    if (!root) return;
    root.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterWorld: pointToWorld(center, zoom),
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setCenter(
      worldToPoint(
        {
          x: drag.startCenterWorld.x - dx,
          y: drag.startCenterWorld.y - dy,
        },
        zoom
      )
    );
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <div
      ref={rootRef}
      className={`relative min-h-[560px] touch-none overflow-hidden rounded-[28px] border border-[color:var(--bp-stroke)] bg-[#dbe7ee] ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          alt=""
          src={tile.url}
          className="absolute h-64 w-64 select-none"
          draggable={false}
          referrerPolicy="no-referrer"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      <div className="absolute left-4 top-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur">
        <button
          type="button"
          className="h-10 w-10 text-lg font-semibold hover:bg-black/5"
          onClick={() => setZoom((value) => clamp(value + 1, MIN_ZOOM, MAX_ZOOM))}
          aria-label="Приблизить карту"
        >
          +
        </button>
        <button
          type="button"
          className="h-10 w-10 border-t border-[color:var(--bp-stroke)] text-lg font-semibold hover:bg-black/5"
          onClick={() => setZoom((value) => clamp(value - 1, MIN_ZOOM, MAX_ZOOM))}
          aria-label="Отдалить карту"
        >
          -
        </button>
      </div>

      {markers.map((point) => (
        <a
          key={point.id}
          href={point.href}
          className="group absolute z-10 flex h-14 w-11 items-start justify-center"
          aria-label={`${point.accountName}: ${point.address}`}
          style={{
            left: point.left,
            top: point.top,
            transform: "translate(-50%, -100%)",
          }}
        >
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--bp-accent)] shadow-[0_12px_28px_rgba(255,90,95,0.32)] transition group-hover:-translate-y-0.5">
            <span className="absolute bottom-[-6px] h-5 w-5 rotate-45 rounded-[4px] bg-[color:var(--bp-accent)]" />
            <span className="relative z-10 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white text-[10px] font-bold text-[color:var(--bp-accent)] ring-1 ring-white/80">
              {point.logoUrl ? (
                <img
                  src={point.logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                initials(point.accountName)
              )}
            </span>
          </span>
        </a>
      ))}

      {!points.length ? (
        <div className="relative z-10 flex min-h-[560px] items-center justify-center px-6 text-center text-sm text-[color:var(--bp-muted)]">
          Пока нет активных аккаунтов с локациями.
        </div>
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-3 z-20 text-[10px] text-[color:var(--bp-muted)]"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
