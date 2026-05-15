"use client";

import { useEffect, useRef, useState } from "react";

export type LocationGeo = {
  lat: number;
  lng: number;
};

type GeocodeItem = LocationGeo & {
  label: string;
  address: string;
};

type LocationAddressFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onGeoChange: (geo: LocationGeo | null) => void;
};

type GeocodeResponse = {
  data?: {
    items?: GeocodeItem[];
  };
};

export async function findAddressGeo(address: string): Promise<GeocodeItem | null> {
  const query = address.trim();
  if (query.length < 3) return null;

  const response = await fetch(`/api/v1/crm/geocode?q=${encodeURIComponent(query)}`);
  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as GeocodeResponse | null;
  return body?.data?.items?.[0] ?? null;
}

export default function LocationAddressField({
  value,
  onChange,
  onGeoChange,
}: LocationAddressFieldProps) {
  const requestIdRef = useRef(0);
  const userEditedRef = useRef(false);
  const [items, setItems] = useState<GeocodeItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = value.trim();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!userEditedRef.current || query.length < 3) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/v1/crm/geocode?q=${encodeURIComponent(query)}`).catch(
        () => null
      );
      if (requestIdRef.current !== requestId) return;

      if (!response?.ok) {
        setItems([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      const body = (await response.json().catch(() => null)) as GeocodeResponse | null;
      const nextItems = body?.data?.items ?? [];
      setItems(nextItems);
      setOpen(nextItems.length > 0);
      setLoading(false);

      if (nextItems.length === 1 && nextItems[0].address === query) {
        onGeoChange({ lat: nextItems[0].lat, lng: nextItems[0].lng });
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [value, onGeoChange]);

  const selectItem = (item: GeocodeItem) => {
    userEditedRef.current = false;
    onChange(item.address);
    onGeoChange({ lat: item.lat, lng: item.lng });
    setItems([]);
    setOpen(false);
  };

  const handleInputChange = (nextValue: string) => {
    userEditedRef.current = true;
    onChange(nextValue);
    onGeoChange(null);
    if (nextValue.trim().length < 3) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
  };

  return (
    <label className="relative flex flex-col gap-2 text-sm">
      Адрес
      <input
        value={value}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setOpen(userEditedRef.current && items.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        required
        autoComplete="street-address"
      />
      {loading ? <span className="text-xs text-[color:var(--bp-muted)]">Ищем адрес...</span> : null}
      {open ? (
        <div className="absolute left-0 right-0 top-[62px] z-20 max-h-64 overflow-auto rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-1 shadow-[var(--bp-shadow)]">
          {items.map((item) => (
            <button
              key={`${item.lat}-${item.lng}-${item.label}`}
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
