"use client";

import { useMemo, useState } from "react";
import type { DesignRecord } from "@/lib/pixel-designer/library";
import { ModalShell } from "./modal-shell";

interface OpenDesignModalProps {
  open: boolean;
  designs: DesignRecord[];
  currentId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function OpenDesignModal(props: OpenDesignModalProps) {
  if (!props.open) return null;
  return <OpenDesignModalInner {...props} />;
}

function OpenDesignModalInner({
  designs,
  currentId,
  onClose,
  onOpen,
  onDelete,
}: Omit<OpenDesignModalProps, "open">) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter((d) => d.name.toLowerCase().includes(q));
  }, [query, designs]);

  return (
    <ModalShell
      onClose={onClose}
      label="Open design"
      className="w-[520px] max-h-[80vh] flex flex-col"
    >
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-[15px] font-semibold text-foreground">Open</div>
          <div className="text-[11px] text-fg-faint mt-0.5">
            {designs.length} saved design{designs.length === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground cursor-pointer text-xl leading-none px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {designs.length > 0 && (
        <input
          type="text"
          aria-label="Filter designs by name"
          placeholder="Filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus mb-3 shrink-0"
        />
      )}

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {designs.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="text-[12px] text-fg-faint py-4 text-center">
            No designs match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((d) => (
              <DesignRow
                key={d.id}
                record={d}
                isCurrent={d.id === currentId}
                onOpen={() => {
                  onOpen(d.id);
                  onClose();
                }}
                onDelete={() => onDelete(d.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}

function DesignRow({
  record,
  isCurrent,
  onOpen,
  onDelete,
}: {
  record: DesignRecord;
  isCurrent: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const pageCount = record.data.pages.length;
  return (
    <li
      className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
        isCurrent
          ? "border-cta/40 bg-cta/[0.06]"
          : "border-line-mute hover:border-line-strong"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left cursor-pointer"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-foreground truncate">
            {record.name}
          </span>
          {isCurrent && (
            <span className="text-[10px] uppercase tracking-[0.1em] text-cta shrink-0">
              current
            </span>
          )}
        </div>
        <div className="text-[10px] text-fg-faint font-mono mt-0.5">
          {pageCount} page{pageCount === 1 ? "" : "s"} · updated{" "}
          {formatRelative(record.updatedAt)}
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Delete this design"
        aria-label={`Delete design "${record.name}"`}
        className="w-8 h-8 shrink-0 rounded text-sm leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-danger-soft hover:text-danger hover:border-danger-line"
      >
        ✕
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="text-[12px] text-fg-faint py-8 text-center leading-[1.5]">
      No saved designs yet. Use{" "}
      <span className="font-mono text-fg-2">Save as…</span> from the design
      menu to name your current work and start building a library.
    </div>
  );
}

/** Compact relative-time strings. We only care about granularity that matches
 *  the user's mental model ("a minute ago" vs "yesterday"), so this is much
 *  cheaper than pulling in a date-formatting library. */
function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
