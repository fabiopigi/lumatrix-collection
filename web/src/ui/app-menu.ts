/**
 * Quick-launch menu — a panel of buttons that lets the user jump to any
 * registered app directly, bypassing the on-display launcher. Triggered
 * from main.ts. Pure UI: actual app switching is handled by the callbacks.
 */

interface AppLike { readonly NAME: string; }

export interface AppMenuCallbacks {
  /** Called when the user clicks an app button. `index` is the position in
   *  the apps array (matches launcher.getApps()). */
  onLaunch(index: number): void;
  /** Called when the user clicks the "Back to launcher" button. */
  onBack(): void;
}

export interface AppMenu {
  readonly element: HTMLElement;
}

export function createAppMenu(apps: readonly AppLike[], cb: AppMenuCallbacks): AppMenu {
  const container = document.createElement("section");
  container.className = "app-menu";

  const header = document.createElement("div");
  header.className = "app-menu-header";

  const heading = document.createElement("div");
  heading.className = "app-menu-heading";
  heading.textContent = "Quick launch";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "app-btn app-btn-back";
  backBtn.textContent = "← Launcher menu";
  backBtn.title = "Interrupt the running app and return to the on-display launcher";
  backBtn.addEventListener("click", () => {
    cb.onBack();
    setActive(-1);
  });

  header.append(heading, backBtn);

  const grid = document.createElement("div");
  grid.className = "app-menu-grid";

  const buttons: HTMLButtonElement[] = [];

  apps.forEach((app, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "app-btn";
    btn.textContent = app.NAME;
    btn.title = `Launch ${app.NAME} directly`;
    btn.addEventListener("click", () => {
      cb.onLaunch(idx);
      setActive(idx);
    });
    buttons.push(btn);
    grid.appendChild(btn);
  });

  function setActive(activeIdx: number): void {
    buttons.forEach((b, i) => {
      b.classList.toggle("app-btn-active", i === activeIdx);
    });
  }

  container.append(header, grid);

  return { element: container };
}
