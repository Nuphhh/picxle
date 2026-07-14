// Exact pixelation, straight from the game's own canvas.
//
// sharp CANNOT reproduce this. The block grid, the centre-crop and the hard
// nearest-neighbour edges all match, but Chrome's canvas downscaler uses a
// different filter, so the BLOCK COLOURS come out ~5% off (worst channel 91/255).
// The only way to be exact is to run the game's pipeline in a real browser, which
// is exactly how the share teasers are built.
//
// The image is handed to the page as a data: URL so it is same-origin — no CORS,
// works for a local file or a remote URL we have already fetched.
//
// Callers get RAW rgb buffers back; sharp cannot infer an output format from raw
// input, so encode explicitly (.png()) before handing the result on.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";

const CHROME_CANDIDATES = [
  process.env.PICXLE_CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error(
    "--exact needs Google Chrome (it renders the stages through the game's own canvas).\n" +
    "Set PICXLE_CHROME to the binary, or drop --exact to use the sharp renderer."
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debugging port");
}

/**
 * Run the game's stage-1..5 pixelation in a real browser.
 * @returns {Promise<Array<{res:number, rgb:Buffer}>>} raw res*res*3 pixels per stage
 */
export async function exactStages(srcBuf, resSteps, { isFlag = false } = {}) {
  const chrome = findChrome();
  const port = 9200 + Math.floor(Math.random() * 300);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "picxle-clip-"));
  const proc = spawn(chrome, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore", detached: false });

  let ws;
  try {
    const wsUrl = await cdp(port);
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    };
    const send = (method, params = {}) =>
      new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

    await send("Runtime.enable");

    const dataUrl = `data:image/jpeg;base64,${srcBuf.toString("base64")}`;

    // This is the game's pipeline verbatim (components/PicxleGame.jsx):
    //   source -> 440px master (centre-crop; letterbox for flags), smoothing high
    //   master -> N x N with smoothing ON      <- the step sharp gets wrong
    //   the hard-edged upscale happens later, in sharp, with kernel:nearest
    const expr = `(async () => {
      const img = new Image();
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = ${JSON.stringify(dataUrl)}; });
      const s = document.createElement("canvas"); s.width = 440; s.height = 440;
      const ctx = s.getContext("2d");
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ${isFlag ? `
        const scale = Math.min(440 / img.naturalWidth, 440 / img.naturalHeight);
        const dw = Math.round(img.naturalWidth * scale), dh = Math.round(img.naturalHeight * scale);
        ctx.fillStyle = "#ede8de"; ctx.fillRect(0, 0, 440, 440);   // flags letterbox onto the card
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, Math.round((440-dw)/2), Math.round((440-dh)/2), dw, dh);
      ` : `
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, (img.naturalWidth-side)/2, (img.naturalHeight-side)/2, side, side, 0, 0, 440, 440);
      `}
      const out = [];
      for (const res of ${JSON.stringify(resSteps)}) {
        const t = document.createElement("canvas"); t.width = res; t.height = res;
        const tc = t.getContext("2d");
        tc.imageSmoothingEnabled = true;
        tc.drawImage(s, 0, 0, res, res);
        const d = tc.getImageData(0, 0, res, res).data;
        const rgb = [];
        for (let i = 0; i < res * res; i++) { rgb.push(d[i*4], d[i*4+1], d[i*4+2]); }
        out.push({ res, rgb });
      }
      return out;
    })()`;

    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails || r.result?.result?.subtype === "error") {
      throw new Error("the browser could not pixelate that image");
    }
    const stages = r.result?.result?.value;
    if (!Array.isArray(stages) || !stages.length) throw new Error("no stages returned from the browser");
    return stages.map((s) => ({ res: s.res, rgb: Buffer.from(s.rgb) }));
  } finally {
    try { ws?.close(); } catch {}
    try { proc.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}
