// Calendar days are plain "YYYY-MM-DD" strings in UTC. The puzzle flips at
// midnight UTC — one shared puzzle per day worldwide, like Wordle.
//
// Strings in this format sort and compare correctly ("2026-01-09" < "2026-01-10"),
// which is why the code can use < and > on them directly.

/** A UTC calendar day, "YYYY-MM-DD". */
export type IsoDay = string;

const DAY_MS = 86_400_000;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDay = (value: unknown): value is IsoDay =>
  typeof value === "string" && ISO_DAY_RE.test(value);

/** The UTC day that `now` falls on. */
export const utcDay = (now: Date): IsoDay => now.toISOString().slice(0, 10);

/** `day` moved by `n` days (negative goes back). */
export function addDays(day: IsoDay, n: number): IsoDay {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDay(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: IsoDay, b: IsoDay): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** Milliseconds until the next puzzle (the next UTC midnight). */
export function msUntilNextPuzzle(now: Date): number {
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** 3_723_000 ms -> "01:02:03". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
