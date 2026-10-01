import type { Metadata } from "next";
import { Chakra_Petch, Geist_Mono, Saira } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Variable width axis lets `font-display` stretch to 125% (extended techno face)
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
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
      className={`dark ${chakraPetch.variable} ${saira.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
