// A player's streak + guess distribution. Logic: src/application/stats.ts.
import { handlers } from "@/src/composition/server";

export const dynamic = "force-dynamic";

export const GET = handlers.playerStreak;
