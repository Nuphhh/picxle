import { ImageResponse } from "next/og";
import sharp from "sharp";

// Must be nodejs (not edge) so sharp can run
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Refresh every hour so it switches to the next puzzle within an hour of midnight UTC
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
  let pixelatedDataUrl = null;

  try {
    const imageUrl = await fetchTodayImageUrl();
    if (imageUrl) {
      const imageRes = await fetch(imageUrl);
      const buffer = Buffer.from(await imageRes.arrayBuffer());

      // Crop to square, downsample to 8×8, upscale to 630×630 with nearest-neighbour
      // so each of the 64 pixels becomes a 78×78 block — exactly the pixelation effect
      const pixelated = await sharp(buffer)
        .resize(8, 8, { fit: "cover", kernel: sharp.kernel.nearest })
        .resize(630, 630, { fit: "fill", kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();

      pixelatedDataUrl = `data:image/png;base64,${pixelated.toString("base64")}`;
    }
  } catch {}

  if (pixelatedDataUrl) {
    return new ImageResponse(
      <div style={{
        width: "100%",
        height: "100%",
        background: "#17130d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <img src={pixelatedDataUrl} style={{ width: 630, height: 630 }} />
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
