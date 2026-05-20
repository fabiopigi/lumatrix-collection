import Link from "next/link";

/** Abstract pixel-art marks per tool, drawn in the same 5×5 vocabulary as the
 *  Designer's stamp symbols so the home cards feel like artefacts of the
 *  tool kit itself. Each row uses "X" for lit, "." for off. */
const TOOL_GLYPHS: Record<string, string[]> = {
  // Play triangle — the run/launch affordance, pointing into the card.
  Simulator: [
    "X....",
    "XX...",
    "XXX..",
    "XX...",
    "X....",
  ],
  // A diagonal stroke — pencil moving across the canvas.
  Designer: [
    "....X",
    "...XX",
    "..XX.",
    ".XX..",
    "XX...",
  ],
  // Plus + diagonal — a sparkle / "something appearing".
  Create: [
    "..X..",
    "X.X.X",
    ".XXX.",
    "X.X.X",
    "..X..",
  ],
  // Zig-zag lightning — the install / current flow.
  Flash: [
    "..XX.",
    ".XX..",
    "XXXX.",
    "..XX.",
    ".XX..",
  ],
};

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Lumen<span className="text-accent">Lab</span>
      </h1>
      <p className="mt-3 text-[13px] text-muted leading-relaxed max-w-prose">
        Pixel-art tools for LED matrices. Design screens and animations,
        run them in a simulator, then flash them to your board.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Tool
          href="/simulator"
          name="Simulator"
          summary="Boot the launcher and run apps in your browser with a virtual joystick and slide switch."
        />
        <Tool
          href="/pixel-designer"
          name="Designer"
          summary="Paint pixels, draw shapes, stamp symbols and text, export to JSON or PNG."
        />
        <Tool
          href="/create"
          name="Create"
          summary="Build your own LumenLab app without writing code. Describe it, let an AI write it, test it in the browser."
        />
        <Tool
          href="/flash"
          name="Flash"
          summary="Pick hardware and apps, plug your Pico into USB, and install everything from the browser."
        />
      </div>

      <p className="mt-10 text-[12px] text-muted">
        <a
          href="https://github.com/fabiopigi/lumenlab"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-muted hover:text-accent transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          Source on GitHub
        </a>
      </p>
    </div>
  );
}

function Tool({
  href,
  name,
  summary,
}: {
  href: string;
  name: string;
  summary: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-edge bg-panel p-5 no-underline hover:border-accent/40 transition-colors group"
    >
      <ToolGlyph rows={TOOL_GLYPHS[name]} />
      <div className="mt-4 text-[14px] font-semibold tracking-[0.04em] text-white">
        Lumen<span className="text-accent">{name}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-muted leading-relaxed">
        {summary}
      </p>
    </Link>
  );
}

function ToolGlyph({ rows }: { rows: string[] }) {
  const w = rows[0].length;
  const h = rows.length;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === "X") {
        cells.push(
          <rect
            key={`${x},${y}`}
            x={x + 0.08}
            y={y + 0.08}
            width={0.84}
            height={0.84}
            rx={0.12}
          />,
        );
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-10 h-10 fill-accent/80 group-hover:fill-accent transition-colors"
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      {cells}
    </svg>
  );
}
