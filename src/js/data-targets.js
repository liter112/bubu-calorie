/* ===== 目标、营养素定义、膳食宝塔 ===== */
window.Nutri = window.Nutri || {};

Nutri.DEFAULT_PROFILE = {
  age: 19, sex: "f", height: 156.5, weight: 64,
  activity: 1.375, deficit: 500, surplus: 300, goal: "fatloss"
};

Nutri.ACTIVITY = [
  { v: 1.2, label: "久坐", desc: "基本不运动" },
  { v: 1.375, label: "轻度活动", desc: "每周 1–3 次轻运动" },
  { v: 1.55, label: "中度活动", desc: "每周 3–5 次运动" },
  { v: 1.725, label: "高强度", desc: "每周 6–7 次训练" }
];

/* 营养素定义：k=键名，label=中文，unit=单位，dec=展示小数位，
   group=分组，max=true 表示「越少越好」（钠、糖） */
Nutri.NUTRIENTS = [
  { k: "kcal", label: "能量", unit: "kcal", dec: 0, group: "core" },
  { k: "protein", label: "蛋白质", unit: "g", dec: 1, group: "core" },
  { k: "fat", label: "脂肪", unit: "g", dec: 1, group: "core" },
  { k: "carb", label: "碳水化合物", unit: "g", dec: 1, group: "core" },
  { k: "fiber", label: "膳食纤维", unit: "g", dec: 1, group: "core" },
  { k: "sugar", label: "糖", unit: "g", dec: 1, group: "core", max: true },
  { k: "va", label: "维生素A", unit: "µgRAE", dec: 0, group: "vit" },
  { k: "vc", label: "维生素C", unit: "mg", dec: 1, group: "vit" },
  { k: "ve", label: "维生素E", unit: "mg", dec: 1, group: "vit" },
  { k: "vd", label: "维生素D", unit: "µg", dec: 1, group: "vit" },
  { k: "vk", label: "维生素K", unit: "µg", dec: 1, group: "vit" },
  { k: "b1", label: "维生素B1", unit: "mg", dec: 2, group: "vit" },
  { k: "b2", label: "维生素B2", unit: "mg", dec: 2, group: "vit" },
  { k: "b6", label: "维生素B6", unit: "mg", dec: 2, group: "vit" },
  { k: "b12", label: "维生素B12", unit: "µg", dec: 2, group: "vit" },
  { k: "folate", label: "叶酸", unit: "µgDFE", dec: 0, group: "vit" },
  { k: "niacin", label: "烟酸", unit: "mgNE", dec: 1, group: "vit" },
  { k: "calcium", label: "钙", unit: "mg", dec: 0, group: "min" },
  { k: "iron", label: "铁", unit: "mg", dec: 1, group: "min" },
  { k: "zinc", label: "锌", unit: "mg", dec: 1, group: "min" },
  { k: "magnesium", label: "镁", unit: "mg", dec: 0, group: "min" },
  { k: "potassium", label: "钾", unit: "mg", dec: 0, group: "min" },
  { k: "sodium", label: "钠", unit: "mg", dec: 0, group: "min", max: true },
  { k: "selenium", label: "硒", unit: "µg", dec: 1, group: "min" },
  { k: "iodine", label: "碘", unit: "µg", dec: 0, group: "min" },
  { k: "phosphorus", label: "磷", unit: "mg", dec: 0, group: "min" },
  { k: "choline", label: "胆碱", unit: "mg", dec: 0, group: "min" }
];

Nutri.NUTRIENT_MAP = {};
Nutri.NUTRIENTS.forEach(function (n) { Nutri.NUTRIENT_MAP[n.k] = n; });

Nutri.CAT_LABEL = {
  grain: "谷薯类", legume: "豆类豆制品", leafy: "叶菜类", rootVeg: "根茎类",
  fruitVeg: "茄果瓜菜", mushroom: "菌藻类", fruit: "水果类", meat: "畜肉类",
  poultry: "禽肉类", egg: "蛋类", fish: "鱼虾贝类", dairy: "奶类",
  nut: "坚果种子", oil: "油脂", other: "其他"
};

Nutri.CAT_EMOJI = {
  grain: "🍚", legume: "🫘", leafy: "🥬", rootVeg: "🥕", fruitVeg: "🍆",
  mushroom: "🍄", fruit: "🍎", meat: "🥩", poultry: "🍗", egg: "🥚",
  fish: "🐟", dairy: "🥛", nut: "🥜", oil: "🫗", other: "🍽️"
};

/* 膳食宝塔（g/日，生重） */
Nutri.PYRAMID = [
  { key: "谷薯", min: 200, max: 300, color: "#f6c445", note: "全谷杂豆 50–150 g、薯类 50–100 g" },
  { key: "蔬菜", min: 300, max: 500, color: "#7bc96f", note: "深色蔬菜占一半以上" },
  { key: "水果", min: 200, max: 350, color: "#ff9aa2", note: "不可以用果汁代替" },
  { key: "肉蛋鱼", min: 120, max: 200, color: "#f4845f", note: "畜禽 40–75、水产 40–75、蛋 40–50" },
  { key: "奶豆", min: 325, max: 535, color: "#8ecae6", note: "奶 300–500 ml、大豆坚果 25–35 g" },
  { key: "坚果", min: 10, max: 15, color: "#c39b6a", note: "每天一小把，约 10 g 即可" }
];

/* 参考《中国居民膳食营养素参考摄入量（2023）》成人 18–49 岁，
   另给 14–17 与 50+ 两档做近似调整；孕期/哺乳期/疾病状态不在此表内。 */
Nutri.driFor = function (profile) {
  var p = Object.assign({}, Nutri.DEFAULT_PROFILE, profile || {});
  var male = p.sex === "m";
  var age = +p.age || 25;
  var teen = age < 18;
  var senior = age >= 50;
  return {
    va: male ? 800 : 700,
    vc: 100, ve: 14, vd: 10, vk: 80,
    b1: male ? 1.4 : 1.2,
    b2: male ? 1.4 : 1.2,
    b6: 1.4, b12: 2.4, folate: 400,
    niacin: male ? 15 : 12,
    calcium: (teen || senior) ? 1000 : 800,
    iron: male ? (teen ? 15 : 12) : (senior ? 12 : 18),
    zinc: male ? (teen ? 15 : 12.5) : (teen ? 11.5 : 7.5),
    magnesium: male && age >= 31 ? 350 : 330,
    potassium: 2000, sodium: 2000, selenium: 60, iodine: 120,
    phosphorus: 700, choline: male ? 500 : 400
  };
};

Nutri.bmi = function (profile) {
  var p = Object.assign({}, Nutri.DEFAULT_PROFILE, profile || {});
  var m = (+p.height || 160) / 100;
  return (+p.weight || 60) / (m * m);
};

Nutri.bmiLabel = function (bmi) {
  if (!isFinite(bmi) || bmi <= 0) return { label: "—", cls: "" };
  if (bmi < 18.5) return { label: "偏瘦", cls: "chip--blue" };
  if (bmi < 24) return { label: "正常", cls: "chip--green" };
  if (bmi < 28) return { label: "超重", cls: "chip--orange" };
  return { label: "肥胖", cls: "chip--red" };
};

Nutri.GOAL_LABEL = { fatloss: "减脂", maintain: "保持", gain: "增肌" };

Nutri.computeTargets = function (profile) {
  var p = Object.assign({}, Nutri.DEFAULT_PROFILE, profile || {});
  var w = +p.weight || 60, h = +p.height || 160, age = +p.age || 19;
  var male = p.sex === "m";
  var s = male ? 5 : -161;
  var bmr = 10 * w + 6.25 * h - 5 * age + s;
  var tdee = bmr * (+p.activity || 1.375);

  var goal = p.goal === "maintain" || p.goal === "gain" ? p.goal : "fatloss";
  var deficit = goal === "fatloss" ? (+p.deficit || 0) : 0;
  var surplus = goal === "gain" ? (+p.surplus || 300) : 0;
  var floor = male ? 1500 : 1200;
  var kcal = Math.round(Math.max(floor, tdee - deficit + surplus));

  var perKg = goal === "gain" ? 1.6 : (goal === "maintain" ? 1.0 : 1.25);
  var protein = Math.max(Math.round(perKg * w), male ? 65 : 55);
  var fat = Math.max(25, Math.round((kcal * 0.25) / 9));
  var carb = Math.max(100, Math.round((kcal - protein * 4 - fat * 9) / 4));
  var dri = Nutri.driFor(p);

  return Object.assign({
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: kcal,
    goal: goal, deficit: deficit, surplus: surplus, floor: floor,
    protein: protein, fat: fat, carb: carb,
    fiber: 25, sugar: 25
  }, dri);
};

Nutri.STATUS = {
  ok: { label: "达标", cls: "green" },
  high: { label: "超出", cls: "orange" },
  near: { label: "略缺", cls: "blue" },
  low: { label: "不足", cls: "red" },
  unknown: { label: "未收录", cls: "silent" }
};
