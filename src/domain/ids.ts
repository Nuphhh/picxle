// IDs get pasted into database query strings, so anything that isn't a plain
// UUID is rejected up front. Without this, a "puzzleId" like
// "abc&select=answer" could rewrite the query and pull out the answer.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `value is string` is a "type guard": after `if (isUuid(x))`, TypeScript knows
// x is a string, even if it started out as `unknown`.
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);
