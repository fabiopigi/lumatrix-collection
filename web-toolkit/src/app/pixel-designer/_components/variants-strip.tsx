"use client";

import { HARDWARE_PRESETS, presetIdsInOrder } from "@/lib/hardware-presets";
import type { Design } from "@/lib/pixel-designer/types";

interface VariantsStripProps {
  design: Design;
  pageIdx: number;
  activePreset: string;
  onSelectVariant: (id: string) => void;
  onAddClicked: () => void;
}

/** Row of chips below the page header showing every variant that exists for
 *  this page. The active one is highlighted; clicking a chip switches the
 *  editor's active preset globally (so all pages re-render their variant for
 *  the chosen preset). A trailing "+ Add variant" button kicks off the add-
 *  variant flow for this page. */
export function VariantsStrip({
  design,
  pageIdx,
  activePreset,
  onSelectVariant,
  onAddClicked,
}: VariantsStripProps) {
  const page = design.pages[pageIdx];
  if (!page) return null;
  const variantIds = presetIdsInOrder(Object.keys(page.variants));

  const sizeLabel = (id: string) => {
    const hw = design.hardware[id];
    if (!hw) return id;
    return `${hw.width}×${hw.height}`;
  };

  const fullLabel = (id: string) =>
    HARDWARE_PRESETS.find((p) => p.id === id)?.label ?? sizeLabel(id);

  return (
    <div className="flex items-center gap-1 px-1.5 flex-wrap">
      <span className="text-[9px] text-[#555] uppercase tracking-wider mr-1 font-semibold">
        Variants
      </span>
      {variantIds.map((id) => {
        const isActive = id === activePreset;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectVariant(id)}
            title={fullLabel(id)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
              isActive
                ? "bg-[#2a3a4a] text-accent border border-[#3a4a5a]"
                : "bg-[#22222a] text-[#888] border border-[#2f2f37] hover:bg-[#2c2c34] hover:text-foreground"
            }`}
          >
            {sizeLabel(id)}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddClicked}
        title="Add a variant for another hardware preset"
        className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-transparent text-[#666] border border-dashed border-[#3a3a42] hover:bg-[#22222a] hover:text-accent hover:border-[#4a90e2]"
      >
        + Add
      </button>
    </div>
  );
}
