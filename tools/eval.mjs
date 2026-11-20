/* 在无头 Edge 里执行一段 JS 并打印结果（用于验证 localStorage 等浏览器行为） */
import { spawn } from "node:child_process";
import fs from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const url = process.argv[2];
let code = process.argv[3];
if (code && code.startsWith("file:")) code = fs.readFileSync(code.slice(5), "utf8");
const PORT = 9334;
const DIR = process.argv[4] || ("D:/food/tools/ep-eval-" + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(EDGE, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${DIR}`,
  "about:blank",
], { stdio: "ignore" });

let target = null;
for (let i = 0; i < 60; i++) {
  await sleep(300);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
    if (target) break;
  } catch {}
}
if (!target) { console.error("no target"); proc.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const errors = [];
const wsSend = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
};
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
  }
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.text);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
await wsSend("Runtime.enable");
await wsSend("Page.enable");
await wsSend("Page.navigate", { url });
await sleep(1600);
const r = await wsSend("Runtime.evaluate", { expression: code, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result.value, null, 1));
if (r.exceptionDetails) console.log("EXCEPTION", JSON.stringify(r.exceptionDetails));
if (errors.length) console.log("PAGE ERRORS", errors);
ws.close();
proc.kill();
await sleep(200);
process.exit(0);
