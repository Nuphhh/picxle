// ADAPTER: PuzzleRepository backed by the Supabase `puzzles` table.
// The database uses snake_case column names; the rest of the app uses
// camelCase. Translating between the two happens here and nowhere else.
import type { PuzzleRepository } from "@/src/application/ports";
import { q, rows, type RestFetch } from "./rest";

// The shape of a row as Supabase sends it. Each query selects only some columns.
interface PuzzleRow {
  id: string;
  puzzle_date: string;
  category: string;
  license: string | null;
  attribution: string | null;
  image_src: string | null;
  answer: string;
  accepts: string[] | null;
}

export function supabasePuzzleRepository(rest: RestFetch): PuzzleRepository {
  // Fetch the first row matching `filter`, with only the `columns` asked for.
  // Pick<PuzzleRow, K> = "a PuzzleRow, but only those columns".
  async function first<K extends keyof PuzzleRow>(filter: string, columns: K[]): Promise<Pick<PuzzleRow, K> | null> {
    const res = await rest(`puzzles?${filter}&select=${columns.join(",")}`);
    return (await rows<Pick<PuzzleRow, K>>(res))[0] ?? null;
  }

  return {
    async summaryByDate(day) {
      const r = await first(`puzzle_date=eq.${q(day)}`, ["id", "puzzle_date", "category", "license"]);
      return r && { id: r.id, date: r.puzzle_date, category: r.category, license: r.license };
    },

    async idByDate(day) {
      return (await first(`puzzle_date=eq.${q(day)}`, ["id"]))?.id ?? null;
    },

    async acceptedAnswers(puzzleId) {
      const r = await first(`id=eq.${q(puzzleId)}`, ["accepts"]);
      return r && (r.accepts ?? []);
    },

    async reveal(puzzleId) {
      const r = await first(`id=eq.${q(puzzleId)}`, ["answer", "puzzle_date", "license", "attribution"]);
      return r && { answer: r.answer, date: r.puzzle_date, license: r.license, attribution: r.attribution };
    },

    async image(puzzleId) {
      const r = await first(`id=eq.${q(puzzleId)}`, ["image_src", "puzzle_date", "category"]);
      return r?.image_src ? { imageSrc: r.image_src, date: r.puzzle_date, category: r.category } : null;
    },

    async imageByDate(day) {
      const r = await first(`puzzle_date=eq.${q(day)}`, ["image_src", "puzzle_date", "category"]);
      return r?.image_src ? { imageSrc: r.image_src, date: r.puzzle_date, category: r.category } : null;
    },

    async creditsBefore(day) {
      const res = await rest(`puzzles?puzzle_date=lt.${q(day)}&select=image_src,license,attribution`);
      if (!res.ok) return [];
      const list = await rows<Pick<PuzzleRow, "image_src" | "license" | "attribution">>(res);
      return list.map((r) => ({ imageSrc: r.image_src ?? "", license: r.license, attribution: r.attribution }));
    },
  };
}
