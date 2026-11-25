// Theme mode: "light" | "dark" | "system". Persisted in localStorage under
// "picxle-theme". "system" (or a missing/legacy value) follows the OS via
// prefers-color-scheme. The actual colours are CSS variables keyed on the
// data-theme attribute on <html>; these helpers just decide light vs dark.
const KEY = "picxle-theme";

export type ThemeMode = "light" | "dark" | "system";

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return "system"; // default, and for the legacy absent value
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** The effective light/dark for a given mode. */
export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark();
}

/** Persist the mode and paint <html data-theme> accordingly. */
export function applyThemeMode(mode: ThemeMode): boolean {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  const dark = resolveDark(mode);
  try {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch {}
  return dark;
}

/** Single-button cycle order: light -> dark -> system -> light. */
export const nextThemeMode = (mode: ThemeMode): ThemeMode =>
  mode === "light" ? "dark" : mode === "dark" ? "system" : "light";

/** Icon + label per mode, for the toggle button. */
export const themeGlyph = (mode: ThemeMode): string => (mode === "light" ? "☀" : mode === "dark" ? "☾" : "◐");
export const themeLabel = (mode: ThemeMode): string =>
  mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";
