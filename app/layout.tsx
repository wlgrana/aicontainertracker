// Force rebuild for prisma client update
import { Suspense } from "react";
// Force rebuild for hydration fix
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Toaster } from "sonner";

import { PremiumSidebar } from "@/components/layout/PremiumSidebar";
import { getDashboardData } from "./actions/entry/actions";

export const metadata: Metadata = {
  title: "FBG Container Tracker",
  description: "Advanced Logistics Operational Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = await getDashboardData();
  const attentionCount = data?.attention?.length || 0;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-hidden bg-slate-50`}
      >
        <div className="flex h-full w-full">
          <Suspense fallback={<div className="w-72 bg-slate-900 h-screen shrink-0" />}>
            <PremiumSidebar attentionCount={attentionCount} />
          </Suspense>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        <Toaster position="top-right" expand={true} richColors />
      </body>
    </html>
  );
}
