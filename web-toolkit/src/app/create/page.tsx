import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { PromptBlock } from "./_components/prompt-block";

export const metadata: Metadata = {
  title: "LumenCreate · LumenLab",
  description:
    "Build your own LumenLab app without writing code — design screens, hand the prompt to an LLM, test in the browser, then flash to your Pico.",
};

const PROMPT_PATH = path.join(
  process.cwd(),
  "..",
  "docs",
  "llm-app-prompt.md",
);
const PROMPT_DIVIDER = "--- LLM PROMPT BELOW ---";

async function loadPromptParts(): Promise<{
  promptBody: string;
  fullSource: string;
} | null> {
  try {
    const source = await readFile(PROMPT_PATH, "utf8");
    const idx = source.indexOf(PROMPT_DIVIDER);
    if (idx < 0) return { promptBody: source, fullSource: source };
    const after = source.slice(idx + PROMPT_DIVIDER.length).replace(/^\s+/, "");
    return { promptBody: after, fullSource: source };
  } catch (err) {
    console.error("Failed to read llm-app-prompt.md:", err);
    return null;
  }
}

export default async function CreatePage() {
  const parts = await loadPromptParts();
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Lumen<span className="text-accent">Create</span>
        </h1>
        <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-prose">
          Build your own LumenLab app without writing code. Describe what you
          want, let an AI write the code, try it in the browser, then flash it
          to your Pico — the whole loop runs on this site.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          How it works
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          <Step
            num={1}
            title="Sketch your screens (optional)"
            body={
              <>
                If your app has fixed visuals — a clock face, a game-over
                banner, animation frames — paint them in{" "}
                <Link href="/pixel-designer" className="text-accent">
                  LumenDesigner
                </Link>{" "}
                and export the JSON. Skip this step if the visuals are
                fully algorithmic (random pixels, sliding bars, etc.).
              </>
            }
          />
          <Step
            num={2}
            title="Describe what the app should do"
            body={
              <>
                One paragraph in plain English. What does the user see? What
                happens when they press up/down/left/right or center? Is it
                a game with a score, or a passive animation? Examples:
                <ul className="mt-2 list-disc pl-5 space-y-1 text-[12px] text-muted/90">
                  <li>
                    <em>
                      &ldquo;A game where a dot falls from the top and the
                      player catches it with a 3-pixel paddle. +1 per catch,
                      lose after 3 misses.&rdquo;
                    </em>
                  </li>
                  <li>
                    <em>
                      &ldquo;Cycle through these four pages every 2 seconds.
                      Left/right skips to the previous/next page.&rdquo;
                    </em>
                  </li>
                </ul>
              </>
            }
          />
          <Step
            num={3}
            title="Open a fresh AI chat and paste the prompt"
            body={
              <>
                Use any LLM — ChatGPT, Claude, Gemini, your favourite. Open a
                new conversation and paste the LumenLab app-builder prompt
                below as your first message. Then attach the JSON from step 1
                (if you made one) and your description from step 2.
              </>
            }
          />
          <Step
            num={4}
            title="Iterate in the simulator"
            body={
              <>
                The AI walks you through a paced conversation. It may ask a
                couple of clarifying questions first, then it emits two
                files: a JavaScript app to try in{" "}
                <Link href="/simulator" className="text-accent">
                  LumenSimulator
                </Link>{" "}
                and a Python app to flash via{" "}
                <Link href="/flash" className="text-accent">
                  LumenFlash
                </Link>
                . Reply with <code className="font-mono text-foreground">works</code>,{" "}
                <code className="font-mono text-foreground">change X</code>, or{" "}
                <code className="font-mono text-foreground">add Y</code> until
                you&apos;re happy.
              </>
            }
          />
          <Step
            num={5}
            title="Graduate to a real LumenLab app"
            body={
              <>
                When you say it&apos;s ready, the AI hands you all five files
                in one go: the JS, the Python, a TypeScript twin, the docs,
                and an integration guide. It also offers to package them as a{" "}
                <code className="font-mono text-foreground">&lt;name&gt;.zip</code>{" "}
                you can email to a LumenLab maintainer — your app then ships
                in the next release for everyone to use.
              </>
            }
          />
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          The prompt
        </h2>
        <p className="mt-2 text-[12px] text-muted leading-relaxed max-w-prose">
          This is the instruction set the AI follows. Copy it, paste it as the
          first message in your AI chat, then send your description on the
          next message. You don&apos;t need to read it — it&apos;s for the AI.
        </p>
        <div className="mt-4">
          {parts ? (
            <PromptBlock
              promptBody={parts.promptBody}
              fullSource={parts.fullSource}
            />
          ) : (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-200/90">
              Couldn&apos;t load the prompt. Reload the page or grab it from{" "}
              <a
                href="https://github.com/fabiopigi/LumaMatrix/blob/main/docs/llm-app-prompt.md"
                className="text-red-200 underline"
              >
                GitHub
              </a>
              .
            </div>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          What you&apos;ll need
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <Need
            label="An AI chat"
            body="ChatGPT, Claude, Gemini, or any other modern LLM. A free account is enough."
          />
          <Need
            label="A few minutes"
            body="The fast path — clarify, try, ship — usually takes 10–20 minutes per app."
          />
          <Need
            label="A LUMATRIX (optional)"
            body="You can iterate entirely in LumenSimulator. Flash to a real Pico when ready."
          />
          <Need
            label="No coding"
            body="The AI writes every line. You describe, test, and approve."
          />
        </ul>
      </section>
    </div>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-lg border border-edge bg-panel px-5 py-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 text-accent text-[13px] font-semibold flex items-center justify-center">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white">{title}</div>
        <div className="mt-1 text-[12px] text-muted leading-[1.6]">{body}</div>
      </div>
    </li>
  );
}

function Need({ label, body }: { label: string; body: string }) {
  return (
    <li className="rounded border border-edge bg-panel px-4 py-3">
      <div className="text-[12px] font-semibold text-white">{label}</div>
      <div className="mt-1 text-[11px] text-muted leading-[1.55]">{body}</div>
    </li>
  );
}
