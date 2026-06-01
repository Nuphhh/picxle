import PicxleGame from "@/components/PicxleGame";

// This is a Server Component — it runs on the server and just hands off to the
// PicxleGame Client Component, which handles all the interactive game logic.
export default function Home() {
  return <PicxleGame />;
}
