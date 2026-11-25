// Records a finished game for the stats. Logic: src/application/stats.ts.
import { handlers } from "@/src/composition/server";

export const dynamic = "force-dynamic";

export const POST = handlers.recordStats;
