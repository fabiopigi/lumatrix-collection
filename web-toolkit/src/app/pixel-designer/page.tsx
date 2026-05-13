import type { Metadata } from "next";
import { Designer } from "./_components/designer";

export const metadata: Metadata = {
  title: "LumenDesigner · LumenLab",
  description:
    "Design LED-matrix screens and animations, export to JSON or PNG.",
};

export default function PixelDesignerPage() {
  return <Designer />;
}
