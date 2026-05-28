import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/jam/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jam",
  description: "Jam creator discovery and collaborations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0a] text-[#ededed]">
        <div className="min-h-screen w-full bg-black/30">
          <div className="mx-auto w-full max-w-[390px] h-[100svh] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0a0a0a] shadow-2xl">
            <div className="relative h-[100svh]">
              <AppShell>{children}</AppShell>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
