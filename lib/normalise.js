// Normalise a guess for comparison.
//
// SHARED by the client and the server on purpose: the client uses it to decide
// whether a word is typeable at all (it blocks anything not in the dictionary),
// and the server uses it to decide whether a guess is correct. If the two ever
// disagreed, a player could type a word the server would accept and be told it
// is not a word — which is exactly the bug this replaced.
//
// Folds accents rather than deleting them. The old version stripped anything
// outside [a-z ], so "família" became "famlia" and "iguaçu" became "iguau":
// anyone typing the correctly-accented spelling got their right answer rejected.
// NFD splits "í" into "i" + a combining accent, so dropping the combining marks
// leaves a clean "i".
export function normaliseGuess(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // é->e, í->i, ç->c, ã->a
    .toLowerCase()
    .replace(/['’`]/g, "")      // basil's -> basils (apostrophe joins the word)
    .replace(/[^a-z0-9]+/g, " ")     // hyphens etc SEPARATE: mont-saint-michel -> mont saint michel
    .replace(/\s+/g, " ")
    .trim();
}
