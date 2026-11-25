// Hands out the answer once the day is over or the player has finished. Logic: src/application/reveal-answer.ts.
import { handlers } from "@/src/composition/server";

export const dynamic = "force-dynamic";

export const GET = handlers.reveal;
