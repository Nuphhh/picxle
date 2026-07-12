// Drive the real app to verify the "resume yesterday's puzzle" rules:
//   1. never opened          -> offer shown ("Play yesterday's")
//   2. opened, 0 guesses     -> offer STILL shown  (this was the bug)
//   3. part-way, 2 guesses   -> offer shown as "Resume yesterday's (2/5)"
//   4. finished (won/lost)   -> NO offer
//   5. explicitly declined   -> NO offer
const BASE = "http://localhost:3000";
const y = await fetch(`${BASE}/api/puzzle/yesterday`).then((r) => r.json());
const YID = y.id;

const targets = await fetch("http://127.0.0.1:9223/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let _id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result); pending.delete(msg.id); } };
const send = (method, params = {}) => { const id = ++_id; return new Promise((res) => { pending.set(id, { resolve: res }); ws.send(JSON.stringify({ id, method, params })); }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable"); await send("Runtime.enable");

async function scenario(name, setup, expect) {
  await send("Page.navigate", { url: `${BASE}/play` });
  await sleep(2500);
  await evalJs(`(() => { localStorage.clear(); ${setup} return 1; })()`);
  await send("Page.navigate", { url: `${BASE}/play` });
  await sleep(3500);
  const text = await evalJs(`document.body.innerText`);
  const offered = /yesterday/i.test(text) && /(Play yesterday|Resume yesterday)/i.test(text);
  const btn = (text.match(/(Resume yesterday's \(\d\/\d\)|Play yesterday's)/) || [])[0] || "-";
  const pass = offered === expect.offered && (!expect.button || btn === expect.button);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      offer shown: ${offered} (expected ${expect.offered})   button: "${btn}"${expect.button ? ` (expected "${expect.button}")` : ""}`);
  return pass;
}

const g = (n) => JSON.stringify(Array.from({ length: n }, () => ({ text: "wrong", correct: false, skipped: false })));
const results = [];
results.push(await scenario("1. never opened", ``, { offered: true, button: "Play yesterday's" }));
results.push(await scenario("2. opened but 0 guesses (the bug)",
  `localStorage.setItem('picxle-${YID}', JSON.stringify({guesses:[],status:'playing'}));`,
  { offered: true, button: "Play yesterday's" }));
results.push(await scenario("3. part-way, 2 guesses",
  `localStorage.setItem('picxle-${YID}', JSON.stringify({guesses:${g(2)},status:'playing'}));`,
  { offered: true, button: "Resume yesterday's (2/5)" }));
results.push(await scenario("4. finished - won",
  `localStorage.setItem('picxle-${YID}', JSON.stringify({guesses:${g(3)},status:'won'}));`,
  { offered: false }));
results.push(await scenario("5. finished - lost",
  `localStorage.setItem('picxle-${YID}', JSON.stringify({guesses:${g(5)},status:'lost'}));`,
  { offered: false }));
results.push(await scenario("6. explicitly declined",
  `localStorage.setItem('picxle-declined-${YID}', '1');`,
  { offered: false }));
results.push(await scenario("7. declined but part-way (no means no)",
  `localStorage.setItem('picxle-${YID}', JSON.stringify({guesses:${g(2)},status:'playing'}));localStorage.setItem('picxle-declined-${YID}','1');`,
  { offered: false }));

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
ws.close(); process.exit(results.every(Boolean) ? 0 : 1);
