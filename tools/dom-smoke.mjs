/* 最小 DOM 垫片：在 Node 里跑一遍页面逻辑，抓运行时错误。 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const JS_DIR = path.join(ROOT, "src", "js");

class El {
  constructor(tag = "div", id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this._html = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.files = [];
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  addEventListener() {}
  removeEventListener() {}
  setAttribute(k, v) { this.dataset[k] = v; if (k === "id") this.id = v; }
  getAttribute(k) { return this.dataset[k] !== undefined ? this.dataset[k] : null; }
  closest() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() {}
  click() {}
  setSelectionRange() {}
  getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
}

const registry = new Map();
function elFor(id) {
  if (!registry.has(id)) registry.set(id, new El("div", id));
  return registry.get(id);
}

const listeners = {};
const document = {
  readyState: "complete",
  hidden: false,
  body: new El("body"),
  documentElement: new El("html"),
  createElement: (t) => new El(t),
  getElementById: elFor,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  removeEventListener() {},
};

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const windowObj = globalThis;
windowObj.localStorage = localStorage;
windowObj.document = document;
windowObj.location = { hash: "" };
windowObj.window = globalThis;
windowObj.setTimeout = (fn) => setTimeout(fn, 0);
windowObj.clearTimeout = clearTimeout;
windowObj.fetch = () => Promise.reject(new Error("offline"));
windowObj.Blob = class { constructor(parts) { this.parts = parts; } };
windowObj.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
windowObj.requestAnimationFrame = (fn) => setTimeout(fn, 0);
windowObj.scrollTo = () => {};
windowObj.addEventListener = () => {};
windowObj.innerWidth = 1200;

globalThis.location = windowObj.location;
globalThis.fetch = windowObj.fetch;
globalThis.Blob = windowObj.Blob;
globalThis.URL = windowObj.URL;

const files = [
  "data-foods.js", "data-targets.js", "data-cooking.js", "data-tips.js",
  "engine.js", "library.js", "store.js", "recommend.js", "usda.js",
  "mascot.js", "ui.js", "selftest.js", "app.js",
];

const ctx = vm.createContext(globalThis);
for (const f of files) {
  const code = fs.readFileSync(path.join(JS_DIR, f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}

const Nutri = globalThis.Nutri;
const errors = [];
function step(name, fn) {
  try { fn(); console.log("  ok  " + name); }
  catch (e) { errors.push(name + ": " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); console.log("  ERR " + name + " -> " + e.message); }
}

console.log("data: foods=" + Nutri.foods.length);

step("ui.init", () => Nutri.ui.init());
for (const t of ["home", "log", "analysis", "library", "settings"]) {
  step("tab:" + t, () => Nutri.ui.switchTab(t));
}

step("compute carrot stirfry", () => {
  const c = Nutri.foods.find((f) => f.name.startsWith("胡萝卜（红")) || Nutri.foods[0];
  const r = Nutri.engine.compute(c, 150, "stirfry");
  if (!(r.kcal > 0)) throw new Error("kcal 异常");
  console.log("     胡萝卜150g爆炒 =", r.kcal, "kcal, 油", r.oil, "g, 熟重", r.cookedGrams, "g");
});

step("add item + home render", () => {
  const c = Nutri.foods.find((f) => f.name.startsWith("胡萝卜（红"));
  const r = Nutri.engine.compute(c, 150, "stirfry");
  r.food = c;
  Nutri.store.addItem(r);
  Nutri.ui.switchTab("home");
});

step("analysis after item", () => Nutri.ui.switchTab("analysis"));
step("check-in", () => {
  const res = Nutri.store.checkIn();
  if (!res.ok) throw new Error("打卡失败: " + res.reason);
  Nutri.ui.switchTab("home");
});
step("food modal", () => Nutri.ui.foodModal(Nutri.foods[5].id));
step("library append/validate", () => {
  const v = Nutri.library.validate([{ name: "X", per100: { kcal: 10 } }]);
  if (!v.ok) throw new Error("校验误报");
  const a = Nutri.library.append([{ name: "X", per100: { kcal: 10 } }]);
  if (!a.ok) throw new Error("追加失败");
});
step("selftest", () => Nutri.selftest.run());
step("recommend dailyTen", () => {
  const t = Nutri.computeTargets(Nutri.DEFAULT_PROFILE);
  const list = Nutri.recommend.dailyTen({ kcal: 500, protein: 20, fiber: 5, calcium: 200, iron: 3, vc: 10, va: 100, potassium: 500, vegFruitGrams: 100, itemCount: 1, b12: 0 }, t, "2026-11-20", []);
  if (list.length !== 10) throw new Error("推荐数量 " + list.length);
});

console.log("\n" + (errors.length ? "FAILURES: " + errors.length : "ALL GOOD"));
errors.forEach((e) => console.log(" - " + e));
process.exit(errors.length ? 1 : 0);
