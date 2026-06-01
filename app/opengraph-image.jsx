import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #221b12 0%, #17130d 60%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Pixel step decorations */}
        <div style={{ display: "flex", gap: 10, marginBottom: 48 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                background: `rgba(244,234,215,${0.04 + i * 0.05})`,
                border: `1.5px solid rgba(244,234,215,${0.08 + i * 0.06})`,
              }}
            />
          ))}
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#f4ead7" }}>PIC</span>
          <span style={{ color: "#3b82f6" }}>X</span>
          <span style={{ color: "#f4ead7" }}>LE</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            letterSpacing: 6,
            color: "#cdbfa6",
            fontWeight: 400,
          }}
        >
          GUESS THE IMAGE · IT SHARPENS AS YOU MISS
        </div>
      </div>
    ),
    size
  );
}
