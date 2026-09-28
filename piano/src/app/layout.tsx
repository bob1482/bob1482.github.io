import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Synthesia Web Piano | High-Performance Virtual Piano & MIDI Visualizer",
  description: "High-performance web piano application featuring Salamander Grand Piano soundfont, Web MIDI hardware input, 60+ FPS Synthesia falling notes visualizer with hardware-accelerated Canvas 2D engine, and an 84-key responsive keyboard.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#08080b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-[#08080b] text-zinc-100 antialiased overflow-hidden font-sans select-none">
        {children}
      </body>
    </html>
  );
}
