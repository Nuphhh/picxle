// Grades a guess (or records a skip). Logic: src/application/submit-guess.ts.
import { handlers } from "@/src/composition/server";

export const dynamic = "force-dynamic";

export const POST = handlers.guess;
