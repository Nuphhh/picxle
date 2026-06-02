import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Revalidate every hour so the image refreshes shortly after midnight UTC
export const revalidate = 3600;

async function fetchTodayImageUrl() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/puzzles?puzzle_date=eq.${today}&select=image_src`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    }
  );
  const rows = await res.json();
  return rows?.[0]?.image_src ?? null;
}

export default async function OGImage() {
  let imageUrl = null;
  try { imageUrl = await fetchTodayImageUrl(); } catch {}

  if (imageUrl) {
    // Render at 8×8 pixels and scale up with imageRendering: pixelated
    // scale(150) → 1200×1200, centred in the 1200×630 frame, cropped by overflow:hidden
    return new ImageResponse(
      <div style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#17130d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}>
        <img
          src={imageUrl}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            imageRendering: "pixelated",
            transform: "scale(150)",
          }}
        />
      </div>,
      size
    );
  }

  // Fallback: X mark when no puzzle is available
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#17130d",
    }}>
      <svg width="320" height="320" viewBox="0 0 100 100">
        <line x1="18" y1="18" x2="82" y2="82" stroke="#3b82f6" strokeWidth="17" strokeLinecap="round"/>
        <line x1="82" y1="18" x2="18" y2="82" stroke="#3b82f6" strokeWidth="17" strokeLinecap="round"/>
      </svg>
    </div>,
    size
  );
}
