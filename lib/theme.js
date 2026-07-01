// Theme mode: "light" | "dark" | "system". Persisted in localStorage under
// "picxle-theme". "system" (or a missing/legacy value) follows the OS via
// prefers-color-scheme. The actual colours are CSS variables keyed on the
// data-theme attribute on <html>; these helpers just decide light vs dark.
const KEY = "picxle-theme";

export function getThemeMode() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return "system"; // default, and for the legacy absent value
  } catch {
    return "system";
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

// The effective light/dark for a given mode.
export function resolveDark(mode) {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark();
}

// Persist the mode and paint <html data-theme> accordingly.
export function applyThemeMode(mode) {
  try { localStorage.setItem(KEY, mode); } catch {}
  const dark = resolveDark(mode);
  try { document.documentElement.dataset.theme = dark ? "dark" : "light"; } catch {}
  return dark;
}

// Single-button cycle order: light -> dark -> system -> light.
export function nextThemeMode(mode) {
  return mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
}

// Icon + label per mode, for the toggle button.
export function themeGlyph(mode) {
  return mode === "light" ? "☀" : mode === "dark" ? "☾" : "◐";
}
export function themeLabel(mode) {
  return mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";
}
