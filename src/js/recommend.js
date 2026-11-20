/* ===== 缺口分析、建议、每日 10 种推荐 ===== */
window.Nutri = window.Nutri || {};

Nutri.recommend = (function () {
  var E = Nutri.engine;

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function density(food, key) {
    var v = food.per100[key];
    var kcal = food.per100.kcal || 1;
    if (v === null || v === undefined) return 0;
    return v / Math.max(kcal, 1) * 100; /* 每 100 kcal 的含量 */
  }

  /* 计算某营养素的缺口（克/毫克），null 表示数据缺失 */
  function gapOf(stats, targets, key) {
    var v = stats[key], t = targets[key];
    if (v === null || v === undefined || !t) return null;
    return t - v;
  }

  function advice(stats, targets, profile) {
    var out = [];
    var p = profile || Nutri.store.load().profile;
    var kcalPct = E.pctOf(stats.kcal, targets.kcal) || 0;

    if (kcalPct < 80 && stats.itemCount) {
      out.push({
        key: "kcal", type: "info",
        text: "今天热量还差 " + Math.round(targets.kcal - stats.kcal) + " kcal，减脂不等于吃得越少越好，建议加一份加餐（如 1 个鸡蛋 + 1 个苹果）。"
      });
    } else if (kcalPct > 110 && stats.itemCount) {
      out.push({
        key: "kcal", type: "warn",
        text: "今天热量已超出目标 " + Math.round(stats.kcal - targets.kcal) + " kcal，明天可以通过少放 1 勺油、把主食减 1/4 来平衡。"
      });
    }

    var gp = gapOf(stats, targets, "protein");
    if (gp !== null && E.pctOf(stats.protein, targets.protein) < 80) {
      var pf = topFoods("protein", ["meat", "poultry", "fish", "egg", "dairy", "legume"], 2);
      out.push({
        key: "protein", type: "warn",
        text: "蛋白质还差 " + Math.round(gp) + " g。建议补充 " + pf.map(function (x) {
          return x.grams + " g " + x.food.name + "（约 " + Math.round(x.grams * (x.food.per100.protein || 0) / 100) + " g 蛋白）";
        }).join("，或 ") + "。"
      });
    }

    var gf = gapOf(stats, targets, "fiber");
    if (gf !== null && E.pctOf(stats.fiber, targets.fiber) < 80) {
      out.push({
        key: "fiber", type: "warn",
        text: "膳食纤维还差 " + Math.round(gf) + " g。把 1/3 白米饭换成糙米/燕麦，或加一份水煮毛豆、木耳，很容易补上。"
      });
    }

    var gc = gapOf(stats, targets, "calcium");
    if (gc !== null && E.pctOf(stats.calcium, targets.calcium) < 70) {
      out.push({
        key: "calcium", type: "warn",
        text: "钙只到 " + Math.round(E.pctOf(stats.calcium, targets.calcium)) + "%，还差 " + Math.round(gc) + " mg。一杯 300 ml 牛奶 ≈ 320 mg，或 150 g 北豆腐 + 一份深绿色蔬菜。"
      });
    }

    var gi = gapOf(stats, targets, "iron");
    if (gi !== null && E.pctOf(stats.iron, targets.iron) < 70 && p.sex !== "m") {
      out.push({
        key: "iron", type: "warn",
        text: "女性每日需要 18 mg 铁，今天还差 " + Math.round(gi) + " mg。吃红肉/猪肝时配一份富含维生素 C 的果蔬，吸收率能提高 2–3 倍。"
      });
    }

    var gv = gapOf(stats, targets, "vc");
    if (gv !== null && E.pctOf(stats.vc, targets.vc) < 70) {
      out.push({
        key: "vc", type: "info",
        text: "维生素 C 还差 " + Math.round(gv) + " mg。一个猕猴桃约 60 mg、半个彩椒约 60 mg，生吃或快炒保留最好。"
      });
    }

    var gva = gapOf(stats, targets, "va");
    if (gva !== null && E.pctOf(stats.va, targets.va) < 70) {
      out.push({
        key: "va", type: "info",
        text: "维生素 A 还差 " + Math.round(gva) + " µgRAE。胡萝卜、南瓜、菠菜里的 β-胡萝卜素可以转化，用少量油炒吸收更好。"
      });
    }

    if (stats.b12 !== null && stats.b12 !== undefined && stats.b12 < 0.5) {
      out.push({
        key: "b12", type: "info",
        text: "维生素 B12 今天几乎没有摄入。它只存在于动物性食物，吃个鸡蛋、喝杯奶或来份鱼就能补。"
      });
    }

    if (stats.sodium !== null && stats.sodium > targets.sodium) {
      out.push({
        key: "sodium", type: "warn",
        text: "钠已超过 2000 mg（≈5 g 盐），注意酱油、蚝油、加工肉里的隐形盐，明天清淡一点。"
      });
    }

    if ((stats.vegFruitGrams || 0) < 500 && stats.itemCount) {
      out.push({
        key: "veg", type: "info",
        text: "蔬菜水果只有 " + Math.round(stats.vegFruitGrams || 0) + " g，距离 500 g 还差 " +
          Math.round(500 - (stats.vegFruitGrams || 0)) + " g。加一份凉拌黄瓜或一个苹果就到了。"
      });
    }

    if (!out.length) {
      out.push({ key: "ok", type: "ok", text: "今天的营养搭配很均衡，继续保持！记得多喝水、早点睡。" });
    }
    return out;
  }

  /* 日常食材优先：营养素缺口建议只从这些常见食材里挑 */
  var PICKS = {
    protein: ["鸡胸脯肉", "鸡蛋（代表值", "北豆腐", "猪肉（瘦", "瘦猪肉", "鲈鱼", "基围虾", "牛奶（代表值", "希腊酸奶", "鹰嘴豆", "豆腐（代表值"],
    fiber: ["燕麦", "糙米", "黑豆", "木耳", "西兰花", "红薯", "苹果", "魔芋", "玉米"],
    calcium: ["牛奶（代表值", "北豆腐", "黑芝麻", "芥蓝", "虾皮", "酸奶", "豆腐（代表值"],
    iron: ["猪肝", "牛肉（瘦", "鸭血", "菠菜", "木耳", "羊肉（瘦", "猪血"],
    vc: ["彩椒", "猕猴桃", "草莓", "橙", "西兰花", "青椒", "番茄"],
    va: ["胡萝卜（红", "胡萝卜", "南瓜", "菠菜", "猪肝", "红薯"],
    b12: ["三文鱼", "鲑鱼", "鲈鱼", "鸡蛋（代表值", "牛奶（代表值", "猪肝"],
    potassium: ["香蕉", "土豆", "菠菜", "口蘑", "黄豆", "橙"]
  };

  /* 每日推荐候选池：只放日常真的会吃的食材，避免推荐鱼翅、海参这类 */
  var REC_POOL = {
    "谷薯": ["米饭（蒸", "糙米", "燕麦片", "燕麦", "玉米（鲜", "玉米", "红薯", "马铃薯（煮", "全麦面包", "藜麦（生", "小米", "荞麦", "紫薯"],
    "蔬菜": ["西兰花", "菠菜", "胡萝卜（红", "番茄", "黄瓜", "生菜", "油麦菜", "白菜", "青椒", "彩椒",
      "香菇", "金针菇", "海带", "木耳", "油菜", "南瓜", "冬瓜", "茄子", "西葫芦", "秋葵", "芥蓝", "芹菜"],
    "水果": ["苹果", "香蕉", "橙", "猕猴桃", "草莓", "蓝莓", "梨", "葡萄", "西瓜", "桃", "柚", "火龙果", "芒果", "车厘子"],
    "肉蛋鱼": ["鸡胸脯肉", "鸡蛋（代表值", "鸡蛋", "鲈鱼", "基围虾", "对虾", "牛肉（瘦", "瘦猪肉", "鸡腿", "鲑鱼", "鳕鱼", "鸭肉", "羊肉（瘦"],
    "奶豆": ["牛奶（代表值", "牛奶", "酸奶（代表值", "酸奶", "北豆腐", "豆腐（代表值", "豆浆", "奶酪", "希腊酸奶"],
    "坚果": ["核桃", "巴旦木", "花生（炒", "腰果", "开心果", "南瓜子", "芝麻子（黑", "芝麻"]
  };

  var BLOCK = /鲨|翅|鲸|豚|鹿|驴|马肉|蛇|蛙|蚕|蝗|蝎|蜈蚣|蝠|熊|豹/;

  function findByPrefix(prefix, all) {
    var best = null;
    for (var i = 0; i < all.length; i++) {
      var nm = all[i].name;
      if (nm.indexOf(prefix) !== 0) continue;
      if (!best || nm.length < best.name.length) best = all[i];
    }
    return best;
  }

  var REC_BLOCK = /藤|薹|秧|梗|汁|罐头|蜜饯|脯|酱|酥|糕|饼干|糖果/;

  function poolFor(layer, all) {
    var prefixes = REC_POOL[layer] || [];
    var out = [];
    prefixes.forEach(function (p) {
      var f = findByPrefix(p, all);
      if (f && out.indexOf(f) < 0 && !REC_BLOCK.test(f.name)) out.push(f);
    });
    return out;
  }

  function pickName(names) {
    var all = Nutri.library ? Nutri.library.foods() : Nutri.foods;
    var out = [];
    (names || []).forEach(function (prefix) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].name.indexOf(prefix) === 0 && out.indexOf(all[i]) < 0) {
          out.push(all[i]);
          break;
        }
      }
    });
    return out;
  }

  function baseName(name) {
    return String(name).replace(/[（(［\[【].*$/, "").trim();
  }

  /* 找某营养素密度最高的食物（优先日常常见食材） */
  function topFoods(key, cats, count, excludeIds) {
    var curated = (PICKS[key] || []).length ? pickName(PICKS[key]) : [];
    var list = curated.filter(function (f) {
      if (excludeIds && excludeIds.indexOf(f.id) >= 0) return false;
      var v = f.per100[key];
      return v !== null && v !== undefined && v > 0;
    });
    if (list.length < (count || 2)) {
      var all = (Nutri.library && Nutri.library.foods()) || Nutri.foods;
      var extra = all.filter(function (f) {
        if (BLOCK.test(f.name)) return false;
        if (!f.common) return false;
        if (excludeIds && excludeIds.indexOf(f.id) >= 0) return false;
        if (cats && cats.length && cats.indexOf(f.cat) < 0) return false;
        var v = f.per100[key];
        return v !== null && v !== undefined && v > 0 && (f.per100.kcal || 0) > 0;
      });
      extra.sort(function (a, b) { return density(b, key) - density(a, key); });
      extra.forEach(function (f) {
        if (list.length >= (count || 2)) return;
        if (!list.some(function (x) { return x.id === f.id; })) list.push(f);
      });
    }
    var gramsMap = {
      protein: 100, fiber: 150, calcium: 200, iron: 100, vc: 100, va: 100, b12: 100, potassium: 150
    };
    return list.slice(0, count || 2).map(function (f) {
      return { food: f, grams: (gramsMap[key] || 100) };
    });
  }

  /* 宝塔各层实际摄入量 */
  function pyramidProgress(stats, items) {
    var grams = {};
    Nutri.PYRAMID.forEach(function (l) { grams[l.key] = 0; });
    (items || []).forEach(function (it) {
      var layer = it.layer || E.layerOf({ cat: it.cat, name: it.name });
      if (grams[layer] === undefined) return;
      grams[layer] += it.grams || 0;
    });
    return Nutri.PYRAMID.map(function (l) {
      var g = Math.round(grams[l.key]);
      var status = g <= 0 ? "none" : (g < l.min ? "low" : (g > l.max ? "over" : "ok"));
      return {
        key: l.key, grams: g, min: l.min, max: l.max, color: l.color,
        note: l.note, status: status,
        pct: Math.min(100, Math.round(g / l.max * 100))
      };
    });
  }

  var SLOTS = [
    { layer: "谷薯", n: 2, grams: [50, 100], cats: ["grain"], why: "主食换成全谷/薯类，纤维和 B 族维生素更多" },
    { layer: "蔬菜", n: 3, grams: [100, 150], cats: ["leafy", "rootVeg", "fruitVeg", "mushroom"], why: "深色蔬菜占一半，补维生素和矿物质" },
    { layer: "水果", n: 1, grams: [100, 200], cats: ["fruit"], why: "整个水果比果汁好，纤维和饱腹感都在" },
    { layer: "肉蛋鱼", n: 2, grams: [50, 100], cats: ["meat", "poultry", "fish", "egg"], why: "优质蛋白 + 铁/锌/B12" },
    { layer: "奶豆", n: 1, grams: [150, 250], cats: ["dairy", "legume"], why: "补钙和植物蛋白" },
    { layer: "坚果", n: 1, grams: [10, 15], cats: ["nut"], why: "维生素 E 和不饱和脂肪，一小把就够" }
  ];

  function dailyTen(stats, targets, dateStr, excludeIds) {
    var seed = hashSeed(String(dateStr) + "|" + Math.round(stats.kcal || 0));
    var rand = rng(seed);
    var used = {};
    var usedBase = {};
    var favs = Nutri.store.load().favorites || [];
    var chosen = [];

    function score(food, slot) {
      var s = 0;
      var keys = ["protein", "fiber", "calcium", "iron", "vc", "va", "potassium"];
      keys.forEach(function (k) {
        var t = targets[k];
        if (!t) return;
        var v = stats[k];
        var ratio = (v === null || v === undefined) ? 1 : 1 - Math.min(1, v / t);
        if (ratio > 0.2) s += ratio * density(food, k) * (k === "protein" ? 1.2 : 1);
      });
      if (food.common) s += 1.4;
      if (favs.indexOf(food.id) >= 0) s += 2;
      if (food.name.indexOf("胡萝卜") >= 0) s += 3.2; /* 你喜欢的 */
      if (food.cat === "rootVeg") s += 0.8;
      if (/\（/.test(food.name)) s -= 0.6;
      return s + rand() * 4;
    }

    SLOTS.forEach(function (slot) {
      var all = (Nutri.library && Nutri.library.foods()) || Nutri.foods;
      function candidates(onlyCommon) {
        return all.filter(function (f) {
          if (used[f.id]) return false;
          if (BLOCK.test(f.name)) return false;
          if (onlyCommon && !f.common && favs.indexOf(f.id) < 0) return false;
          if (excludeIds && excludeIds.indexOf(f.id) >= 0) return false;
          if (slot.cats.indexOf(f.cat) < 0) return false;
          if (E.layerOf(f) !== slot.layer) return false;
          if (f.per100.kcal === null) return false;
          if (slot.layer !== "谷薯" && slot.layer !== "坚果" && (f.per100.kcal || 0) > 400) return false;
          if (slot.layer === "肉蛋鱼" && f.name.indexOf("肥") > -1) return false;
          return true;
        });
      }
      var lp = poolFor(slot.layer, all).filter(function (f) {
        if (used[f.id]) return false;
        if (excludeIds && excludeIds.indexOf(f.id) >= 0) return false;
        if (slot.cats.indexOf(f.cat) < 0) return false;
        if (E.layerOf(f) !== slot.layer) return false;
        return true;
      });
      var pool = lp.slice();
      if (pool.length < slot.n * 2) {
        candidates(true).forEach(function (f) { if (pool.indexOf(f) < 0) pool.push(f); });
      }
      if (pool.length < slot.n) {
        candidates(false).forEach(function (f) { if (pool.indexOf(f) < 0) pool.push(f); });
      }
      pool.sort(function (a, b) { return score(b, slot) - score(a, slot); });
      /* 在评分最高的几项里轮换，保证每天不重样 */
      var top = pool.slice(0, Math.max(6, slot.n * 3));
      var rot = Math.floor(rand() * Math.max(1, top.length));
      top = top.slice(rot).concat(top.slice(0, rot));
      var picked = 0;
      for (var i = 0; i < top.length && picked < slot.n; i++) {
        var f = top[i];
        var bn = baseName(f.name);
        if (usedBase[bn]) continue;
        used[f.id] = true;
        usedBase[bn] = true;
        picked++;
        var lo = slot.grams[0], hi = slot.grams[1];
        var k100 = f.per100.kcal || 0;
        if (slot.layer !== "谷薯" && slot.layer !== "坚果") {
          if (k100 > 300) hi = Math.min(hi, 30);
          else if (k100 > 200) hi = Math.min(hi, 60);
        }
        var g = Math.round((Math.min(lo, hi) + rand() * (hi - Math.min(lo, hi))) / 10) * 10;
        if (g < 10) g = 10;
        chosen.push({
          food: f, grams: g, layer: slot.layer,
          reason: reasonFor(f, slot),
          kcal: Math.round((f.per100.kcal || 0) * g / 100)
        });
      }
    });
    return chosen;
  }

  function reasonFor(f, slot) {
    var p = f.per100;
    if ((p.protein || 0) >= 15) return "高蛋白 " + Math.round(p.protein) + " g/100 g";
    if ((p.fiber || 0) >= 4) return "膳食纤维 " + E.fmt(p.fiber, 1) + " g/100 g";
    if ((p.vc || 0) >= 40) return "维生素 C " + Math.round(p.vc) + " mg/100 g";
    if ((p.calcium || 0) >= 100) return "钙 " + Math.round(p.calcium) + " mg/100 g";
    if ((p.carotene || 0) >= 1000) return "富含 β-胡萝卜素";
    if (slot.layer === "谷薯") return "主食提供能量与 B 族维生素";
    return slot.why;
  }

  return {
    advice: advice, topFoods: topFoods, dailyTen: dailyTen,
    pyramidProgress: pyramidProgress, density: density
  };
})();
