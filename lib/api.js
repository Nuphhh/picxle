// Prepends the API base URL so fetch calls work in both web (relative)
// and mobile (absolute, pointing at the Vercel deployment).
// NEXT_PUBLIC_API_BASE is set only for mobile builds; web builds leave it
// unset so relative paths are used and Vercel routes them correctly.
const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const apiUrl = (path) => `${base}${path}`;
