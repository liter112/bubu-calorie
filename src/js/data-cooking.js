/* ===== 烹饪方式：缩水率、用油量、营养留存 =====
   y      熟重/生重（<1 缩水，>1 吸水增重）
   oil    g 油 / 100 g 生重（缺省按菜籽油 899 kcal/100 g 计入）
   retain 加热后营养素留存率（未列出的记为 1）
   leach  水煮类的水溶性矿物质流失
*/
window.Nutri = window.Nutri || {};

Nutri.METHODS = [
  {
    id: "raw", name: "生食", icon: "🥗", heat: false,
    desc: "不加热，维生素保留最完整；胡萝卜素等脂溶性营养素吸收率较低",
    y: {}, oil: { default: 0 }
  },
  {
    id: "blend", name: "破壁打汁", icon: "🥤", heat: false,
    desc: "高速破壁粉碎，不加热、不加油；营养总量不变，但升糖比整块吃更快",
    y: {}, oil: { default: 0 },
    warn: "⚠️ 破壁粉碎仅切碎膳食纤维，总纤维、碳水总量不变；纤维网状结构被破坏，糖分吸收速度更快，升糖反应高于整块食用。"
  },
  {
    id: "salad", name: "凉拌", icon: "🥢", heat: false,
    desc: "不加热 + 少量油，维生素 C 几乎无损失",
    y: { leafy: 0.95, rootVeg: 0.97, fruitVeg: 0.96, mushroom: 0.95, legume: 0.98 },
    oil: { default: 4, leafy: 5, legume: 3 }
  },
  {
    id: "blanch", name: "焯水", icon: "♨️", heat: true,
    desc: "短时间沸水，去草酸/去腥；水溶性维生素会随水流失",
    y: { leafy: 0.55, rootVeg: 0.9, fruitVeg: 0.85, mushroom: 0.75, legume: 0.95 },
    oil: { default: 0 },
    retain: { vc: 0.5, b1: 0.7, b2: 0.75, folate: 0.55, va: 0.85, vk: 0.8 },
    leach: { potassium: 0.75, magnesium: 0.92, sodium: 0.88 }
  },
  {
    id: "boil", name: "水煮", icon: "🍲", heat: true,
    desc: "整块下锅，营养溶出比焯水少；蔬菜缩水明显，米面吸水增重",
    y: { leafy: 0.6, rootVeg: 0.9, fruitVeg: 0.85, mushroom: 0.7, meat: 0.75,
         poultry: 0.75, fish: 0.8, egg: 0.95, grain: 2.2, legume: 1.6 },
    oil: { default: 0 },
    retain: { vc: 0.45, b1: 0.65, b2: 0.7, folate: 0.5, va: 0.8, vk: 0.7 },
    leach: { potassium: 0.75, magnesium: 0.9, sodium: 0.85 }
  },
  {
    id: "steam", name: "蒸", icon: "🫕", heat: true,
    desc: "隔水加热，几乎不接触水，水溶性营养流失最少",
    y: { leafy: 0.7, rootVeg: 0.95, fruitVeg: 0.9, mushroom: 0.8, meat: 0.78,
         poultry: 0.78, fish: 0.85, egg: 0.97, grain: 2.2, legume: 1.5 },
    oil: { default: 0 },
    retain: { vc: 0.7, b1: 0.8, b2: 0.85, folate: 0.75, va: 0.9, vk: 0.85 },
    leach: { potassium: 0.95 }
  },
  {
    id: "microwave", name: "微波", icon: "📡", heat: true,
    desc: "加热时间短，营养留存率高；注意用微波专用容器",
    y: { leafy: 0.85, rootVeg: 0.97, fruitVeg: 0.94, mushroom: 0.9, meat: 0.88,
         poultry: 0.88, fish: 0.9, egg: 0.98, grain: 1 },
    oil: { default: 0 },
    retain: { vc: 0.85, b1: 0.9, b2: 0.9, folate: 0.85, va: 0.95, vk: 0.9 }
  },
  {
    id: "quickfry", name: "快炒", icon: "🍳", heat: true,
    desc: "大火短时少油，维生素损失小于水煮，用油量可控",
    y: { leafy: 0.65, rootVeg: 0.85, fruitVeg: 0.8, mushroom: 0.65, meat: 0.75,
         poultry: 0.75, fish: 0.82, egg: 0.9, legume: 0.9, grain: 1 },
    oil: { default: 4, leafy: 5, meat: 3, fish: 3, egg: 3 },
    retain: { vc: 0.8, b1: 0.85, b2: 0.85, folate: 0.8, va: 0.92, vk: 0.85 }
  },
  {
    id: "stirfry", name: "爆炒", icon: "🔥", heat: true,
    desc: "高温快炒、油温高；香气足但用油多，维生素 C 损失约 25%",
    y: { leafy: 0.62, rootVeg: 0.82, fruitVeg: 0.78, mushroom: 0.62, meat: 0.72,
         poultry: 0.72, fish: 0.8, egg: 0.88, legume: 0.85, grain: 1 },
    oil: { default: 6, leafy: 8, meat: 4, fish: 3, egg: 4 },
    retain: { vc: 0.75, b1: 0.8, b2: 0.8, folate: 0.75, va: 0.9, vk: 0.8 }
  },
  {
    id: "panfry", name: "煎", icon: "🥘", heat: true,
    desc: "中小火少油贴锅，表面焦化；比油炸吸油少很多",
    y: { default: 0.8, grain: 1, egg: 0.92, leafy: 0.6 },
    oil: { default: 5, meat: 4, fish: 4, egg: 4 },
    retain: { vc: 0.7, b1: 0.8, b2: 0.8, folate: 0.7, va: 0.9, vk: 0.8 }
  },
  {
    id: "airfry", name: "空气炸", icon: "💨", heat: true,
    desc: "热风循环，用油极少；口感接近油炸但热量低很多",
    y: { default: 0.75, meat: 0.68, rootVeg: 0.75, grain: 1 },
    oil: { default: 1 },
    retain: { vc: 0.7, b1: 0.8, b2: 0.8, folate: 0.7, va: 0.9, vk: 0.8 }
  },
  {
    id: "deepfry", name: "油炸", icon: "🍟", heat: true,
    desc: "吸油量约为生重的 10–15%，热量大幅上升，建议每周不超过 1 次",
    y: { leafy: 0.5, rootVeg: 0.75, fruitVeg: 0.7, mushroom: 0.5, meat: 0.65,
         poultry: 0.65, fish: 0.6, egg: 0.7, grain: 1 },
    oil: { default: 12, leafy: 14 },
    retain: { vc: 0.55, b1: 0.7, b2: 0.75, folate: 0.55, va: 0.85, vk: 0.7 }
  },
  {
    id: "roast", name: "烤", icon: "🔥", heat: true,
    desc: "干热加热，表面美拉德反应；注意别烤焦，焦黑部分不要吃",
    y: { default: 0.75, meat: 0.7, fish: 0.7, rootVeg: 0.8, leafy: 0.55, grain: 1 },
    oil: { default: 2 },
    retain: { vc: 0.65, b1: 0.8, b2: 0.8, folate: 0.65, va: 0.9, vk: 0.75 }
  },
  {
    id: "stew", name: "炖", icon: "🍲", heat: true,
    desc: "长时间加水慢煮，肉质软烂；汤里有溶出的营养，别只吃肉不喝汤",
    y: { default: 0.75, meat: 0.65, poultry: 0.7, fish: 0.7, rootVeg: 0.9,
         leafy: 0.8, legume: 0.95, grain: 2.0 },
    oil: { default: 2 },
    retain: { vc: 0.45, b1: 0.6, b2: 0.7, folate: 0.5, va: 0.85, vk: 0.6 },
    leach: { potassium: 0.85 }
  },
  {
    id: "braise", name: "红烧", icon: "🍛", heat: true,
    desc: "油 + 糖 + 酱油，默认附加 5 g 糖/100 g（可关闭），钠也偏高",
    y: { default: 0.65, meat: 0.6, fish: 0.65, rootVeg: 0.8, leafy: 0.55, legume: 0.8 },
    oil: { default: 8, meat: 6 },
    retain: { vc: 0.45, b1: 0.6, b2: 0.7, folate: 0.5, va: 0.85, vk: 0.6 },
    sugar: 5, salt: 0.8
  },
  {
    id: "pressure", name: "高压锅", icon: "⏱️", heat: true,
    desc: "高温高压、时间短，B 族维生素损失比长时间炖更少",
    y: { default: 0.7, meat: 0.62, poultry: 0.65, legume: 0.95, rootVeg: 0.85, grain: 2.2 },
    oil: { default: 1 },
    retain: { vc: 0.55, b1: 0.7, b2: 0.8, folate: 0.6, va: 0.88, vk: 0.65 }
  }
];

Nutri.METHOD_MAP = {};
Nutri.METHODS.forEach(function (m) { Nutri.METHOD_MAP[m.id] = m; });

/* 已经煮熟的谷薯（米饭/馒头/面条等），不要再按「吸水增重」计算 */
Nutri.PREPARED_RE = /(饭|面|馒头|包|饼|糕|条|粥|粉|饺|馄饨|粽子|米线|河粉|粉丝)/;
