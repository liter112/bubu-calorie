/* ===== 营养计算引擎（纯函数，不碰 DOM） ===== */
window.Nutri = window.Nutri || {};

Nutri.engine = (function () {
  var NUTS = Nutri.NUTRIENTS;
  var OIL_KCAL_PER_G = 8.99;
  var OIL_VE_PER_G = 0.6;
  var NA_PER_G_SALT = 400;

  function norm(food) {
    if (!food) return null;
    if (!food.per100) food.per100 = {};
    for (var i = 0; i < NUTS.length; i++) {
      var k = NUTS[i].k;
      if (food.per100[k] === undefined) food.per100[k] = null;
    }
    return food;
  }

  function catOf(food) { return (food && food.cat) || "other"; }

  function yieldOf(method, food) {
    if (!method) return 1;
    var cat = catOf(food);
    var y = method.y[cat];
    if (y === undefined) y = method.y["default"];
    if (y === undefined) y = 1;
    if (cat === "grain" && y > 1 && Nutri.PREPARED_RE.test(food.name || "")) y = 1;
    return y;
  }

  function oilOf(method, food) {
    if (!method) return 0;
    var cat = catOf(food);
    var v = method.oil[cat];
    if (v === undefined) v = method.oil["default"];
    return v || 0;
  }

  function retainOf(method, key) {
    if (!method) return 1;
    if (method.retain && method.retain[key] !== undefined) return method.retain[key];
    if (method.leach && method.leach[key] !== undefined) return method.leach[key];
    return 1;
  }

  /* 生重 -> 熟重 / 用油量（用于记录页实时提示） */
  function preview(food, grams, methodId) {
    var m = Nutri.METHOD_MAP[methodId] || Nutri.METHOD_MAP.raw;
    var g = Math.max(0, +grams || 0);
    var y = yieldOf(m, food);
    return {
      yield: y,
      shrinkPct: Math.round((1 - y) * 100),
      gainPct: y > 1 ? Math.round((y - 1) * 100) : 0,
      cookedGrams: Math.round(g * y * 10) / 10,
      oilPer100: oilOf(m, food),
      oil: Math.round(oilOf(m, food) * g / 100 * 10) / 10
    };
  }

  /* 核心：食材 × 克数 × 烹饪方式 -> 营养结果 */
  function compute(food, grams, methodId, opts) {
    opts = opts || {};
    var m = Nutri.METHOD_MAP[methodId] || Nutri.METHOD_MAP.raw;
    var g = Math.max(0, Math.min(5000, +grams || 0));
    var base = g / 100;
    var y = yieldOf(m, food);
    var oil = opts.oil !== undefined && opts.oil !== null && opts.oil !== ""
      ? Math.max(0, +opts.oil) : Math.round(oilOf(m, food) * base * 10) / 10;
    var sugarG = opts.sugarApplied === false ? 0
      : (m.sugar ? Math.round(m.sugar * base * 10) / 10 : 0);
    if (opts.sugar !== undefined && opts.sugar !== null && opts.sugar !== "") {
      sugarG = Math.max(0, +opts.sugar);
    }
    var saltG = opts.saltApplied === false ? 0 : (m.salt ? Math.round(m.salt * base * 10) / 10 : 0);
    if (opts.salt !== undefined && opts.salt !== null && opts.salt !== "") {
      saltG = Math.max(0, +opts.salt);
    }

    var n = {};
    for (var i = 0; i < NUTS.length; i++) {
      var k = NUTS[i].k;
      var v = food.per100[k];
      if (v === null || v === undefined) { n[k] = null; continue; }
      n[k] = v * base * retainOf(m, k);
    }
    n.kcal = (food.per100.kcal || 0) * base;
    if (n.fat !== null) n.fat = (n.fat || 0) + oil;
    else if (oil > 0) n.fat = oil;
    if (n.ve !== null || oil > 0) n.ve = (n.ve || 0) + oil * OIL_VE_PER_G;
    if (oil > 0) n.kcal += oil * OIL_KCAL_PER_G;
    if (sugarG > 0) {
      n.kcal += sugarG * 4;
      n.carb = (n.carb || 0) + sugarG;
      n.sugar = (n.sugar || 0) + sugarG;
    }
    if (saltG > 0) n.sodium = (n.sodium || 0) + saltG * NA_PER_G_SALT;

    return {
      food: food, grams: g, method: m.id, methodName: m.name,
      cookedGrams: Math.round(g * y * 10) / 10,
      yield: y, shrinkPct: Math.round((1 - y) * 100),
      oil: oil, sugar: sugarG, salt: saltG,
      n: n, kcal: Math.round(n.kcal)
    };
  }

  function sumItems(items) {
    var total = {};
    for (var i = 0; i < NUTS.length; i++) total[NUTS[i].k] = null;
    total.kcal = 0;
    (items || []).forEach(function (it) {
      var n = it && it.n ? it.n : null;
      if (!n) return;
      for (var i = 0; i < NUTS.length; i++) {
        var k = NUTS[i].k;
        if (n[k] === null || n[k] === undefined) continue;
        total[k] = (total[k] === null ? 0 : total[k]) + n[k];
      }
    });
    total.kcal = Math.round(total.kcal);
    return total;
  }

  function pctOf(value, target) {
    if (value === null || value === undefined || !target) return null;
    return (value / target) * 100;
  }

  function statusOf(value, target, maxFlag) {
    if (value === null || value === undefined) return "unknown";
    var p = pctOf(value, target);
    if (maxFlag) {
      if (p > 100) return "high";
      if (p > 85) return "near";
      return "ok";
    }
    if (p >= 90) return "ok";
    if (p >= 70) return "near";
    return "low";
  }

  function fmt(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var d = dec === undefined ? 1 : dec;
    var x = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return String(x);
  }

  function search(query, extraFoods, limit) {
    var all = (Nutri.library && Nutri.library.foods()) || Nutri.foods;
    var q = String(query || "").trim();
    if (!q) {
      return all.filter(function (f) { return f.common; }).slice(0, 12);
    }
    var lower = q.toLowerCase();
    var scored = [];
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      var name = f.name || "";
      var score = 0;
      if (name === q) score = 120;
      else if (name.indexOf(q) === 0) score = 100;
      else if (name.indexOf(q) > -1) score = 80;
      else if (f.alias) {
        for (var j = 0; j < f.alias.length; j++) {
          if (f.alias[j].indexOf(q) > -1) { score = Math.max(score, 72); break; }
        }
      }
      if (!score && lower.length > 1) {
        var p = (f.py || "");
        if (p && p.indexOf(lower) === 0) score = 60;
      }
      if (!score && f.en && f.en.toLowerCase().indexOf(lower) > -1) score = 55;
      if (!score) continue;
      if (f.common) score += 6;
      if (f.custom) score += 12;
      score -= Math.min(10, Math.max(0, name.length - 4));
      scored.push({ f: f, s: score });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, limit || 30).map(function (x) { return x.f; });
  }

  function layerOf(food) {
    if (food.layer) return food.layer;
    var map = {
      grain: "谷薯", legume: "奶豆", leafy: "蔬菜", rootVeg: "蔬菜", fruitVeg: "蔬菜",
      mushroom: "蔬菜", fruit: "水果", meat: "肉蛋鱼", poultry: "肉蛋鱼",
      egg: "肉蛋鱼", fish: "肉蛋鱼", dairy: "奶豆", nut: "坚果", oil: "油脂"
    };
    return map[food.cat] || "其他";
  }

  return {
    norm: norm, catOf: catOf, yieldOf: yieldOf, oilOf: oilOf, retainOf: retainOf,
    preview: preview, compute: compute, sumItems: sumItems,
    pctOf: pctOf, statusOf: statusOf, fmt: fmt, search: search, layerOf: layerOf
  };
})();
