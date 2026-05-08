import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentTrack — Recruiting Pipeline",
  description:
    "Mini Recruiting Pipeline Tool for HR teams: AI resume screening, candidate Kanban, interview scheduling, and analytics in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
        </div>
        <MobileNav />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
