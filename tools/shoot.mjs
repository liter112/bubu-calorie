/* 用 CDP 驱动无头 Edge：精确设置视口、截图、抓控制台错误。
   用法：node shoot.mjs <url> <out.png> <width> <height> [js] */
import { spawn } from "node:child_process";
import fs from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = process.argv[2];
const out = process.argv[3];
const W = parseInt(process.argv[4] || "420", 10);
const H = parseInt(process.argv[5] || "900", 10);
const evalJs = process.argv[6] || "";
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return r.json();
}

const proc = spawn(EDGE, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run",
  "--disable-extensions", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=D:/food/tools/ep-cdp-${Date.now()}`,
  "about:blank",
], { stdio: "ignore" });

let target = null;
for (let i = 0; i < 60; i++) {
  await sleep(300);
  try {
    const list = await httpJson("/json/list");
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch { /* not ready */ }
}
if (!target) { console.error("no target"); proc.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const logs = [];
const errors = [];

function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const txt = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
    logs.push(msg.params.type + ": " + txt);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails.text + " " +
      (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ""));
  }
});

await new Promise((res) => ws.addEventListener("open", res));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: W, height: H, deviceScaleFactor: 1, mobile: W < 600,
});
await send("Page.navigate", { url });
await sleep(1800);
if (evalJs) {
  await send("Runtime.evaluate", { expression: evalJs, awaitPromise: true });
  await sleep(900);
}
const metrics = await send("Runtime.evaluate", {
  expression: "JSON.stringify({h: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), w: document.documentElement.clientWidth})",
  returnByValue: true,
});
const m = JSON.parse(metrics.result.value);
const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: m.w, height: Math.min(m.h, 6000), scale: 1 },
});
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`saved ${out} ${m.w}x${Math.min(m.h, 6000)}`);
if (errors.length) console.log("JS ERRORS:\n" + errors.join("\n"));
const bad = logs.filter((l) => l.startsWith("error"));
if (bad.length) console.log("CONSOLE ERRORS:\n" + bad.join("\n"));
ws.close();
proc.kill();
await sleep(300);
process.exit(0);
