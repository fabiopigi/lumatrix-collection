"use client";

/**
 * Renders the LLM-prompt block on /create with Copy + Download buttons.
 *
 * The prompt text is sourced server-side from docs/llm-app-prompt.md and
 * passed in as a prop — this component is purely a clipboard / download
 * affordance plus a collapsed preview.
 */

import { useState } from "react";

interface Props {
  /** The portion of llm-app-prompt.md after the `--- LLM PROMPT BELOW ---`
   *  marker — i.e. what the user pastes into the LLM. */
  promptBody: string;
  /** The full source file, used for the download link. */
  fullSource: string;
}

export function PromptBlock({ promptBody, fullSource }: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("clipboard write failed:", err);
      setCopied(false);
    }
  };

  const downloadHref = `data:text/markdown;charset=utf-8,${encodeURIComponent(
    fullSource,
  )}`;

  return (
    <div className="rounded-lg border border-edge bg-panel overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-edge bg-panel-2">
        <div className="flex flex-col">
          <span className="text-[12px] font-semibold text-white">
            LumenLab app-builder prompt
          </span>
          <span className="text-[10px] text-muted/80">
            {formatBytes(promptBody.length)} · paste into any LLM chat
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={downloadHref}
            download="llm-app-prompt.md"
            className="text-[11px] px-3 py-1.5 rounded border border-edge bg-panel text-muted hover:text-foreground hover:border-accent cursor-pointer no-underline"
          >
            Download .md
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] px-3 py-1.5 rounded bg-accent text-black font-semibold cursor-pointer hover:bg-accent/90"
          >
            {copied ? "Copied!" : "Copy prompt"}
          </button>
        </div>
      </div>

      <div className="relative">
        <pre
          className={`px-4 py-3 text-[11px] font-mono leading-[1.55] text-muted/90 overflow-auto whitespace-pre-wrap break-words m-0 ${
            expanded ? "max-h-[60vh]" : "max-h-48"
          }`}
        >
          {promptBody}
        </pre>
        {!expanded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--color-panel))",
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="absolute left-1/2 -translate-x-1/2 bottom-2 text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full border border-edge bg-panel text-muted hover:text-accent hover:border-accent cursor-pointer"
        >
          {expanded ? "Collapse" : "Expand preview"}
        </button>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
