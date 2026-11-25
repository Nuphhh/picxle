// Image-credit rules.
//
// Creative Commons "Attribution" licences (CC-BY, CC-BY-SA) legally require
// crediting the author. Public-domain and CC0 images by other creators don't,
// but we credit them anyway, with thanks. Picxle's own images aren't anyone
// else's work, so they get no credit line at all.
//
// The DB still stores license + attribution for every image (the audit
// trail); these rules only decide what the player gets to see.

export const needsCredit = (license: string | null): boolean =>
  license === "CC-BY" || license === "CC-BY-SA";

export const isFreeUse = (license: string | null): boolean =>
  license === "PD" || license === "CC0";

// Picxle's own images are stored with an attribution beginning "Picxle original".
export const isPicxleOriginal = (attribution: string | null | undefined): boolean =>
  /^picxle original/i.test(attribution ?? "");

/** The credit line shown to players: none for Picxle's own images. */
export const publicAttribution = (attribution: string | null): string | null =>
  isPicxleOriginal(attribution) ? null : attribution;

/**
 * Turn a Wikimedia upload URL into its human-readable Commons file page, which
 * shows the full author + licence details (the canonical attribution).
 */
export function sourceLink(src: string): string {
  try {
    const u = new URL(src);
    if (u.hostname.includes("wikimedia.org")) {
      const file = decodeURIComponent(u.pathname.split("/").pop() ?? "");
      return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;
    }
  } catch {
    /* not a URL — fall back to the raw value */
  }
  return src;
}

export interface CreditEntry {
  imageSrc: string;
  license: string | null;
  attribution: string | null;
}

/**
 * The credits page list: one entry per image (a repeated source is credited
 * once), no Picxle originals, sorted by author.
 */
export function creditList(rows: readonly CreditEntry[]): CreditEntry[] {
  const seen = new Set<string>();
  const out: CreditEntry[] = [];
  for (const r of rows) {
    if (!r.imageSrc || seen.has(r.imageSrc)) continue;
    if (isPicxleOriginal(r.attribution)) continue;
    seen.add(r.imageSrc);
    out.push(r);
  }
  return out.sort((a, b) => (a.attribution ?? "").localeCompare(b.attribution ?? ""));
}
