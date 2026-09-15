import type { Metadata } from "next";
import "./globals.css";
import { Cinzel, Rajdhani, IBM_Plex_Mono } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-hud",
  display: "swap",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-console",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Ancient — Beens Console",
  description: "War-room console for the Beens agent roster.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${cinzel.variable} ${rajdhani.variable} ${plex.variable}`}
    >
      <body className="font-hud antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
