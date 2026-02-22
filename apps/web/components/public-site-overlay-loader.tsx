"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SiteLoader from "@/components/site-loader";
import type { SiteLoaderConfig } from "@/lib/site-builder";

type PublicSiteOverlayLoaderProps = {
  loaderConfig?: SiteLoaderConfig | null;
  children: ReactNode;
};

export default function PublicSiteOverlayLoader({
  loaderConfig,
  children,
}: PublicSiteOverlayLoaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  const enabledConfig = useMemo(() => {
    if (!loaderConfig) return null;
    if (!loaderConfig.showPageOverlay) return null;
    return loaderConfig;
  }, [loaderConfig]);

  useEffect(() => {
    if (!visible) return;
    const shownAt = shownAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const minVisibleMs =
      enabledConfig?.fixedDurationEnabled && Number.isFinite(enabledConfig.fixedDurationSec)
        ? Math.max(1, Math.round(enabledConfig.fixedDurationSec)) * 1000
        : 480;
    const hideDelay = Math.max(0, minVisibleMs - elapsed);
    const timer = window.setTimeout(() => {
      setVisible(false);
      shownAtRef.current = null;
    }, hideDelay);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, visible, enabledConfig]);

  useEffect(() => {
    if (!enabledConfig) {
      setVisible(false);
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr.toLowerCase() !== "_self") return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      const current = window.location;
      const isSameDestination =
        url.pathname === current.pathname &&
        url.search === current.search &&
        url.hash === current.hash;
      if (isSameDestination) return;

      const fixedDurationMs =
        enabledConfig.fixedDurationEnabled && Number.isFinite(enabledConfig.fixedDurationSec)
          ? Math.max(1, Math.round(enabledConfig.fixedDurationSec)) * 1000
          : 0;
      const currentRootSegment = current.pathname.split("/").filter(Boolean)[0] ?? "";
      const scopePrefix = currentRootSegment ? `/${currentRootSegment}` : "/";
      const leavesPublicScope =
        url.pathname !== scopePrefix && !url.pathname.startsWith(`${scopePrefix}/`);

      event.preventDefault();
      shownAtRef.current = Date.now();
      setVisible(true);

      const delayMs = fixedDurationMs > 0 ? fixedDurationMs : 80;
      const href = `${url.pathname}${url.search}${url.hash}`;

      window.setTimeout(() => {
        if (leavesPublicScope) {
          window.location.assign(url.toString());
          return;
        }
        router.push(href);
      }, delayMs);
    };

    const handleSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.getAttribute("action");
      if (!action || action.startsWith("http")) return;
      shownAtRef.current = Date.now();
      setVisible(true);
    };

    const handleBeforeUnload = () => {
      shownAtRef.current = Date.now();
      setVisible(true);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabledConfig, router]);

  return (
    <>
      {children}
      {visible && enabledConfig ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center"
          style={
            enabledConfig.backdropEnabled
              ? { backgroundColor: enabledConfig.backdropColor }
              : { backgroundColor: "transparent" }
          }
        >
          <SiteLoader config={enabledConfig} />
          <span className="sr-only">Загрузка</span>
        </div>
      ) : null}
    </>
  );
}
