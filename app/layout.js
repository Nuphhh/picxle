import { Bricolage_Grotesque, Space_Mono } from "next/font/google";
import "./globals.css";

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
};

// Runs before React paints, so the page background is the right theme
// from the very first frame — no white flash on cold load (notably inside
// the Capacitor webview). Kept tiny and dependency-free on purpose.
const themeScript = `(function(){try{var t=localStorage.getItem('picxle-theme');var d=t!==null?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.style.backgroundColor=d?'#17130d':'#faf6ef';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
