/* ===== USDA FoodData Central 联网补全（可选，需要 api.data.gov KEY） ===== */
window.Nutri = window.Nutri || {};

Nutri.usda = (function () {
  var BASE = "https://api.nal.usda.gov/fdc/v1/foods/search";
  var cache = {};

  var NUM = {
    "208": "kcal", "203": "protein", "204": "fat", "205": "carb", "291": "fiber",
    "269": "sugar", "301": "calcium", "303": "iron", "304": "magnesium",
    "305": "phosphorus", "306": "potassium", "307": "sodium", "309": "zinc",
    "312": "copper", "315": "manganese", "317": "selenium", "320": "va",
    "401": "vc", "323": "ve", "328": "vd", "430": "vk", "404": "b1",
    "405": "b2", "406": "niacin", "415": "b6", "418": "b12", "435": "folate",
    "421": "choline", "314": "iodine"
  };

  function pick(foodNutrients) {
    var out = {};
    (foodNutrients || []).forEach(function (fn) {
      var raw = fn.nutrientNumber || "";
      var num = String(raw).replace(/^0+/, "");
      var key = NUM[num] || NUM[String(fn.nutrientNumber)];
      if (!key && fn.nutrientName) {
        var n = String(fn.nutrientName).toLowerCase();
        if (n.indexOf("energy") === 0 && /kcal/.test(fn.unitName || "")) key = "kcal";
        else if (n === "protein") key = "protein";
        else if (n.indexOf("total lipid") === 0) key = "fat";
        else if (n.indexOf("carbohydrate, by difference") === 0) key = "carb";
        else if (n.indexOf("fiber, total dietary") === 0) key = "fiber";
        else if (n.indexOf("sugars, total") === 0) key = "sugar";
      }
      if (!key) return;
      var v = fn.value;
      if (typeof v !== "number" || isNaN(v)) return;
      if (key === "kcal" && /kj/i.test(fn.unitName || "")) v = v / 4.184;
      out[key] = Math.round(v * 1000) / 1000;
    });
    return out;
  }

  function map(food, idx) {
    var p = pick(food.foodNutrients);
    var name = food.description || food.lowercaseDescription || ("USDA food " + idx);
    name = name.replace(/,?\s*(raw|uncooked|cooked|frozen|fresh)\b/gi, "").replace(/\s+/g, " ").trim();
    if (!name) name = "USDA " + (food.fdcId || idx);
    return {
      id: "usda_" + (food.fdcId || idx),
      name: name,
      cat: "other",
      common: false,
      custom: true,
      src: "USDA",
      per100: p
    };
  }

  function search(query, key, pageSize) {
    var q = String(query || "").trim();
    if (!q) return Promise.resolve([]);
    var ck = q + "|" + (pageSize || 12);
    if (cache[ck]) return Promise.resolve(cache[ck]);
    var url = BASE + "?api_key=" + encodeURIComponent(key) +
      "&query=" + encodeURIComponent(q) +
      "&pageSize=" + (pageSize || 12) +
      "&dataType=" + encodeURIComponent("Foundation,SR Legacy");
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + (r.status === 403 ? "（KEY 无效或超限）" : ""));
        return r.json();
      })
      .then(function (data) {
        var list = (data.foods || []).map(map).filter(function (f) {
          return f.per100 && typeof f.per100.kcal === "number";
        });
        cache[ck] = list;
        return list;
      });
  }

  return { search: search };
})();
