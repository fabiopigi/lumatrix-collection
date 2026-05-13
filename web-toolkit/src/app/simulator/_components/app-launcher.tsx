"use client";

/**
 * The "quick launch" rail on the left side of the LumenSimulator.
 *
 * Pure UI — actual app-switching is wired up by the caller through the
 * onLaunch / onBackToLauncher callbacks. The button highlighted as active
 * is the one currently running (null = the on-display launcher menu).
 */

interface AppLauncherProps {
  apps: ReadonlyArray<{ readonly NAME: string }>;
  /** Index of the app currently running, or null when the user is on the
   *  on-display launcher menu. */
  activeIdx: number | null;
  /** Fired when the user clicks an app button — should jump straight to
   *  that app, bypassing the loading spinner. */
  onLaunch(index: number): void;
  /** Fired when the user clicks "← Launcher menu" — should interrupt the
   *  currently running app and return to the on-display launcher. */
  onBackToLauncher(): void;
}

export function AppLauncher({
  apps,
  activeIdx,
  onLaunch,
  onBackToLauncher,
}: AppLauncherProps) {
  return (
    <aside className="flex flex-col gap-2 w-48 shrink-0">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold">
        Quick launch
      </div>

      <button
        type="button"
        onClick={onBackToLauncher}
        title="Interrupt the running app and return to the on-display launcher"
        className={`text-[12px] px-3 py-1.5 rounded border bg-transparent text-accent border-accent/40 cursor-pointer transition-colors hover:bg-accent/[0.12] hover:border-accent text-left ${
          activeIdx === null
            ? "bg-accent/[0.12] border-accent"
            : ""
        }`}
      >
        ← Launcher menu
      </button>

      <div className="flex flex-col gap-1 mt-1">
        {apps.map((app, idx) => {
          const active = idx === activeIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onLaunch(idx)}
              title={`Launch ${app.NAME} directly`}
              className={`text-[12px] px-3 py-1.5 rounded border text-left font-medium cursor-pointer transition-colors ${
                active
                  ? "bg-accent/[0.12] border-accent text-accent"
                  : "bg-panel-2 border-edge text-foreground hover:bg-[#22222a] hover:border-[#3a3a42]"
              }`}
            >
              {app.NAME}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted/80 leading-[1.45] mt-2">
        Click an app to jump to it directly. Hold the joystick&apos;s center for
        1.5 s during play to return to the on-display launcher.
      </p>
    </aside>
  );
}
