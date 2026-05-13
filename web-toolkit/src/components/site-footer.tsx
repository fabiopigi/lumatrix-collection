export function SiteFooter() {
  return (
    <footer className="border-t border-edge bg-panel">
      <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-muted tracking-[0.04em]">
        <span>
          Lumen<span className="text-accent">Lab</span>
        </span>
        <span className="font-mono text-[11px]">
          Pixel-art tools for LED matrices
        </span>
      </div>
    </footer>
  );
}
