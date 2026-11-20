# 食材 JSON 格式说明

内置库、导出的 JSON、以及你上传的 JSON，用的是同一套结构。下面每一行都可以省略（省略 = `null` / 默认值），但 `name` 和 `per100.kcal` 必填。

```json
{
  "id": "cn114101",
  "name": "胡萝卜（红）",
  "alias": ["红萝卜", "甘荀"],
  "cat": "rootVeg",
  "common": true,
  "src": "CFCT6",
  "per100": {
    "kcal": 39,
    "protein": 1.0,
    "fat": 0.2,
    "carb": 8.8,
    "fiber": 1.1,
    "sugar": null,
    "sodium": 71.4,
    "potassium": 190,
    "calcium": 32,
    "iron": 1.0,
    "zinc": 0.23,
    "magnesium": 14,
    "phosphorus": 27,
    "selenium": 0.96,
    "va": 344,
    "carotene": 4130,
    "retinol": 0,
    "ve": 0.41,
    "vc": 13,
    "b1": 0.04,
    "b2": 0.03,
    "b6": null,
    "b12": null,
    "folate": null,
    "niacin": 0.6,
    "vd": null,
    "vk": null,
    "iodine": null,
    "choline": null
  },
  "special": [
    { "n": "β-胡萝卜素", "a": "4130 µg/100 g", "d": "维生素 A 前体，脂溶性" }
  ],
  "remark": ""
}
```

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 食材名，追加模式下按它去重（同名跳过） |
| `per100` | object | ✅ | 每 100 g **可食部生重**的营养，见下表 |
| `cat` | string | | 食材类别，缺省 `other`。见下面的可选值 |
| `id` | string | | 唯一 id，缺省自动生成；建议保留导出文件里的值 |
| `alias` | string[] | | 别名，搜索时会一起匹配 |
| `common` | boolean | | 是否「常用」，搜索结果会靠前 |
| `src` | string | | 数据来源标记（`CFCT6` / `USDA` / `自定义`），仅展示用 |
| `special` | object[] | | 特殊营养素：`{ n: 名称, a: 含量, d: 说明 }` |
| `remark` | string | | 备注（产地等），仅展示用 |

## per100 字段（单位：每 100 g）

| 字段 | 单位 | 说明 |
|---|---|---|
| `kcal` | kcal | 能量，**必填**，0–950 |
| `protein` | g | 蛋白质 |
| `fat` | g | 脂肪 |
| `carb` | g | 碳水化合物 |
| `fiber` | g | 膳食纤维 |
| `sugar` | g | 糖（第 6 版无此列，通常为 null） |
| `sodium` | mg | 钠 |
| `potassium` | mg | 钾 |
| `calcium` | mg | 钙 |
| `iron` | mg | 铁 |
| `zinc` | mg | 锌 |
| `magnesium` | mg | 镁 |
| `phosphorus` | mg | 磷 |
| `selenium` | µg | 硒 |
| `iodine` | µg | 碘 |
| `va` | µgRAE | 维生素 A（视黄醇活性当量） |
| `carotene` | µg | 胡萝卜素 |
| `retinol` | µg | 视黄醇 |
| `vd` | µg | 维生素 D |
| `ve` | mg | 维生素 E（总量） |
| `vk` | µg | 维生素 K |
| `vc` | mg | 维生素 C |
| `b1` | mg | 维生素 B1 |
| `b2` | mg | 维生素 B2 |
| `b6` | mg | 维生素 B6 |
| `b12` | µg | 维生素 B12 |
| `folate` | µgDFE | 叶酸 |
| `niacin` | mgNE | 烟酸 |
| `choline` | mg | 胆碱 |

> 不在上表里的字段会被忽略（不会报错）。任何字段填 `null` 或省略，界面显示「未收录」，**不参与**达标率计算。

## cat 可选值

| 值 | 含义 | 影响 |
|---|---|---|
| `grain` | 谷薯类 | 烹饪缩水率、宝塔「谷薯」层 |
| `legume` | 豆类豆制品 | 宝塔「奶豆」层 |
| `leafy` | 叶菜类 | 缩水率最大（爆炒约 -38%） |
| `rootVeg` | 根茎类 | — |
| `fruitVeg` | 茄果瓜菜 | — |
| `mushroom` | 菌藻类 | 归入「蔬菜」层 |
| `fruit` | 水果类 | 宝塔「水果」层 |
| `meat` | 畜肉类 | 宝塔「肉蛋鱼」层 |
| `poultry` | 禽肉类 | 同上 |
| `egg` | 蛋类 | 同上 |
| `fish` | 鱼虾贝类 | 同上 |
| `dairy` | 奶类 | 宝塔「奶豆」层 |
| `nut` | 坚果种子 | 宝塔「坚果」层 |
| `oil` | 油脂 | 宝塔「油脂」层 |
| `other` | 其他 | 不参与宝塔统计 |

## 上传时的校验

- 必须是 JSON 数组，1–5000 条。
- `name` 非空字符串；`per100.kcal` 必须是 0–950 的数字。
- 其余数值字段：数字或 `null`，不能为负。
- `cat` 必须是上面列出的值之一，否则报错。
- 追加模式按 `name` 去重，重名的会跳过并统计。

校验失败会弹窗列出前 30 条问题（含第几条、哪个字段）。
