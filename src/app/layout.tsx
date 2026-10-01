import type { Metadata } from "next";
import { Chakra_Petch, Geist_Mono, Saira, Zen_Dots } from "next/font/google";
import { Providers } from "@/components/providers";
import { PointerVars } from "@/components/metal/pointer-vars";
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
      className={`${chakraPetch.variable} ${zenDots.variable} ${saira.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        {/* Feeds the cursor position to the CSS chrome (--mx / --my) */}
        <PointerVars />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
