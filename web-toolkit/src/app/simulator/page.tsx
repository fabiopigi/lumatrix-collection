import type { Metadata } from "next";
import { Simulator } from "./_components/simulator";

export const metadata: Metadata = {
  title: "LumenSimulator · LumenLab",
  description:
    "Browser simulator for LED-matrix boards: 8×8 NeoPixel matrix, 5-way joystick, slide switch.",
};

export default function SimulatorPage() {
  return <Simulator />;
}
