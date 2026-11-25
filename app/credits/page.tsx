// Image credits / attributions screen.
// CC-BY (and CC-BY-SA) images legally require crediting the author + license +
// a link to the source. We deliberately DO NOT show the puzzle answer here —
// that would spoil future puzzles — only the author, licence and a source link.
//
// The page itself is just the UI: WHICH images to list (finished puzzles only,
// one per image, no Picxle originals, sorted) is the listCredits use case.
import type { Metadata } from "next";
import { listCredits } from "@/src/application/credits";
import { serverDeps } from "@/src/composition/server";
import { isFreeUse, needsCredit, sourceLink, type CreditEntry } from "@/src/domain/credits";

export const metadata: Metadata = {
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

const LICENSE_LINKS = {
  "CC-BY": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "PD": "https://en.wikipedia.org/wiki/Public_domain",
};

async function getCredits(): Promise<CreditEntry[]> {
  try {
    return await listCredits(serverDeps);
  } catch {
    return []; // the page shows "temporarily unavailable" instead of crashing
  }
}

function Group({ title, note, items }: { title: string; note: string; items: CreditEntry[] }) {
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
            <a href={sourceLink(r.imageSrc)} target="_blank" rel="noopener noreferrer"
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
  const freeUse = credits.filter((r) => isFreeUse(r.license));
  const attributed = credits.filter((r) => needsCredit(r.license));

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
        Many Picxle puzzles use openly-licensed images by other creators, mostly from{" "}
        <a href="https://commons.wikimedia.org" style={{ color: blue }}>Wikimedia Commons</a>.
        Public-domain and CC0 images carry no conditions; CC&nbsp;BY images are used
        with credit to their authors below. Each “source” link opens the original
        file, where the full licence and author details live.
      </p>
      <p style={{ fontSize: 14, color: dim }}>
        So nothing gets spoiled, puzzles are listed here once their day is over.
        Today&apos;s image is credited on the results screen when you finish.
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
