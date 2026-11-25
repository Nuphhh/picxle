// Inside the installed Android/iOS app, Capacitor injects `window.Capacitor`
// into the web view. On the website it isn't there. Reading it through this
// helper (rather than importing @capacitor/core) keeps the website from
// pretending to be an app, and gives TypeScript the shape we rely on.
export interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
}

export function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the installed native app. */
export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
