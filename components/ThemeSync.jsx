"use client";

// Keeps the app in sync with the OS theme while the user is in "system" mode.
// The colours are CSS variables driven by <html data-theme>, so when the OS
// flips we just re-set data-theme — everything else updates via CSS. Renders
// nothing; mounted once in the root layout.
import { useEffect } from "react";
import { getThemeMode } from "@/lib/theme";

export default function ThemeSync() {
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => {
      if (getThemeMode() === "system") {
        document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
        // let any mounted toggle refresh its icon if it wants to
        window.dispatchEvent(new Event("picxle-themechange"));
      }
    };
    // addEventListener is the modern API; some old WebViews only have addListener
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);
  return null;
}
