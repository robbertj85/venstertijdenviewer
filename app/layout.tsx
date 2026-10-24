import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venstertijdenviewer - Verkeersborden met tijdvensters",
  description: "Overzicht van alle verkeersborden met venstertijden (bezorgvensters, spitsafsluitingen, vrachtverboden) in de G4+G40 gemeenten, direct uit de NDW Verkeersborden API.",
  keywords: ["venstertijden", "verkeersborden", "NDW", "George", "bezorgvenster", "stadslogistiek"],
};

const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      </head>
      <body className="antialiased">
        {children}
        {UMAMI_SRC && UMAMI_WEBSITE_ID && (
          <Script src={UMAMI_SRC} data-website-id={UMAMI_WEBSITE_ID} strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
