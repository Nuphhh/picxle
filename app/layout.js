import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeSync from "@/components/ThemeSync";

// Next.js loads these fonts at build time and serves them from your own domain —
// no Google tracking, no layout shift, faster than a <link> tag in the HTML.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-bricolage", // available as a CSS variable in every component
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://picxle.vercel.app"),
  title: "Picxle",
  description: "Guess the pixelated image. It sharpens as you miss.",
  // Default link preview = today's puzzle teaser (the /api/og card). Individual
  // shared results override this with their own puzzle via /s/[date].
  openGraph: {
    title: "Picxle",
    description: "Guess the daily pixelated image before it comes into focus.",
    images: [{ url: "/api/og", width: 1200, height: 1200 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Picxle",
    description: "Guess the daily pixelated image before it comes into focus.",
    images: ["/api/og"],
  },
};

// Runs before React paints. Sets data-theme on <html> so every CSS theme
// token resolves to the correct theme on the very first frame — no flash on
// load, even before React hydrates (notably inside the Capacitor webview).
// Also paints the background colour immediately. Tiny and dependency-free.
// t is "light" | "dark" | "system" (or absent = system). "system"/absent follow
// the OS via prefers-color-scheme. Runs before paint so there's no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('picxle-theme');var d=t==='dark'?true:t==='light'?false:window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.backgroundColor=d?'#17130d':'#faf6ef';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeSync />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
