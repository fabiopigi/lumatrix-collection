"use client";

import type { Tool } from "@/lib/pixel-designer/types";

interface ToolDef {
  tool: Tool;
  key?: string;
  title: string;
  icon: React.ReactNode;
}

const ICONS = {
  pencil: (
    <path d="M16 3l5 5-13 13H3v-5L16 3z" />
  ),
  eraser: (
    <>
      <path d="M3 17l8-8 7 7-5 5H5l-2-4z" />
      <path d="M11 9l5-5 6 6-4 4" />
    </>
  ),
  fill: (
    <>
      <path d="M5 12l7-7 8 8-7 7-8-8z" />
      <path d="M5 12L2 15l3 3" />
    </>
  ),
  eyedrop: (
    <path d="M14 4l6 6-9 9-3 1 1-3 9-9-4-4z" />
  ),
  line: <line x1="4" y1="20" x2="20" y2="4" />,
  rect: <rect x="4" y="4" width="16" height="16" />,
  rectfill: <rect x="4" y="4" width="16" height="16" />,
  ellipse: <circle cx="12" cy="12" r="9" />,
  ellipsefill: <circle cx="12" cy="12" r="9" />,
  select: <rect x="4" y="4" width="16" height="16" />,
  text: <path d="M5 6h14M12 6v14" />,
} as const;

const TOOL_GROUPS: ToolDef[][] = [
  [
    { tool: "pencil", key: "P", title: "Pencil (P)", icon: ICONS.pencil },
    { tool: "eraser", key: "E", title: "Eraser (E)", icon: ICONS.eraser },
    { tool: "fill", key: "F", title: "Fill bucket (F)", icon: ICONS.fill },
    { tool: "eyedrop", key: "I", title: "Eyedropper (I)", icon: ICONS.eyedrop },
  ],
  [
    { tool: "line", key: "L", title: "Line (L)", icon: ICONS.line },
    { tool: "rect", key: "R", title: "Rectangle outline (R)", icon: ICONS.rect },
    { tool: "rectfill", title: "Rectangle filled (⇧R)", icon: ICONS.rectfill },
    { tool: "ellipse", key: "O", title: "Ellipse outline (O)", icon: ICONS.ellipse },
    { tool: "ellipsefill", title: "Ellipse filled (⇧O)", icon: ICONS.ellipsefill },
  ],
  [
    { tool: "select", key: "S", title: "Selection (S)", icon: ICONS.select },
    { tool: "text", key: "T", title: "Text (T)", icon: ICONS.text },
  ],
];

interface ToolbarProps {
  tool: Tool;
  onTool: (t: Tool) => void;
}

export function Toolbar({ tool, onTool }: ToolbarProps) {
  return (
    <aside className="w-14 bg-[#131316] border-r border-edge py-2.5 px-1.5 flex flex-col gap-1 shrink-0">
      {TOOL_GROUPS.map((group, gi) => (
        <div key={gi} className="contents">
          {gi > 0 && <div className="h-px bg-[#2a2a30] mx-1 my-1.5" />}
          {group.map((t) => {
            const isActive = tool === t.tool;
            const filled = t.tool === "rectfill" || t.tool === "ellipsefill";
            const dashed = t.tool === "select";
            return (
              <button
                key={t.tool}
                type="button"
                onClick={() => onTool(t.tool)}
                title={t.title}
                className={`relative w-11 h-10 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#1d2937] border-[#4a90e2] text-accent"
                    : "bg-transparent border-transparent text-[#b0b0b8] hover:bg-[#1f1f24] hover:text-white"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill={filled ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={t.tool === "text" ? 2.5 : 2}
                  strokeDasharray={dashed ? "3 3" : undefined}
                  pointerEvents="none"
                >
                  {t.icon}
                </svg>
                {t.key && (
                  <span
                    className={`absolute right-[3px] bottom-px text-[8px] font-mono ${
                      isActive ? "text-accent" : "text-[#555]"
                    }`}
                  >
                    {t.key}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
