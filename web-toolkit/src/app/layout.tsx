import type { Metadata } from "next";
import { Bitcount_Grid_Double } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeaderActionsSlotProvider } from "@/components/header-actions-slot";

const bitcount = Bitcount_Grid_Double({
  weight: ["300", "400"],
  subsets: ["latin"],
  variable: "--bitcount-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LumenLab",
  description:
    "Pixel-art tools for LED matrices — design, animate, simulate, flash to your board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${bitcount.variable} min-h-full flex flex-col bg-background text-foreground`}
      >
        <HeaderActionsSlotProvider>
          <SiteHeader />
          <main className="flex-1 w-full">{children}</main>
          <SiteFooter />
        </HeaderActionsSlotProvider>
      </body>
    </html>
  );
}
