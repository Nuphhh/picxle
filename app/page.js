import Link from "next/link";

const C = {
  ink:      "#17130d",
  ink2:     "#221b12",
  cream:    "#f4ead7",
  creamDim: "#cdbfa6",
  amber:    "#3b82f6",
  line:     "#3a3024",
};

export default function LandingPage() {
  return (
    <div style={{
      background: `radial-gradient(140% 100% at 50% 0%, ${C.ink2} 0%, ${C.ink} 55%)`,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "var(--font-space-mono), monospace",
      color: C.cream,
    }}>

      {/* Logo */}
      <h1 style={{
        fontFamily: "var(--font-bricolage), sans-serif",
        fontWeight: 800,
        fontSize: "clamp(52px, 14vw, 96px)",
        letterSpacing: "-2px",
        margin: "0 0 8px",
        lineHeight: 1,
        color: C.cream,
      }}>
        PIC<span style={{ color: C.amber }}>X</span>LE
      </h1>

      {/* Tagline */}
      <p style={{ fontSize: "clamp(11px, 3vw, 13px)", letterSpacing: "2px", color: C.creamDim, margin: "0 0 48px", textAlign: "center" }}>
        GUESS THE IMAGE · IT SHARPENS AS YOU MISS
      </p>

      {/* Pixelation step visual */}
      <div style={{ display: "flex", gap: 4, marginBottom: 48 }}>
        {[{ label: "7px" }, { label: "11px" }, { label: "17px" }, { label: "26px" }, { label: "✓" }].map(({ label }, i) => (
          <div key={i} style={{
            width: 44, height: 44, borderRadius: 6,
            background: `rgba(244,234,215,${0.03 + i * 0.04})`,
            border: `1px solid rgba(244,234,215,${0.06 + i * 0.05})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: C.creamDim, letterSpacing: "0.5px",
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: C.creamDim, maxWidth: 280, textAlign: "center", lineHeight: 1.8, margin: "0 0 40px" }}>
        One puzzle a day. Five guesses. Each wrong answer sharpens the image one step closer to the answer.
      </p>

      {/* CTA */}
      <Link href="/play" style={{
        display: "block", textAlign: "center",
        padding: "16px 0", borderRadius: 10,
        background: C.cream, color: C.ink,
        fontFamily: "var(--font-bricolage), sans-serif",
        fontWeight: 800, fontSize: 18,
        textDecoration: "none",
        width: "100%", maxWidth: 300,
        letterSpacing: "-0.5px",
      }}>
        Play today&apos;s puzzle
      </Link>

    </div>
  );
}
