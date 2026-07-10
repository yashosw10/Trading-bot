import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";

import { ThemeProvider } from "@/providers/ThemeProvider";
import GlobalAlerts from "@/components/layout/GlobalAlerts";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trading Bot | Liquid Glass",
  description: "Advanced algorithmic trading bot dashboard featuring Apple Liquid Glass aesthetic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-neutral-100 dark:bg-[#0a0a0c] text-neutral-900 dark:text-neutral-50 antialiased selection:bg-blue-500/30`}>
        
        {/* Background Ambient Glow & Fluid Orbs */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          {/* Noise texture overlay */}
          <div className="absolute inset-0 bg-noise opacity-[0.06] dark:opacity-[0.04] mix-blend-overlay z-10" />
          
          {/* Animated Orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/30 dark:bg-blue-600/30 blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-blob1" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/30 dark:bg-purple-600/20 blur-[160px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-blob2" />
          <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-emerald-500/20 dark:bg-emerald-600/15 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-blob3" />
        </div>
        
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}