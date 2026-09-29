import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai, Newsreader } from "next/font/google";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

const thai = IBM_Plex_Sans_Thai({
  weight: ["400", "500"],
  subsets: ["thai"],
  variable: "--font-plex-thai",
});

export const metadata: Metadata = {
  title: "Code by Korn Natthanat",
  description: "Notes on how things are put together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below marks <html> before React takes over
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${serif.variable} ${mono.variable} ${thai.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Hide [data-reveal] blocks only when JS is on, before the first paint, so they
            can fade up without a flash — and without JS everything simply shows */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.dataset.revealing = ''",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
