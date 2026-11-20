/* 迁移测试：老版本存档（没有 onboarded 字段）不能被强制引导，数据也不能丢 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const JS_DIR = path.join(ROOT, "src", "js");

function makeSandbox() {
  const store = new Map();
  const sb = {
    console,
    setTimeout,
    clearTimeout,
    document: {
      readyState: "complete",
      body: { appendChild() {}, removeChild() {} },
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() {
        return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
          appendChild() {}, addEventListener() {}, setAttribute() {}, getAttribute() { return null; } };
      },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  sb.window = sb;
  sb.globalThis = sb;
  return sb;
}

const files = ["data-foods.js", "data-targets.js", "data-cooking.js", "data-tips.js",
  "engine.js", "library.js", "store.js"];

function load(ctx) {
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), "utf8"), ctx, { filename: f });
  }
}

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log("  ok  " + name);
  else { failed++; console.log("  FAIL " + name + (detail === undefined ? "" : " -> " + detail)); }
}

/* 1. 全新浏览器：isFirstRun 为 true，onboarded 为 false */
{
  const sb = makeSandbox();
  vm.createContext(sb);
  load(sb);
  const S = sb.Nutri.store;
  check("新用户 isFirstRun() = true", S.isFirstRun() === true);
  check("新用户 onboarded = false", S.load().onboarded === false, S.load().onboarded);
}

/* 2. 老版本存档（无 onboarded 字段）：视为已完成引导，档案与记录都在 */
{
  const sb = makeSandbox();
  const old = {
    version: 1,
    profile: { sex: "f", age: 19, height: 156.5, weight: 64, activity: 1.375, goal: "fatloss", deficit: 500 },
    days: { "2026-11-19": { items: [{ uid: "x", name: "胡萝卜", grams: 100, kcal: 39, n: { kcal: 39 } }], checkedIn: true } },
    streak: { count: 3, best: 7, lastDate: "2026-11-19" },
    xp: 240, favorites: [], tipSeen: [],
    settings: { usdaKey: "ABC", usdaEnabled: true },
  };
  sb.localStorage.setItem("nutri.state.v1", JSON.stringify(old));
  vm.createContext(sb);
  load(sb);
  const S = sb.Nutri.store;
  check("老用户 isFirstRun() = false", S.isFirstRun() === false);
  const st = S.load();
  check("老用户自动标记 onboarded", st.onboarded === true, st.onboarded);
  check("老用户档案保留", st.profile.age === 19 && st.profile.weight === 64);
  check("老用户打卡保留", st.days["2026-11-19"].checkedIn === true && st.streak.count === 3);
  check("老用户 KEY 保留", st.settings.usdaKey === "ABC");
}

/* 3. 导出备份时剔除 KEY，导入可还原 */
{
  const sb = makeSandbox();
  vm.createContext(sb);
  load(sb);
  const S = sb.Nutri.store;
  S.finishOnboarding({ sex: "m", age: 28, height: 180, weight: 78, activity: 1.55, goal: "gain", surplus: 300 });
  S.setSettings({ usdaKey: "SECRET" });
  const exported = S.exportState();
  check("导出不含 USDA KEY", exported.indexOf("SECRET") === -1);
  const imported = S.importState(exported);
  check("导入成功", imported.ok === true, JSON.stringify(imported));
  check("导入后档案正确", sb.Nutri.store.load().profile.sex === "m");
  const bad = S.importState("{不是 json");
  check("坏文件被拒绝", bad.ok === false);
}

console.log(failed ? "\nFAILURES: " + failed : "\nMIGRATION TESTS PASSED");
process.exit(failed ? 1 : 0);
