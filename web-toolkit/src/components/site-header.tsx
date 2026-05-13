"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRegisterHeaderActionsSlot } from "@/components/header-actions-slot";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/pixel-designer", label: "LumenDesigner" },
  { href: "/simulator", label: "LumenSimulator" },
  { href: "/apps", label: "Apps" },
  { href: "/docs", label: "Docs" },
];

function titleSuffixForPath(pathname: string | null): string {
  if (!pathname) return "Lab";
  if (pathname.startsWith("/pixel-designer")) return "Designer";
  if (pathname.startsWith("/simulator")) return "Simulator";
  return "Lab";
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const suffix = titleSuffixForPath(pathname);
  const registerSlot = useRegisterHeaderActionsSlot();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative h-14 bg-panel border-b border-edge">
      <div className="h-full flex items-center px-4 gap-4">
        <Link href="/" className="flex items-baseline gap-2 no-underline">
          <span className="font-bitcount text-[30px] font-light tracking-[0.02em] text-white leading-none">
            Lumen<span className="text-accent">{suffix}</span>
          </span>
        </Link>

        <div className="flex-1" />

        <div
          ref={registerSlot}
          className="flex items-center gap-1.5 min-w-0"
        />

        <div className="flex-1" />

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
          className="relative w-9 h-9 grid place-items-center rounded border border-edge bg-panel-2 hover:border-accent/40 transition-colors cursor-pointer"
        >
          <span className="sr-only">Toggle navigation</span>
          <span
            aria-hidden
            className={`absolute left-1/2 top-1/2 block h-px w-4 -translate-x-1/2 bg-foreground transition-transform duration-150 ${
              open ? "rotate-45" : "-translate-y-[5px]"
            }`}
          />
          <span
            aria-hidden
            className={`absolute left-1/2 top-1/2 block h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-foreground transition-opacity duration-150 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            aria-hidden
            className={`absolute left-1/2 top-1/2 block h-px w-4 -translate-x-1/2 bg-foreground transition-transform duration-150 ${
              open ? "-rotate-45" : "translate-y-[4px]"
            }`}
          />
        </button>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-14 z-10 bg-black/40 cursor-default"
        />
      )}

      <nav
        id="site-nav"
        aria-hidden={!open}
        className={`absolute right-0 top-full z-20 w-64 origin-top-right border border-edge bg-panel shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition duration-150 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <ul className="flex flex-col py-2">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-[13px] tracking-[0.04em] text-muted hover:text-foreground hover:bg-panel-2 no-underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
