type BackgroundMode = "solid" | "linear" | "radial";

const resolveBackgroundVisual = (
  data: Record<string, unknown> | null,
  fallbackColor: string,
  keys: {
    mode: string;
    from: string;
    to: string;
    angle: string;
    stopA: string;
    stopB: string;
  }
) => {
  const modeRaw = typeof data?.[keys.mode] === "string" ? data[keys.mode] : "";
  const mode: BackgroundMode =
    modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
  const fromRaw =
    typeof data?.[keys.from] === "string" ? String(data[keys.from]).trim() : "";
  const toRaw =
    typeof data?.[keys.to] === "string" ? String(data[keys.to]).trim() : "";
  const angleRaw = Number(data?.[keys.angle]);
  const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 135;
  const stopARaw = Number(data?.[keys.stopA]);
  const stopA = Number.isFinite(stopARaw) ? Math.max(0, Math.min(100, stopARaw)) : 0;
  const stopBRaw = Number(data?.[keys.stopB]);
  const stopB = Number.isFinite(stopBRaw) ? Math.max(0, Math.min(100, stopBRaw)) : 100;
  const from = fromRaw || fallbackColor || "#ffffff";
  const to = toRaw || from;

  if (mode === "linear") {
    return {
      backgroundColor: from,
      backgroundImage: `linear-gradient(${Math.round(angle)}deg, ${from}, ${to})`,
    };
  }
  if (mode === "radial") {
    const innerStop = Math.min(stopA, stopB);
    const outerStop = Math.max(stopA, stopB);
    const innerColor = stopA <= stopB ? from : to;
    const outerColor = stopA <= stopB ? to : from;
    return {
      backgroundColor: from,
      backgroundImage: `radial-gradient(circle at center, ${innerColor} 0%, ${innerColor} ${Math.round(
        innerStop
      )}%, ${outerColor} ${Math.round(outerStop)}%, ${outerColor} 100%)`,
    };
  }
  return { backgroundColor: from, backgroundImage: "none" };
};

export function resolveCoverBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  return resolveBackgroundVisual(data, fallbackColor, {
    mode: "coverBackgroundMode",
    from: "coverBackgroundFrom",
    to: "coverBackgroundTo",
    angle: "coverBackgroundAngle",
    stopA: "coverBackgroundStopA",
    stopB: "coverBackgroundStopB",
  });
}

export function resolveMenuBlockBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  return resolveBackgroundVisual(data, fallbackColor, {
    mode: "menuBlockBackgroundMode",
    from: "menuBlockBackgroundFrom",
    to: "menuBlockBackgroundTo",
    angle: "menuBlockBackgroundAngle",
    stopA: "menuBlockBackgroundStopA",
    stopB: "menuBlockBackgroundStopB",
  });
}

export function resolveMenuSectionBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  return resolveBackgroundVisual(data, fallbackColor, {
    mode: "menuSectionBackgroundMode",
    from: "menuSectionBackgroundFrom",
    to: "menuSectionBackgroundTo",
    angle: "menuSectionBackgroundAngle",
    stopA: "menuSectionBackgroundStopA",
    stopB: "menuSectionBackgroundStopB",
  });
}
