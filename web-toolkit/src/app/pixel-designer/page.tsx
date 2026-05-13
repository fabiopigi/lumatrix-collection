import type { Metadata } from "next";
import { Designer } from "./_components/designer";

export const metadata: Metadata = {
  title: "Pixel Designer · LUMATRIX Toolkit",
  description:
    "Design 8×8 (or arbitrary) LED-matrix screens, export to JSON / PNG.",
};

export default function PixelDesignerPage() {
  return <Designer />;
}
