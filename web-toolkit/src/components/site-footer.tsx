export function SiteFooter() {
  return (
    <footer className="border-t border-edge bg-panel">
      <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-muted tracking-[0.04em]">
        <span className="flex items-baseline gap-2">
          <span className="font-bitcount text-[30px] font-light tracking-[0.02em] leading-none text-foreground/80">
            Lumen<span className="text-accent">Lab</span>
          </span>
          <span className="text-muted/80">by Fabio Pigagnelli</span>
        </span>
        <span className="font-mono text-[11px]">
          Pixel-art tools for LED matrices
        </span>
      </div>
    </footer>
  );
}
