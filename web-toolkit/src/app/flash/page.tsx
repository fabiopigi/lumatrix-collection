import type { Metadata } from "next";
import { FlashWizard } from "./_components/flash-wizard";

export const metadata: Metadata = {
  title: "LumenFlash · LumenLab",
  description:
    "Install the LumenLab launcher and apps onto a Raspberry Pi Pico directly from your browser over USB.",
};

export default function FlashPage() {
  return <FlashWizard />;
}
