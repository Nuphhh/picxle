// Image credits / attributions screen.
// CC-BY (and CC-BY-SA) images legally require crediting the author + license +
// a link to the source. We deliberately DO NOT show the puzzle answer here —
// that would spoil future puzzles — only the author, licence and a source link.
import { supabaseFetch } from "../../lib/supabase";

export const metadata = {
  title: "Image credits — Picxle",
  description: "Sources and licences for the images used in Picxle.",
};
// Re-fetch occasionally rather than on every request.
export const revalidate = 3600;

// Theme-aware via globals.css: resolve to the right colour in light and dark
// (matches the privacy page). Hardcoded values were light-on-light in light mode.
const cream = "var(--cream)";
const dim = "var(--creamDim)";
const blue = "var(--blue)";
const line = "var(--line)";

// Turn a Wikimedia upload URL into its human-readable Commons file page,
// which shows the full author + licence details (the canonical attribution).
function sourceLink(src) {
  try {
    const u = new URL(src);
    if (u.hostname.includes("wikimedia.org")) {
      const file = decodeURIComponent(u.pathname.split("/").pop());
      return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;
    }
  } catch {}
  return src;
}

const LICENSE_LINKS = {
  "CC-BY": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "PD": "https://en.wikipedia.org/wiki/Public_domain",
};

async function getCredits() {
  try {
    const res = await supabaseFetch("puzzles?select=image_src,license,attribution");
    if (!res.ok) return [];
    const rows = await res.json();
    // de-dupe by image so a repeated source is credited once
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (!r.image_src || seen.has(r.image_src)) continue;
      seen.add(r.image_src);
      out.push(r);
    }
    out.sort((a, b) => (a.attribution || "").localeCompare(b.attribution || ""));
    return out;
  } catch {
    return [];
  }
}

function Group({ title, note, items }) {
  if (!items.length) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "0 0 4px", color: cream }}>
        {title} <span style={{ color: dim, fontWeight: 400, fontSize: 15 }}>({items.length})</span>
      </h2>
      <p style={{ color: dim, fontSize: 14, margin: "0 0 16px" }}>{note}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((r, i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${line}`, fontSize: 14 }}>
            <span style={{ color: cream }}>{r.attribution || "Wikimedia Commons"}</span>
            <a href={sourceLink(r.image_src)} target="_blank" rel="noopener noreferrer"
               style={{ color: blue, textDecoration: "none", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
              source ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Credits() {
  const credits = await getCredits();
  const freeUse = credits.filter((r) => r.license === "PD" || r.license === "CC0");
  const attributed = credits.filter((r) => r.license === "CC-BY" || r.license === "CC-BY-SA");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "Georgia, serif", color: cream, lineHeight: 1.8, fontSize: 16 }}>
      <a href="/" style={{ fontFamily: "monospace", fontSize: 13, color: dim, textDecoration: "none", letterSpacing: "1px" }}>
        ← PICXLE
      </a>

      <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 32, margin: "32px 0 4px", letterSpacing: "-1px", color: cream }}>
        Image credits
      </h1>
      <p style={{ color: dim, fontSize: 14, margin: "0 0 24px" }}>The images behind the puzzles, and who made them.</p>

      <p>
        Every Picxle puzzle uses an openly-licensed image, mostly from{" "}
        <a href="https://commons.wikimedia.org" style={{ color: blue }}>Wikimedia Commons</a>.
        Public-domain and CC0 images carry no conditions; CC&nbsp;BY images are used
        with credit to their authors below. Each “source” link opens the original
        file, where the full licence and author details live.
      </p>
      <p style={{ fontSize: 14, color: dim }}>
        Licences:{" "}
        <a href={LICENSE_LINKS["CC-BY"]} style={{ color: blue }}>CC&nbsp;BY</a>,{" "}
        <a href={LICENSE_LINKS["CC0"]} style={{ color: blue }}>CC0</a>,{" "}
        <a href={LICENSE_LINKS["PD"]} style={{ color: blue }}>public&nbsp;domain</a>.
      </p>

      {credits.length === 0 && (
        <p style={{ color: dim, marginTop: 32 }}>Credits are temporarily unavailable. Please try again later.</p>
      )}

      <Group
        title="With attribution — CC BY"
        note="Used under Creative Commons Attribution licences. Credit goes to each author."
        items={attributed}
      />
      <Group
        title="Public domain & CC0"
        note="No attribution required — credited here anyway, with thanks."
        items={freeUse}
      />
    </div>
  );
}
