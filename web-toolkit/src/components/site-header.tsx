"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRegisterHeaderActionsSlot } from "@/components/header-actions-slot";

const NAV_LINKS = [
  { href: "/", label: "LumenLab" },
  { href: "/create", label: "LumenCreate" },
  { href: "/pixel-designer", label: "LumenDesigner" },
  { href: "/simulator", label: "LumenSimulator" },
  { href: "/flash", label: "LumenFlash" },
];

function titleSuffixForPath(pathname: string | null): string {
  if (!pathname) return "Lab";
  if (pathname.startsWith("/create")) return "Create";
  if (pathname.startsWith("/pixel-designer")) return "Designer";
  if (pathname.startsWith("/simulator")) return "Simulator";
  if (pathname.startsWith("/flash")) return "Flash";
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
        <div className="relative flex items-baseline gap-2">
          <Link href="/" className="no-underline">
            <span className="font-bitcount text-[30px] font-light tracking-[0.02em] text-white leading-none">
              Lumen<span className="text-accent">{suffix}</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((v) => !v)}
            className="font-bitcount text-[30px] font-light leading-none text-muted hover:text-accent transition-transform duration-150 cursor-pointer origin-center"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            »
          </button>

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
            className={`absolute left-0 top-full mt-1 z-20 w-64 origin-top-left border border-edge bg-panel shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition duration-150 ${
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
        </div>

        <div className="flex-1" />

        <div
          ref={registerSlot}
          className="flex items-center gap-1.5 min-w-0"
        />

        <div className="flex-1" />
      </div>
    </header>
  );
}
