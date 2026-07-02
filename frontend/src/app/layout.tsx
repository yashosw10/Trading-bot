import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";

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
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-50 antialiased selection:bg-blue-500/30`}>
        {/* Background Ambient Glow */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[60%] bg-purple-500/10 dark:bg-purple-600/10 blur-[120px] rounded-full mix-blend-screen" />
        </div>
        
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}