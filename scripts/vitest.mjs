// Starts Vitest with the drive letter of the working folder in upper case.
//
// Why: VS Code on Windows often opens terminals as "c:\..." while Node spells
// some paths "C:\...". Vitest then loads itself twice, once per spelling, and
// every test fails with "Vitest failed to find the current suite". Fixing the
// spelling before Vitest starts means there's only ever one copy.
import { pathToFileURL } from "node:url";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
process.chdir(cwd);
await import(pathToFileURL(`${cwd}/node_modules/vitest/vitest.mjs`).href);
