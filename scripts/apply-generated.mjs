// One-off: point the 4 previously-CC-BY-SA puzzles at the AI-generated images
// now served from picxle.vercel.app/puzzles, with clean CC0 licensing.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows = [
  { id: "52d76dc0-f59b-492e-9785-6fc45ee56017", answer: "mango",           file: "mango.jpg" },
  { id: "411ae429-85b6-4678-b571-0de9d1cd400c", answer: "gorilla",         file: "gorilla.jpg" },
  { id: "7a0f88bb-2075-46e8-9c0c-471ee8485d82", answer: "narwhal",         file: "narwhal.jpg" },
  { id: "1e2ab0a5-1b58-4d4f-8c80-3f77f9c88b0a", answer: "sagrada familia", file: "sagrada-familia.jpg" },
];

let ok = 0;
for (const r of rows) {
  const { error } = await supabase.from("puzzles").update({
    image_src: `https://picxle.vercel.app/puzzles/${r.file}`,
    license: "CC0",
    attribution: "Picxle original (AI-generated)",
  }).eq("id", r.id);
  if (error) console.error("FAIL", r.answer, error.message); else { ok++; console.log("ok", r.answer); }
}
console.log(`Updated ${ok}/${rows.length}`);
const { data } = await supabase.from("puzzles").select("license");
const mix = data.reduce((m, x) => ((m[x.license] = (m[x.license] || 0) + 1), m), {});
console.log("License mix:", mix);
