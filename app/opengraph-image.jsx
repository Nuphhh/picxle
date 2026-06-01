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
          alignItems: "center",
          justifyContent: "center",
          background: "#17130d",
        }}
      >
        {/* X mark — two crossing strokes */}
        <div style={{ display: "flex", width: 340, height: 340, position: "relative" }}>
          <div style={{
            position: "absolute", top: 0, left: "50%",
            width: 72, height: 480,
            background: "#3b82f6",
            borderRadius: 36,
            transform: "translateX(-50%) rotate(45deg)",
            transformOrigin: "center",
          }} />
          <div style={{
            position: "absolute", top: 0, left: "50%",
            width: 72, height: 480,
            background: "#3b82f6",
            borderRadius: 36,
            transform: "translateX(-50%) rotate(-45deg)",
            transformOrigin: "center",
          }} />
        </div>
      </div>
    ),
    size
  );
}
