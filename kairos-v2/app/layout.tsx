import type { Metadata, Viewport } from "next";
import { EB_Garamond, IM_Fell_English, Playfair_Display } from "next/font/google";
import "./globals.css";

// Same three faces as the Kairos website: Playfair for titles, Garamond for text,
// IM Fell for the wordmark. next/font self-hosts them, so nothing loads from Google at runtime.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const text = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-text",
  display: "swap",
});
const mark = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mark",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kairos — Private Concierge, New York",
  description: "Send a request to the Kairos concierge team.",
  robots: { index: false, follow: false }, // members-only: keep out of search
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDE3CB" },
    { media: "(prefers-color-scheme: dark)", color: "#211A11" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mark.variable}`}>
      <body>{children}</body>
    </html>
  );
}
