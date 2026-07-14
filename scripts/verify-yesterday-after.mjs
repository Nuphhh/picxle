// Drive the reviewer's exact journey: finish today's puzzle, then check that
// yesterday's is offered on the RESULTS screen (not just before today's), and
// that clicking it actually resumes/starts that puzzle.
//
//   A. declined the pre-game prompt, then finished today -> STILL offered after
//   B. part-way through yesterday, finished today        -> offered as "Resume (n/5)"
//   C. yesterday already finished                        -> NOT offered
const BASE = "http://localhost:3000";
const today = await fetch(`${BASE}/api/puzzle/today`).then((r) => r.json());
const yest = await fetch(`${BASE}/api/puzzle/yesterday`).then((r) => r.json());

const t = await fetch("http://127.0.0.1:9223/json").then((r) => r.json());
const page = t.find((x) => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let i = 0; const p = new Map();
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); } };
const send = (m, pa = {}) => { const id = ++i; return new Promise((r) => { p.set(id, r); ws.send(JSON.stringify({ id, method: m, params: pa })); }); };
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable"); await send("Runtime.enable");

const won = (n) => JSON.stringify({
  guesses: [...Array(n - 1)].map(() => ({ text: "wrong", correct: false, skipped: false }))
    .concat([{ text: "right", correct: true, skipped: false }]),
  status: "won",
});
const partway = (n) => JSON.stringify({
  guesses: [...Array(n)].map(() => ({ text: "wrong", correct: false, skipped: false })),
  status: "playing",
});

async function scenario(name, setup, expect) {
  await send("Page.navigate", { url: `${BASE}/play` });
  await sleep(2000);
  await ev(`(() => { localStorage.clear(); ${setup} return 1; })()`);
  await send("Page.navigate", { url: `${BASE}/play` });
  await sleep(4000);
  const text = await ev("document.body.innerText");
  const btn = (text.match(/(Resume yesterday's \(\d\/\d\) →|Play yesterday's puzzle →)/) || [])[0] || null;
  const offered = !!btn;
  const pass = offered === expect.offered && (!expect.label || btn === expect.label);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      offered after today: ${offered} (expected ${expect.offered})  button: ${btn ?? "-"}`);
  return { pass, btn };
}

const results = [];
results.push((await scenario(
  "A. declined before today's, then finished today",
  `localStorage.setItem('picxle-${today.id}', ${JSON.stringify(won(1))});
   localStorage.setItem('picxle-declined-${yest.id}', '1');`,
  { offered: true, label: "Play yesterday's puzzle →" },
)).pass);

// Part-played AND declined: on a fresh load the pre-game prompt is correctly
// skipped (they said not now), so the results screen must be the thing that
// offers it back — and it must say how far they got.
results.push((await scenario(
  "B. two guesses into yesterday's, declined prompt, finished today",
  `localStorage.setItem('picxle-${today.id}', ${JSON.stringify(won(3))});
   localStorage.setItem('picxle-${yest.id}', ${JSON.stringify(partway(2))});
   localStorage.setItem('picxle-declined-${yest.id}', '1');`,
  { offered: true, label: "Resume yesterday's (2/5) →" },
)).pass);

// Not declined and part-played: the PRE-GAME prompt should still take precedence
// on a fresh load. (Guards against the new results-screen offer stealing it.)
results.push((await scenario(
  "B2. part-played, not declined -> pre-game prompt still shown first",
  `localStorage.setItem('picxle-${today.id}', ${JSON.stringify(won(3))});
   localStorage.setItem('picxle-${yest.id}', ${JSON.stringify(partway(2))});`,
  { offered: false }, // results-screen button absent: the interstitial is showing instead
)).pass);

results.push((await scenario(
  "C. yesterday's already finished",
  `localStorage.setItem('picxle-${today.id}', ${JSON.stringify(won(2))});
   localStorage.setItem('picxle-${yest.id}', ${JSON.stringify(won(4))});`,
  { offered: false },
)).pass);

// D. clicking it actually opens yesterday's puzzle, with guesses restored
await send("Page.navigate", { url: `${BASE}/play` });
await sleep(2000);
await ev(`(() => { localStorage.clear();
  localStorage.setItem('picxle-${today.id}', ${JSON.stringify(won(2))});
  localStorage.setItem('picxle-${yest.id}', JSON.stringify({guesses:[{text:"tulip",correct:false,skipped:false},{text:"rose",correct:false,skipped:false}],status:"playing"}));
  return 1; })()`);
await send("Page.navigate", { url: `${BASE}/play` });
await sleep(4000);
await ev(`[...document.querySelectorAll("button")].find(b=>/yesterday/i.test(b.innerText))?.click()`);
await sleep(3500);
const body = await ev("document.body.innerText");
const ok = /tulip/i.test(body) && /rose/i.test(body) && /SHARPNESS/.test(body);
console.log(`${ok ? "PASS" : "FAIL"}  D. clicking it resumes yesterday's with guesses intact`);
console.log(`      tulip restored: ${/tulip/i.test(body)}  rose restored: ${/rose/i.test(body)}  playable: ${/SHARPNESS/.test(body)}`);
results.push(ok);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
ws.close();
process.exit(results.every(Boolean) ? 0 : 1);
