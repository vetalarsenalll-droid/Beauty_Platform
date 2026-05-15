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
  detailHref: string;
  bookingHref: string;
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
const ZOOM_ANIMATION_MS = 220;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
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
  const animationRef = useRef<number | null>(null);
  const [size, setSize] = useState<Size>({ width: 900, height: 560 });
  const initialView = useMemo(() => fitView(points, { width: 900, height: 560 }), [points]);
  const [zoom, setZoom] = useState(initialView.zoom);
  const [center, setCenter] = useState(initialView.center);
  const zoomRef = useRef(initialView.zoom);
  const centerRef = useRef(initialView.center);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PublicMapPoint | null>(null);

  const applyView = (nextCenter: { lat: number; lng: number }, nextZoom: number) => {
    centerRef.current = nextCenter;
    zoomRef.current = nextZoom;
    setCenter(nextCenter);
    setZoom(nextZoom);
  };

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

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const centerWorld = useMemo(() => pointToWorld(center, zoom), [center, zoom]);
  const topLeft = {
    x: centerWorld.x - size.width / 2,
    y: centerWorld.y - size.height / 2,
  };
  const tileZoom = Math.min(Math.floor(zoom), MAX_ZOOM);
  const buildTiles = (layerZoom: number) => {
    const layerScale = 2 ** (zoom - layerZoom);
    const layerTileSize = TILE_SIZE * layerScale;
    const layerMinX = Math.floor(topLeft.x / layerTileSize) - 1;
    const layerMaxX = Math.floor((topLeft.x + size.width) / layerTileSize) + 1;
    const layerMinY = Math.floor(topLeft.y / layerTileSize) - 1;
    const layerMaxY = Math.floor((topLeft.y + size.height) / layerTileSize) + 1;
    const tileCount = 2 ** layerZoom;
    const layerTiles = [];

    for (let x = layerMinX; x <= layerMaxX; x += 1) {
      for (let y = layerMinY; y <= layerMaxY; y += 1) {
        if (y < 0 || y >= tileCount) continue;
        const wrappedX = ((x % tileCount) + tileCount) % tileCount;
        layerTiles.push({
          key: `${layerZoom}-${x}-${y}`,
          url: `https://tile.openstreetmap.org/${layerZoom}/${wrappedX}/${y}.png`,
          left: x * layerTileSize - topLeft.x,
          top: y * layerTileSize - topLeft.y,
          size: layerTileSize,
        });
      }
    }

    return layerTiles;
  };
  const fallbackTiles = tileZoom > MIN_ZOOM ? buildTiles(tileZoom - 1) : [];
  const tiles = buildTiles(tileZoom);

  const markers = points.map((point) => {
    const world = pointToWorld(point, zoom);
    return {
      ...point,
      left: world.x - topLeft.x,
      top: world.y - topLeft.y,
    };
  });

  const getZoomedView = (
    clientX: number,
    clientY: number,
    nextZoom: number,
    currentCenter = centerRef.current,
    currentZoom = zoomRef.current
  ) => {
    const root = rootRef.current;
    if (!root) return null;

    const rect = root.getBoundingClientRect();
    const cursor = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const currentCenterWorld = pointToWorld(currentCenter, currentZoom);
    const currentTopLeft = {
      x: currentCenterWorld.x - size.width / 2,
      y: currentCenterWorld.y - size.height / 2,
    };
    const currentWorldUnderCursor = {
      x: currentTopLeft.x + cursor.x,
      y: currentTopLeft.y + cursor.y,
    };
    const mapPointUnderCursor = worldToPoint(currentWorldUnderCursor, currentZoom);
    const nextWorldUnderCursor = pointToWorld(mapPointUnderCursor, nextZoom);
    const nextCenterWorld = {
      x: nextWorldUnderCursor.x - cursor.x + size.width / 2,
      y: nextWorldUnderCursor.y - cursor.y + size.height / 2,
    };

    return {
      center: worldToPoint(nextCenterWorld, nextZoom),
      zoom: nextZoom,
    };
  };

  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const nextView = getZoomedView(clientX, clientY, nextZoom);
    if (!nextView || nextView.zoom === zoomRef.current) return;
    applyView(nextView.center, nextView.zoom);
  };

  const animateZoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
    }

    const fromZoom = zoomRef.current;
    const fromCenter = centerRef.current;
    const toView = getZoomedView(clientX, clientY, nextZoom, fromCenter, fromZoom);
    if (!toView || toView.zoom === fromZoom) return;

    const startedAt = performance.now();
    const step = (time: number) => {
      const progress = clamp((time - startedAt) / ZOOM_ANIMATION_MS, 0, 1);
      const eased = easeOutCubic(progress);
      const currentZoom = fromZoom + (toView.zoom - fromZoom) * eased;
      const currentCenter = {
        lat: fromCenter.lat + (toView.center.lat - fromCenter.lat) * eased,
        lng: fromCenter.lng + (toView.center.lng - fromCenter.lng) * eased,
      };

      applyView(currentCenter, currentZoom);

      if (progress < 1) {
        animationRef.current = window.requestAnimationFrame(step);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = window.requestAnimationFrame(step);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = clamp(zoomRef.current - event.deltaY * 0.003, MIN_ZOOM, MAX_ZOOM);
    zoomAt(event.clientX, event.clientY, nextZoom);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("a,button")) return;

    const root = rootRef.current;
    if (!root) return;
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    root.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterWorld: pointToWorld(centerRef.current, zoomRef.current),
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    applyView(
      worldToPoint(
        {
          x: drag.startCenterWorld.x - dx,
          y: drag.startCenterWorld.y - dy,
        },
        zoomRef.current
      ),
      zoomRef.current
    );
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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
        {fallbackTiles.map((tile) => (
          <img
            key={`fallback-${tile.key}`}
            alt=""
            src={tile.url}
            className="absolute select-none"
            draggable={false}
            referrerPolicy="no-referrer"
            style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }}
          />
        ))}

        {tiles.map((tile) => (
          <img
            key={tile.key}
            alt=""
            src={tile.url}
            className="absolute select-none"
            draggable={false}
            referrerPolicy="no-referrer"
            style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }}
          />
        ))}

        <div className="absolute left-4 top-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur">
          <button
            type="button"
            className="h-10 w-10 text-lg font-semibold hover:bg-black/5"
            onClick={(event) => {
              const rect = rootRef.current?.getBoundingClientRect();
              const clientX = rect ? rect.left + rect.width / 2 : event.clientX;
              const clientY = rect ? rect.top + rect.height / 2 : event.clientY;
              animateZoomAt(clientX, clientY, clamp(zoomRef.current + 1, MIN_ZOOM, MAX_ZOOM));
            }}
            aria-label="Приблизить карту"
          >
            +
          </button>
          <button
            type="button"
            className="h-10 w-10 border-t border-[color:var(--bp-stroke)] text-lg font-semibold hover:bg-black/5"
            onClick={(event) => {
              const rect = rootRef.current?.getBoundingClientRect();
              const clientX = rect ? rect.left + rect.width / 2 : event.clientX;
              const clientY = rect ? rect.top + rect.height / 2 : event.clientY;
              animateZoomAt(clientX, clientY, clamp(zoomRef.current - 1, MIN_ZOOM, MAX_ZOOM));
            }}
            aria-label="Отдалить карту"
          >
            -
          </button>
        </div>

        {markers.map((point) => (
          <button
            key={point.id}
            type="button"
            className="group absolute z-10 flex h-11 w-9 items-start justify-center"
            aria-label={`${point.accountName}: ${point.address}`}
            onClick={() => setSelectedPoint(point)}
            style={{
              left: point.left,
              top: point.top,
              transform: "translate(-50%, -100%)",
            }}
          >
            <span
              className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bp-accent)] shadow-[0_10px_22px_rgba(255,90,95,0.28)] transition group-hover:-translate-y-0.5 ${
                selectedPoint?.id === point.id ? "ring-4 ring-[color:var(--bp-accent)]/25" : ""
              }`}
            >
              <span className="absolute bottom-[-5px] h-4 w-4 rotate-45 rounded-[3px] bg-[color:var(--bp-accent)]" />
              <span className="relative z-10 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white text-[9px] font-bold text-[color:var(--bp-accent)] ring-1 ring-white/80">
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
            <span className="pointer-events-none absolute left-1/2 top-[-10px] hidden w-64 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/90 bg-white/95 px-3 py-2 text-left shadow-[0_12px_28px_rgba(15,23,42,0.16)] group-hover:block">
              <span className="block text-xs font-semibold text-[color:var(--bp-ink)]">
                {point.locationName}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-[color:var(--bp-muted)]">
                {point.address}
              </span>
            </span>
          </button>
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

      {selectedPoint ? (
        <aside className="flex rounded-[24px] border border-[color:var(--bp-stroke)] bg-white p-5">
          <div className="flex h-full w-full flex-col">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--bp-accent)]/10 text-sm font-bold text-[color:var(--bp-accent)]">
                {selectedPoint.logoUrl ? (
                  <img
                    src={selectedPoint.logoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  initials(selectedPoint.accountName)
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{selectedPoint.accountName}</div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  {selectedPoint.locationName}
                </div>
              </div>
            </div>

            <div className="mt-5 text-sm font-semibold">Адрес</div>
            <div className="mt-2 text-sm leading-5 text-[color:var(--bp-muted)]">
              {selectedPoint.address}
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-6">
              <a
                href={selectedPoint.href}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Сайт
              </a>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={selectedPoint.detailHref}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--bp-ink)]"
                >
                  Подробнее
                </a>
                <a
                  href={selectedPoint.bookingHref}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--bp-accent)] bg-[color:var(--bp-accent)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--bp-accent)]"
                >
                  Записаться
                </a>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
