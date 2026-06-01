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
        <svg width="320" height="320" viewBox="0 0 100 100">
          <line x1="18" y1="18" x2="82" y2="82" stroke="#3b82f6" strokeWidth="17" strokeLinecap="round"/>
          <line x1="82" y1="18" x2="18" y2="82" stroke="#3b82f6" strokeWidth="17" strokeLinecap="round"/>
        </svg>
      </div>
    ),
    size
  );
}
