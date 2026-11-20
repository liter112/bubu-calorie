/* ===== 本地状态：打卡记录只存在本机，与食材库互不影响 ===== */
window.Nutri = window.Nutri || {};

Nutri.store = (function () {
  var KEY = "nutri.state.v1";
  var state = null;
  var storageOk = true;

  function blank() {
    return {
      version: 1,
      onboarded: false,
      profile: Object.assign({}, Nutri.DEFAULT_PROFILE),
      days: {},
      streak: { count: 0, best: 0, lastDate: null },
      xp: 0,
      favorites: [],
      tipSeen: [],
      settings: { oilType: "rapeseed", usdaKey: "", usdaEnabled: false, showRaw: true }
    };
  }

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      storageOk = false;
      return null;
    }
  }

  function migrate(s) {
    var b = blank();
    if (!s || typeof s !== "object") return b;
    var out = Object.assign({}, b, s);
    out.profile = Object.assign({}, b.profile, s.profile || {});
    out.settings = Object.assign({}, b.settings, s.settings || {});
    out.streak = Object.assign({}, b.streak, s.streak || {});
    if (!out.days || typeof out.days !== "object") out.days = {};
    if (!Array.isArray(out.favorites)) out.favorites = [];
    if (!Array.isArray(out.tipSeen)) out.tipSeen = [];
    if (typeof out.xp !== "number" || isNaN(out.xp)) out.xp = 0;
    /* 老版本没有 onboarded 字段：已有数据的老用户直接视为已完成引导 */
    out.onboarded = s.onboarded === undefined ? true : !!s.onboarded;
    return out;
  }

  function isFirstRun() {
    return read() === null;
  }

  function finishOnboarding(p) {
    var s = load();
    s.profile = Object.assign({}, s.profile, p || {});
    s.onboarded = true;
    save();
    return s.profile;
  }

  function exportState() {
    var s = load();
    var copy = JSON.parse(JSON.stringify(s));
    if (copy.settings) delete copy.settings.usdaKey;
    return JSON.stringify(copy, null, 1);
  }

  function importState(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: "JSON 解析失败：" + e.message }; }
    if (!obj || typeof obj !== "object") return { ok: false, error: "文件内容不是对象。" };
    if (!obj.days || typeof obj.days !== "object") return { ok: false, error: "缺少 days 字段，可能不是本应用的备份。" };
    if (!obj.profile || typeof obj.profile !== "object") return { ok: false, error: "缺少 profile 字段。" };
    state = migrate(obj);
    state.onboarded = true;
    save();
    return { ok: true, days: Object.keys(state.days).length };
  }

  function load() {
    if (state) return state;
    state = migrate(read());
    return state;
  }

  function save() {
    if (!state) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      storageOk = false;
    }
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function offsetKey(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return dateKey(d);
  }

  function today() { return dateKey(); }

  function day(key) {
    var s = load();
    var k = key || today();
    if (!s.days[k]) {
      s.days[k] = { items: [], checkedIn: false, tipId: null, xp: 0, quests: {} };
    }
    if (!Array.isArray(s.days[k].items)) s.days[k].items = [];
    if (!s.days[k].quests) s.days[k].quests = {};
    return s.days[k];
  }

  function dayStats(key) {
    var d = day(key);
    var t = Nutri.engine.sumItems(d.items);
    var veg = 0, fruit = 0;
    d.items.forEach(function (it) {
      if (!it || !it.grams) return;
      if (["leafy", "rootVeg", "fruitVeg", "mushroom"].indexOf(it.cat) >= 0) veg += it.grams;
      if (it.cat === "fruit") fruit += it.grams;
    });
    t.vegGrams = Math.round(veg * 10) / 10;
    t.fruitGrams = Math.round(fruit * 10) / 10;
    t.vegFruitGrams = Math.round((veg + fruit) * 10) / 10;
    t.itemCount = d.items.length;
    return t;
  }

  function totals(key) { return dayStats(key); }

  function addXp(n) {
    var s = load();
    s.xp = Math.max(0, (s.xp || 0) + n);
    return s.xp;
  }

  function levelOf(xp) { return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 120)); }
  function levelProgress(xp) {
    var lv = levelOf(xp);
    var cur = Math.pow(lv - 1, 2) * 120;
    var next = Math.pow(lv, 2) * 120;
    return { level: lv, cur: xp - cur, need: next - cur, pct: (xp - cur) / (next - cur) * 100 };
  }

  function addItem(result) {
    var s = load();
    var d = day();
    var item = {
      uid: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      foodId: result.food.id,
      name: result.food.name,
      cat: result.food.cat,
      grams: result.grams,
      method: result.method,
      methodName: result.methodName,
      oil: result.oil,
      sugar: result.sugar,
      salt: result.salt,
      cookedGrams: result.cookedGrams,
      n: result.n,
      kcal: result.kcal,
      ts: Date.now()
    };
    d.items.push(item);
    addXp(10);
    refreshQuests();
    save();
    return item;
  }

  function removeItem(uid) {
    var d = day();
    var idx = -1;
    for (var i = 0; i < d.items.length; i++) {
      if (d.items[i].uid === uid) { idx = i; break; }
    }
    if (idx >= 0) {
      d.items.splice(idx, 1);
      addXp(-10);
      refreshQuests();
      save();
    }
  }

  function questDefs(t) {
    var tgt = Nutri.computeTargets(load().profile);
    return [
      { id: "log5", label: "记录 5 种食物", xp: 20, done: day().items.length >= 5,
        progress: Math.min(1, day().items.length / 5) },
      { id: "veg500", label: "蔬菜水果吃够 500 g", xp: 20,
        done: (t.vegFruitGrams || 0) >= 500, progress: Math.min(1, (t.vegFruitGrams || 0) / 500) },
      { id: "protein", label: "蛋白质达到 " + tgt.protein + " g", xp: 20,
        done: (t.protein || 0) >= tgt.protein, progress: Math.min(1, (t.protein || 0) / tgt.protein) }
    ];
  }

  function refreshQuests() {
    var s = load();
    var d = day();
    var t = totals();
    var defs = questDefs(t);
    defs.forEach(function (q) {
      if (q.done && !d.quests[q.id]) {
        d.quests[q.id] = true;
        s.xp += q.xp;
        d.xp = (d.xp || 0) + q.xp;
      }
    });
    save();
    return defs;
  }

  function checkIn() {
    var s = load();
    var d = day();
    if (d.checkedIn) return { ok: false, reason: "already" };
    if (!d.items.length) return { ok: false, reason: "empty" };
    d.checkedIn = true;
    d.checkinAt = Date.now();
    addXp(50);
    d.xp = (d.xp || 0) + 50;
    var todayK = today();
    var yKey = offsetKey(-1);
    if (s.streak.lastDate === todayK) {
      /* 同一天重复打卡：不加天数 */
    } else if (s.streak.lastDate === yKey) {
      s.streak.count += 1;
    } else {
      s.streak.count = 1;
    }
    s.streak.lastDate = todayK;
    s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
    save();
    return { ok: true, streak: s.streak.count };
  }

  /* 打开页面时校正连续天数（断签则在展示上归零，但不改历史） */
  function streakLive() {
    var s = load();
    if (!s.streak.lastDate) return { count: 0, best: s.streak.best || 0, alive: false };
    var t = today(), y = offsetKey(-1);
    if (s.streak.lastDate === t || s.streak.lastDate === y) {
      return { count: s.streak.count, best: s.streak.best, alive: s.streak.lastDate === t };
    }
    return { count: 0, best: s.streak.best, alive: false };
  }

  function addVegGrams() {
    var t = totals();
    return t.vegGrams || 0;
  }

  function setProfile(p) {
    var s = load();
    s.profile = Object.assign({}, s.profile, p);
    save();
  }

  function setSettings(p) {
    var s = load();
    s.settings = Object.assign({}, s.settings, p);
    save();
  }

  function pickTip() {
    var s = load();
    var pool = Nutri.TIPS.filter(function (t) { return s.tipSeen.indexOf(t.id) === -1; });
    if (!pool.length) { s.tipSeen = []; pool = Nutri.TIPS.slice(); }
    var tip = pool[Math.floor(Math.random() * pool.length)];
    s.tipSeen.push(tip.id);
    save();
    return tip;
  }

  function toggleFav(id) {
    var s = load();
    var i = s.favorites.indexOf(id);
    if (i >= 0) s.favorites.splice(i, 1); else s.favorites.push(id);
    save();
    return s.favorites.indexOf(id) >= 0;
  }

  function history(days) {
    var s = load();
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var k = offsetKey(-i);
      var d = s.days[k];
      out.push({ key: k, checkedIn: !!(d && d.checkedIn), kcal: d ? Math.round(Nutri.engine.sumItems(d.items).kcal) : 0 });
    }
    return out;
  }

  function resetAll() {
    var keep = state ? state.profile : null;
    state = blank();
    /* 清空记录不应该把档案也清掉 */
    if (keep) {
      state.profile = keep;
      state.onboarded = true;
    }
    save();
    return state;
  }

  function canStore() { return storageOk; }

  return {
    load: load, save: save, today: today, dateKey: dateKey, offsetKey: offsetKey,
    day: day, totals: totals, addItem: addItem, removeItem: removeItem,
    checkIn: checkIn, streakLive: streakLive, questDefs: questDefs,
    refreshQuests: refreshQuests, addXp: addXp, levelOf: levelOf,
    levelProgress: levelProgress, setProfile: setProfile, setSettings: setSettings,
    pickTip: pickTip, toggleFav: toggleFav, history: history, resetAll: resetAll,
    canStore: canStore, isFirstRun: isFirstRun, finishOnboarding: finishOnboarding,
    exportState: exportState, importState: importState
  };
})();
