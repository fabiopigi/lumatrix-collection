export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        LUMA<span className="text-accent">TRIX</span>{" "}
        <span className="text-muted font-normal">Toolkit</span>
      </h1>
      <p className="mt-3 text-[13px] text-muted leading-relaxed max-w-prose">
        Skeleton page. Use the burger menu to navigate.
      </p>

      <div className="mt-10 rounded-lg border border-edge bg-panel p-8 text-center">
        <p className="font-mono text-[12px] text-muted">content area</p>
      </div>
    </div>
  );
}
