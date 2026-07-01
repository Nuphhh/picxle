// Per-puzzle share page. Its only job is to carry the right Open Graph image for
// a shared result (that day's 8x8 teaser) and then send the visitor to the game.
import ShareRedirect from "./ShareRedirect";

export async function generateMetadata({ params }) {
  const { date } = await params;
  const img = `/api/og?d=${encodeURIComponent(date)}`;
  const desc = "Can you guess this pixelated image? Play today's Picxle.";
  return {
    metadataBase: new URL("https://picxle.vercel.app"),
    title: "Picxle — can you guess it?",
    description: desc,
    openGraph: { title: "Picxle", description: desc, images: [img], type: "website", url: `/s/${date}` },
    twitter: { card: "summary_large_image", title: "Picxle", description: desc, images: [img] },
  };
}

export default function SharePage() {
  return <ShareRedirect />;
}
