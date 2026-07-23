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
      <body suppressHydrationWarning className={`${inter.className} min-h-screen antialiased selection:bg-blue-500/30`}>
        
        {/* Background Mesh Gradient */}
        <div className="fixed inset-0 z-[-10] bg-mesh-gradient pointer-events-none" />
        
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
            <Toaster position="bottom-right" />
            <GlobalAlerts />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}