// Verify sharing behaves per device: the OS share sheet on a phone, a plain
// clipboard copy on a desktop. navigator.share EXISTS on Windows Chrome, so the
// old `if (navigator.share)` check pushed desktop users into the OS app-picker
// just to hand over a line of emoji.
//
// Each case stubs navigator.share, clicks the button, and reports which path ran.
const BASE = "http://localhost:3000";
const today = await fetch(`${BASE}/api/puzzle/today`).then((r) => r.json());
// Mark yesterday's finished too, or the app shows the "you missed yesterday's"
// prompt on load and we never reach the results screen with the share button.
const yest = await fetch(`${BASE}/api/puzzle/yesterday`).then((r) => r.json()).catch(() => ({}));

const t = await fetch("http://127.0.0.1:9223/json").then((r) => r.json());
const page = t.find((x) => x.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let i = 0; const p = new Map();
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); } };
const send = (m, pa = {}) => { const id = ++i; return new Promise((r) => { p.set(id, r); ws.send(JSON.stringify({ id, method: m, params: pa })); }); };
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Network domain MUST be enabled or setUserAgentOverride is silently ignored and
// every case runs with the real (Windows) user agent.
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");

const WON = JSON.stringify({ guesses: [{ text: "a", correct: true, skipped: false }], status: "won" });

async function run(name, { mobile, ua, coarse }, expect) {
  await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 400 : 1280, height: 900, deviceScaleFactor: 1, mobile: !!mobile });
  // userAgentMetadata must be COMPLETE — Chrome ignores a partial object, and
  // then navigator.userAgentData.mobile stays false and every case looks desktop.
  await send("Network.setUserAgentOverride", {
    userAgent: ua,
    userAgentMetadata: {
      platform: mobile ? "Android" : "Windows",
      platformVersion: mobile ? "14" : "10.0.0",
      architecture: mobile ? "" : "x86",
      model: mobile ? "Pixel 8" : "",
      mobile: !!mobile,
      brands: [{ brand: "Chromium", version: "149" }],
      fullVersion: "149.0.0.0",
    },
  });
  // Stub Web Share + clipboard BEFORE the app mounts, and record which one fires.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__shared = false; window.__copied = null;
      navigator.share = (d) => { window.__shared = true; return Promise.resolve(); };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
      });
      try {
        localStorage.setItem('picxle-${today.id}', ${JSON.stringify(WON)});
        localStorage.setItem('picxle-${yest.id}', ${JSON.stringify(WON)});
      } catch {}
    `,
  });
  await send("Page.navigate", { url: `${BASE}/play` });
  await sleep(4000);

  const label = await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>/SHARE RESULT|COPY RESULT/.test(x.innerText));return b?b.innerText.trim():null;})()`);
  await ev(`[...document.querySelectorAll("button")].find(x=>/SHARE RESULT|COPY RESULT/.test(x.innerText))?.click()`);
  await sleep(1200);
  const shared = await ev("window.__shared");
  const copied = await ev("window.__copied");

  const path = shared ? "OS share sheet" : copied ? "clipboard copy" : "NOTHING";
  const pass = path === expect.path && label === expect.label;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      button: "${label}"  ->  ${path}   (expected "${expect.label}" -> ${expect.path})`);
  if (copied) console.log(`      copied: ${JSON.stringify(copied.split("\n")[0])} + grid + link`);
  return pass;
}

const r = [];
r.push(await run("Windows desktop Chrome (navigator.share EXISTS)",
  { mobile: false, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36" },
  { path: "clipboard copy", label: "COPY RESULT" }));

r.push(await run("Android phone Chrome",
  { mobile: true, ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36" },
  { path: "OS share sheet", label: "SHARE RESULT" }));

r.push(await run("Android app (Capacitor WebView)",
  { mobile: true, ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.0.0 Mobile Safari/537.36 wv)" },
  { path: "OS share sheet", label: "SHARE RESULT" }));

console.log(`\n${r.filter(Boolean).length}/${r.length} passed`);
ws.close();
process.exit(r.every(Boolean) ? 0 : 1);
