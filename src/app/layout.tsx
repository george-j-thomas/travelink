import type { Metadata } from "next";
import { Chakra_Petch, Dela_Gothic_One, Geist_Mono, Saira, Zen_Dots } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Display face: heavy rounded techno, thickened further by `font-display`
const zenDots = Zen_Dots({
  variable: "--font-zen",
  subsets: ["latin"],
  weight: "400",
});

// Katakana only (`font-jp`): Google serves CJK glyphs as unicode-range
// chunks, so only the characters on the page are downloaded.
const dela = Dela_Gothic_One({
  variable: "--font-dela",
  subsets: ["latin"],
  weight: "400",
});

// Variable width axis lets `font-wide` stretch to 125% for small labels
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travelink",
  description:
    "Track your favorite tattoo artists and their locations around the world",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${zenDots.variable} ${dela.variable} ${saira.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
