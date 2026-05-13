"use client";

/**
 * Lets per-route pages render their own action buttons inside the shared
 * SiteHeader. The header renders a single empty <div> and exposes it through
 * context; pages call useHeaderActionsSlot() to get the element and portal
 * their buttons into it.
 *
 * The portal approach avoids React's dep-tracking gotchas for re-renders —
 * the page re-renders its buttons normally, they just land in the header's
 * DOM rather than the page's.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

interface SlotContextValue {
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
}

const SlotContext = createContext<SlotContextValue>({
  slot: null,
  setSlot: () => {},
});

export function HeaderActionsSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <SlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </SlotContext.Provider>
  );
}

/** Header uses this to register the DOM node it wants actions rendered into. */
export function useRegisterHeaderActionsSlot(): (el: HTMLElement | null) => void {
  return useContext(SlotContext).setSlot;
}

/** Pages use this to get the slot element and portal their buttons into it. */
export function useHeaderActionsSlot(): HTMLElement | null {
  return useContext(SlotContext).slot;
}
