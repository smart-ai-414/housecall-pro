import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";

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
  title: {
    default: `${BRAND.companyName} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.companyName}`,
  },
  description: `${BRAND.companyName}: send a photo, get a reviewed glass repair estimate. ${BRAND.serviceAreaSummary}.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-surface flex min-h-full flex-col font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
