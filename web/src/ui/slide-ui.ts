import type { Slide } from "../hardware/slide";

export interface SlideUI {
  readonly element: HTMLElement;
}

export function createSlideUI(slide: Slide): SlideUI {
  const root = document.createElement("label");
  root.className = "slide-ui";

  const label = document.createElement("span");
  label.className = "slide-label";
  label.textContent = "Slide";

  const track = document.createElement("span");
  track.className = "slide-track";
  const knob = document.createElement("span");
  knob.className = "slide-knob";
  track.appendChild(knob);

  const stateLabel = document.createElement("span");
  stateLabel.className = "slide-state";

  root.append(label, track, stateLabel);

  function refresh(): void {
    const on = slide.value() === 1;
    root.classList.toggle("on", on);
    stateLabel.textContent = on ? "1" : "0";
  }

  track.addEventListener("click", () => slide.toggle());
  slide.onChange(refresh);
  refresh();

  return { element: root };
}
