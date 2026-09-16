import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";

import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-surface flex min-h-full flex-col font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
