"use client";

import { useEffect } from "react";

interface ModalShellProps {
  onClose: () => void;
  width?: number;
  className?: string;
  children: React.ReactNode;
}

export function ModalShell({
  onClose,
  width,
  className,
  children,
}: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-panel border border-[#2a2a30] rounded-lg p-4 max-w-[90vw] ${className ?? ""}`}
        style={width ? { width } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
