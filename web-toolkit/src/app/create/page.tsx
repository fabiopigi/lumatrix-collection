import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { PromptBlock, type PromptBlockLabels } from "./_components/prompt-block";

type Lang = "en" | "de";

/** Per-locale copy. The LLM prompt body itself stays English regardless of
 *  the page language — modern LLMs are equally fluent and the prompt is the
 *  largest piece of text on the page (~30 KB). Only page chrome translates. */
const T: Record<Lang, {
  metaTitle: string;
  metaDesc: string;
  tagline: string;
  howItWorks: string;
  steps: { title: string; body: (Link: typeof InlineLink) => React.ReactNode }[];
  promptHeading: string;
  promptIntro: string;
  promptLoadError: (githubLink: React.ReactNode) => React.ReactNode;
  githubLinkText: string;
  needHeading: string;
  needs: { label: string; body: string }[];
  promptLabels: PromptBlockLabels;
}> = {
  en: {
    metaTitle: "LumenCreate · LumenLab",
    metaDesc:
      "Build your own LumenLab app without writing code — design screens, hand the prompt to an LLM, test in the browser, then flash to your Pico.",
    tagline:
      "Build your own LumenLab app without writing code. Describe what you want, let an AI write the code, try it in the browser, then flash it to your Pico — the whole loop runs on this site.",
    howItWorks: "How it works",
    steps: [
      {
        title: "Sketch your screens (optional)",
        body: (L) => (
          <>
            If your app has fixed visuals — a clock face, a game-over banner,
            animation frames — paint them in{" "}
            <L href="/pixel-designer">LumenDesigner</L> and export the JSON.
            Skip this step if the visuals are fully algorithmic (random pixels,
            sliding bars, etc.).
          </>
        ),
      },
      {
        title: "Describe what the app should do",
        body: () => (
          <>
            One paragraph in plain English. What does the user see? What happens
            when they press up/down/left/right or center? Is it a game with a
            score, or a passive animation? Examples:
            <ul className="mt-2 list-disc pl-5 space-y-1 text-[12px] text-muted/90">
              <li>
                <em>
                  &ldquo;A game where a dot falls from the top and the player
                  catches it with a 3-pixel paddle. +1 per catch, lose after 3
                  misses.&rdquo;
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
        ),
      },
      {
        title: "Open a fresh AI chat and paste the prompt",
        body: () => (
          <>
            Use any LLM — ChatGPT, Claude, Gemini, your favourite. Open a new
            conversation and paste the LumenLab app-builder prompt below as your
            first message. Then attach the JSON from step 1 (if you made one)
            and your description from step 2.
          </>
        ),
      },
      {
        title: "Iterate in the simulator",
        body: (L) => (
          <>
            The AI walks you through a paced conversation. It may ask a couple
            of clarifying questions first, then it emits two files: a
            JavaScript app to try in <L href="/simulator">LumenSimulator</L>{" "}
            and a Python app to flash via <L href="/flash">LumenFlash</L>.
            Reply with <code className="font-mono text-foreground">works</code>
            , <code className="font-mono text-foreground">change X</code>, or{" "}
            <code className="font-mono text-foreground">add Y</code> until
            you&apos;re happy.
          </>
        ),
      },
      {
        title: "Graduate to a real LumenLab app",
        body: () => (
          <>
            When you say it&apos;s ready, the AI hands you all five files in one
            go: the JS, the Python, a TypeScript twin, the docs, and an
            integration guide. It also offers to package them as a{" "}
            <code className="font-mono text-foreground">&lt;name&gt;.zip</code>{" "}
            you can email to a LumenLab maintainer — your app then ships in the
            next release for everyone to use.
          </>
        ),
      },
    ],
    promptHeading: "The prompt",
    promptIntro:
      "This is the instruction set the AI follows. Copy it, paste it as the first message in your AI chat, then send your description on the next message. You don't need to read it — it's for the AI.",
    promptLoadError: (gh) => (
      <>
        Couldn&apos;t load the prompt. Reload the page or grab it from {gh}.
      </>
    ),
    githubLinkText: "GitHub",
    needHeading: "What you'll need",
    needs: [
      {
        label: "An AI chat",
        body: "ChatGPT, Claude, Gemini, or any other modern LLM. A free account is enough.",
      },
      {
        label: "A few minutes",
        body: "The fast path — clarify, try, ship — usually takes 10–20 minutes per app.",
      },
      {
        label: "A LUMATRIX (optional)",
        body: "You can iterate entirely in LumenSimulator. Flash to a real Pico when ready.",
      },
      {
        label: "No coding",
        body: "The AI writes every line. You describe, test, and approve.",
      },
    ],
    promptLabels: {
      title: "LumenLab app-builder prompt",
      subtitle: "paste into any LLM chat",
      download: "Download .md",
      copy: "Copy prompt",
      copied: "Copied!",
      expand: "Expand preview",
      collapse: "Collapse",
    },
  },
  de: {
    metaTitle: "LumenCreate · LumenLab",
    metaDesc:
      "Erstelle deine eigene LumenLab-App ohne Programmieren — gestalte Screens, übergib den Prompt an eine KI, teste im Browser und flashe dann auf deinen Pico.",
    tagline:
      "Erstelle deine eigene LumenLab-App ohne Programmieren. Beschreibe, was du möchtest, lass eine KI den Code schreiben, probiere ihn im Browser aus und flashe ihn dann auf deinen Pico — der ganze Ablauf läuft auf dieser Seite.",
    howItWorks: "So funktioniert's",
    steps: [
      {
        title: "Skizziere deine Screens (optional)",
        body: (L) => (
          <>
            Wenn deine App feste Bilder hat — ein Ziffernblatt, ein
            Game-Over-Banner, Animations-Frames — male sie im{" "}
            <L href="/pixel-designer">LumenDesigner</L> und exportiere das
            JSON. Überspring diesen Schritt, wenn die Visuals komplett
            algorithmisch sind (Zufallspixel, gleitende Balken usw.).
          </>
        ),
      },
      {
        title: "Beschreibe, was die App tun soll",
        body: () => (
          <>
            Ein Absatz in einfachem Deutsch. Was sieht die Nutzerin? Was
            passiert beim Drücken von oben/unten/links/rechts oder Mitte? Ist
            es ein Spiel mit Punktestand oder eine passive Animation?
            Beispiele:
            <ul className="mt-2 list-disc pl-5 space-y-1 text-[12px] text-muted/90">
              <li>
                <em>
                  „Ein Spiel, bei dem ein Punkt von oben fällt und der Spieler
                  ihn mit einem 3-Pixel-Paddle auffängt. +1 pro Fang, verloren
                  nach 3 Verfehlern.&ldquo;
                </em>
              </li>
              <li>
                <em>
                  „Wechsle alle 2 Sekunden zwischen diesen vier Seiten.
                  Links/Rechts springt zur vorherigen/nächsten Seite.&ldquo;
                </em>
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Öffne einen frischen KI-Chat und füge den Prompt ein",
        body: () => (
          <>
            Verwende eine beliebige LLM — ChatGPT, Claude, Gemini, deine
            Lieblings-KI. Starte eine neue Konversation und füge den
            LumenLab-App-Builder-Prompt unten als erste Nachricht ein. Hänge
            dann das JSON aus Schritt 1 (falls vorhanden) und deine
            Beschreibung aus Schritt 2 an.
          </>
        ),
      },
      {
        title: "Iteriere im Simulator",
        body: (L) => (
          <>
            Die KI führt dich durch ein strukturiertes Gespräch. Sie stellt
            vielleicht ein paar Rückfragen, dann liefert sie zwei Dateien:
            eine JavaScript-App zum Ausprobieren in{" "}
            <L href="/simulator">LumenSimulator</L> und eine Python-App zum
            Flashen über <L href="/flash">LumenFlash</L>. Antworte mit{" "}
            <code className="font-mono text-foreground">works</code>,{" "}
            <code className="font-mono text-foreground">change X</code> oder{" "}
            <code className="font-mono text-foreground">add Y</code>, bis du
            zufrieden bist.
          </>
        ),
      },
      {
        title: "Mach daraus eine echte LumenLab-App",
        body: () => (
          <>
            Wenn du sagst, dass es fertig ist, gibt dir die KI alle fünf
            Dateien auf einmal: das JS, das Python, einen TypeScript-Twin, die
            Doku und eine Integrationsanleitung. Sie bietet auch an, alles als{" "}
            <code className="font-mono text-foreground">&lt;name&gt;.zip</code>{" "}
            zu packen, das du an einen LumenLab-Maintainer mailen kannst —
            deine App erscheint dann im nächsten Release für alle.
          </>
        ),
      },
    ],
    promptHeading: "Der Prompt",
    promptIntro:
      "Das ist die Anleitung, der die KI folgt. Kopiere sie, füge sie als erste Nachricht in deinen KI-Chat ein und schicke dann deine Beschreibung als nächste Nachricht. Du musst sie nicht lesen — sie ist für die KI.",
    promptLoadError: (gh) => (
      <>
        Der Prompt konnte nicht geladen werden. Lade die Seite neu oder hol ihn
        von {gh}.
      </>
    ),
    githubLinkText: "GitHub",
    needHeading: "Was du brauchst",
    needs: [
      {
        label: "Ein KI-Chat",
        body: "ChatGPT, Claude, Gemini oder eine andere moderne LLM. Ein kostenloses Konto reicht.",
      },
      {
        label: "Ein paar Minuten",
        body: "Der schnelle Weg — klären, ausprobieren, fertig — dauert meist 10–20 Minuten pro App.",
      },
      {
        label: "Eine LUMATRIX (optional)",
        body: "Du kannst komplett im LumenSimulator iterieren. Flashe auf einen echten Pico, wenn du bereit bist.",
      },
      {
        label: "Kein Programmieren",
        body: "Die KI schreibt jede Zeile. Du beschreibst, testest und gibst frei.",
      },
    ],
    promptLabels: {
      title: "LumenLab App-Builder-Prompt",
      subtitle: "in einen KI-Chat einfügen",
      download: "Download .md",
      copy: "Prompt kopieren",
      copied: "Kopiert!",
      expand: "Vorschau ausklappen",
      collapse: "Einklappen",
    },
  },
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

function pickLang(raw: string | string[] | undefined): Lang {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "de" ? "de" : "en";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const lang = pickLang((await searchParams).lang);
  return { title: T[lang].metaTitle, description: T[lang].metaDesc };
}

function InlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-accent">
      {children}
    </Link>
  );
}

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const lang = pickLang((await searchParams).lang);
  const t = T[lang];
  const parts = await loadPromptParts();
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Lumen<span className="text-accent">Create</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-prose">
            {t.tagline}
          </p>
        </div>
        <LangSwitch current={lang} />
      </header>

      <section className="mt-10">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          {t.howItWorks}
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {t.steps.map((step, i) => (
            <Step key={i} num={i + 1} title={step.title} body={step.body(InlineLink)} />
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          {t.promptHeading}
        </h2>
        <p className="mt-2 text-[12px] text-muted leading-relaxed max-w-prose">
          {t.promptIntro}
        </p>
        <div className="mt-4">
          {parts ? (
            <PromptBlock
              promptBody={parts.promptBody}
              fullSource={parts.fullSource}
              labels={t.promptLabels}
            />
          ) : (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-200/90">
              {t.promptLoadError(
                <a
                  href="https://github.com/fabiopigi/lumenlab/blob/main/docs/llm-app-prompt.md"
                  className="text-red-200 underline"
                >
                  {t.githubLinkText}
                </a>,
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white uppercase">
          {t.needHeading}
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {t.needs.map((n, i) => (
            <Need key={i} label={n.label} body={n.body} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function LangSwitch({ current }: { current: Lang }) {
  return (
    <div
      className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-muted shrink-0"
      aria-label="Language"
    >
      <LangLink lang="en" active={current === "en"} />
      <span className="text-edge">|</span>
      <LangLink lang="de" active={current === "de"} />
    </div>
  );
}

function LangLink({ lang, active }: { lang: Lang; active: boolean }) {
  // Use replace-style links (no preserved scroll) — the page content is what
  // changes, and Next's <Link> handles the soft nav so the rest of the SPA
  // state isn't disturbed.
  return (
    <Link
      href={`?lang=${lang}`}
      className={`px-1.5 py-0.5 rounded transition-colors ${
        active
          ? "text-accent"
          : "text-muted hover:text-white"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {lang.toUpperCase()}
    </Link>
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
