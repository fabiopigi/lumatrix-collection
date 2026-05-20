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
    "Pixel-art tools for LED matrices: design, animate, simulate, flash to your board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${bitcount.variable} h-dvh flex flex-col bg-background text-foreground`}
      >
        <HeaderActionsSlotProvider>
          <SiteHeader />
          {/* min-h-0 lets main shrink inside the flex column so its own
              overflow takes effect instead of pushing the footer off-screen.
              Tool pages that want to fill the viewport (designer, simulator)
              use h-full inside; long pages (LumenCreate) scroll within main. */}
          <main className="flex-1 w-full min-h-0 overflow-y-auto">
            {children}
          </main>
          <SiteFooter />
        </HeaderActionsSlotProvider>
      </body>
    </html>
  );
}
