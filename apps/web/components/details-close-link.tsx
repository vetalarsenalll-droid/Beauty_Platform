"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

type DetailsCloseLinkProps = {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function DetailsCloseLink({
  href,
  className,
  style,
  children,
}: DetailsCloseLinkProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        const details = event.currentTarget.closest("details");
        const target = new URL(href, window.location.origin);
        const current = new URL(window.location.href);
        const targetPath = target.pathname.replace(/\/+$/, "") || "/";
        const currentPath = (pathname || current.pathname).replace(/\/+$/, "") || "/";
        if (target.origin !== current.origin) {
          if (details instanceof HTMLDetailsElement) {
            window.setTimeout(() => {
              details.open = false;
            }, 0);
          }
          return;
        }
        event.preventDefault();
        if (targetPath === currentPath && target.search === current.search && target.hash === current.hash) {
          if (details instanceof HTMLDetailsElement) {
            details.open = false;
          }
          return;
        }
        router.push(`${target.pathname}${target.search}${target.hash}`);
        if (details instanceof HTMLDetailsElement) {
          window.setTimeout(() => {
            details.open = false;
          }, 0);
        }
      }}
    >
      {children}
    </Link>
  );
}
