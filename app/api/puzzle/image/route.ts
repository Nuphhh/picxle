// Image proxy, so the image address (which often names the answer) never reaches the browser. Logic: src/application/puzzle-image.ts.
import { handlers } from "@/src/composition/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handlers.image;
