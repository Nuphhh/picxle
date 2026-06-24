import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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
  title: "Picxle",
  description: "Guess the pixelated image. It sharpens as you miss.",
  // Temporary build probe: surfaces whether the PostHog env var is visible to the
  // build, without exposing the key. Renders <meta name="px-analytics" content="…">.
  other: { "px-analytics": process.env.NEXT_PUBLIC_POSTHOG_KEY ? "configured" : "missing" },
};

// Runs before React paints. Sets data-theme on <html> so every CSS theme
// token resolves to the correct theme on the very first frame — no flash on
// load, even before React hydrates (notably inside the Capacitor webview).
// Also paints the background colour immediately. Tiny and dependency-free.
const themeScript = `(function(){try{var t=localStorage.getItem('picxle-theme');var d=t!==null?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.backgroundColor=d?'#17130d':'#faf6ef';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
