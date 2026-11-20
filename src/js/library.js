/* ===== 食材库管理：内置库 + 自定义层（仅内存，刷新还原） ===== */
window.Nutri = window.Nutri || {};

Nutri.library = (function () {
  var custom = [];          /* 追加模式收集的食材 */
  var replaced = null;      /* 全量替换后的食材库 */
  var index = {};

  function rebuildIndex() {
    index = {};
    Nutri.foods.forEach(function (f) { index[f.id] = f; });
    custom.forEach(function (f) { index[f.id] = f; });
    (replaced || []).forEach(function (f) { index[f.id] = f; });
  }

  function foods() {
    if (replaced) return replaced;
    return custom.concat(Nutri.foods);
  }

  function byId(id) {
    if (index[id]) return index[id];
    return Nutri.foodIndex[id] || null;
  }

  var VALID_CATS = Object.keys(Nutri.CAT_LABEL);

  function validate(data) {
    var errors = [];
    if (!Array.isArray(data)) {
      return { ok: false, errors: ["文件内容必须是一个数组（JSON Array），当前是 " + (data === null ? "null" : typeof data) + "。"] };
    }
    if (!data.length) return { ok: false, errors: ["数组是空的，没有可导入的食材。"] };
    if (data.length > 5000) return { ok: false, errors: ["一次最多导入 5000 条，当前 " + data.length + " 条。"] };
    data.forEach(function (it, i) {
      var at = "第 " + (i + 1) + " 条：";
      if (!it || typeof it !== "object" || Array.isArray(it)) {
        errors.push(at + "不是对象。"); return;
      }
      if (typeof it.name !== "string" || !it.name.trim()) {
        errors.push(at + "缺少 name（食材名称，非空字符串）。");
      }
      if (it.per100 === undefined || typeof it.per100 !== "object" || Array.isArray(it.per100)) {
        errors.push(at + "缺少 per100 对象（每 100 g 营养数据）。");
        return;
      }
      var kcal = it.per100.kcal;
      if (typeof kcal !== "number" || isNaN(kcal) || kcal < 0 || kcal > 950) {
        errors.push(at + "per100.kcal 必须是 0–950 之间的数字。");
      }
      ["protein", "fat", "carb", "fiber", "sugar", "sodium", "calcium", "iron", "vc",
        "va", "b12", "folate"].forEach(function (k) {
        var v = it.per100[k];
        if (v !== undefined && v !== null && (typeof v !== "number" || isNaN(v) || v < 0)) {
          errors.push(at + "per100." + k + " 必须是非负数字或 null。");
        }
      });
      if (it.cat !== undefined && it.cat !== null && VALID_CATS.indexOf(it.cat) < 0) {
        errors.push(at + "cat 必须是 " + VALID_CATS.slice(0, 8).join("/") + " 等类别之一（当前：" + it.cat + "）。");
      }
    });
    if (errors.length > 30) errors = errors.slice(0, 30).concat(["……还有 " + (errors.length - 30) + " 条错误未显示"]);
    return { ok: errors.length === 0, errors: errors };
  }

  function normalize(it, seq) {
    var per100 = {};
    Object.keys(it.per100 || {}).forEach(function (k) {
      var v = it.per100[k];
      per100[k] = (v === null || v === undefined) ? null : +v;
    });
    if (per100.kcal === undefined) per100.kcal = null;
    return {
      id: it.id && String(it.id) ? String(it.id) : "custom_" + Date.now().toString(36) + "_" + seq,
      name: String(it.name).trim(),
      alias: Array.isArray(it.alias) ? it.alias.slice(0, 6) : undefined,
      cat: VALID_CATS.indexOf(it.cat) >= 0 ? it.cat : "other",
      layer: it.layer,
      common: !!it.common,
      custom: true,
      src: "自定义",
      special: Array.isArray(it.special) ? it.special : undefined,
      per100: per100
    };
  }

  function append(data) {
    var v = validate(data);
    if (!v.ok) return { ok: false, errors: v.errors };
    var existing = {};
    foods().forEach(function (f) { existing[f.name] = true; });
    var added = 0, skipped = 0;
    data.forEach(function (it, i) {
      var name = String(it.name).trim();
      if (existing[name]) { skipped++; return; }
      existing[name] = true;
      custom.push(normalize(it, i));
      added++;
    });
    rebuildIndex();
    return { ok: true, added: added, skipped: skipped };
  }

  function replaceAll(data) {
    var v = validate(data);
    if (!v.ok) return { ok: false, errors: v.errors };
    replaced = data.map(function (it, i) { return normalize(it, i); });
    rebuildIndex();
    return { ok: true, added: replaced.length, skipped: 0 };
  }

  function reset() {
    custom = [];
    replaced = null;
    rebuildIndex();
  }

  function isTemp() { return custom.length > 0 || !!replaced; }

  function stats() {
    return {
      builtin: Nutri.foods.length,
      custom: custom.length,
      replaced: replaced ? replaced.length : 0,
      total: foods().length,
      temp: isTemp()
    };
  }

  function exportJson() {
    var list = foods().map(function (f) {
      var o = { id: f.id, name: f.name, cat: f.cat, per100: f.per100 };
      if (f.alias) o.alias = f.alias;
      if (f.layer) o.layer = f.layer;
      if (f.common) o.common = true;
      if (f.special) o.special = f.special;
      if (f.src) o.src = f.src;
      return o;
    });
    return JSON.stringify(list, null, 1);
  }

  rebuildIndex();

  return {
    foods: foods, byId: byId, validate: validate, append: append,
    replaceAll: replaceAll, reset: reset, isTemp: isTemp, stats: stats,
    exportJson: exportJson
  };
})();
