import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperMarketCap — Crypto Paper Trading Bot",
  description: "Algorithmic crypto paper trading dashboard powered by DCA Hybrid strategy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-full">
        {/* Aurora orb backdrop — mounted once at the root so every route
            sits on the same glass-refracting surface. Lives behind
            everything (z-index: -1, see globals.css). */}
        <div className="vibrant-background" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}