import type { Metadata } from "next";
import { Simulator } from "./_components/simulator";

export const metadata: Metadata = {
  title: "Simulator · LUMATRIX Toolkit",
  description:
    "Browser simulator of the LUMATRIX kit: 8×8 NeoPixel matrix, 5-way joystick, slide switch.",
};

export default function SimulatorPage() {
  return <Simulator />;
}
