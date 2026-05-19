import Link from "next/link";

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
          summary="Build your own LumenLab app without writing code — describe it, let an AI write it, test it in the browser."
        />
        <Tool
          href="/flash"
          name="Flash"
          summary="Pick hardware and apps, plug your Pico into USB, and install everything from the browser."
        />
      </div>
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
      className="block rounded-lg border border-edge bg-panel p-5 no-underline hover:border-accent/40 transition-colors"
    >
      <div className="text-[14px] font-semibold tracking-[0.04em] text-white">
        Lumen<span className="text-accent">{name}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-muted leading-relaxed">
        {summary}
      </p>
    </Link>
  );
}
