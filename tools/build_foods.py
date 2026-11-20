"""Turn data/cfct-raw.json into src/js/data-foods.js + data/qc-report.md.

No network access: reads local files only.
"""
import json
import os
import re
import sys
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "data", "cfct-raw.json")
SUPP = os.path.join(BASE, "data", "supplement-usda.json")
OUT_JS = os.path.join(BASE, "src", "js", "data-foods.js")
QC = os.path.join(BASE, "data", "qc-report.md")

CAT_MAP = [
    ("谷类及其制品", "grain"),
    ("薯类淀粉", "grain"),
    ("干豆类及其制品", "legume"),
    ("蔬菜类及其制品-嫩茎叶花菜", "leafy"),
    ("蔬菜类及其制品-野生蔬菜", "leafy"),
    ("蔬菜类及其制品-根菜", "rootVeg"),
    ("蔬菜类及其制品-薯芋", "rootVeg"),
    ("蔬菜类及其制品-水生蔬菜", "rootVeg"),
    ("蔬菜类及其制品-茄果瓜菜", "fruitVeg"),
    ("蔬菜类及其制品-鲜豆", "fruitVeg"),
    ("蔬菜类及其制品-葱蒜", "fruitVeg"),
    ("菌藻类", "mushroom"),
    ("水果类及其制品", "fruit"),
    ("畜肉类及其制品", "meat"),
    ("禽肉类及其制品", "poultry"),
    ("乳类及其制品", "dairy"),
    ("蛋类及其制品", "egg"),
    ("鱼虾蟹贝类", "fish"),
    ("坚果种子类", "nut"),
    ("植物油", "oil"),
    ("动物油脂类", "oil"),
]

FIELD_MAP = {
    "energyKCal": "kcal", "protein": "protein", "fat": "fat",
    "CHO": "carb", "dietaryFiber": "fiber", "cholesterol": "cholesterol",
    "vitaminA": "va", "carotene": "carotene", "retinol": "retinol",
    "thiamin": "b1", "riboflavin": "b2", "niacin": "niacin",
    "vitaminC": "vc", "vitaminETotal": "ve",
    "Ca": "calcium", "P": "phosphorus", "K": "potassium", "Na": "sodium",
    "Mg": "magnesium", "Fe": "iron", "Zn": "zinc", "Se": "selenium",
    "Cu": "copper", "Mn": "manganese",
}

SPECIAL_RULES = [
    (("蓝莓",), "花青素", "约 100–400 mg/100 g（品种差异大）", "强抗氧化，可能有助于缓解视疲劳"),
    (("紫甘蓝", "紫薯", "黑米", "黑豆", "紫葡萄", "桑葚", "紫玉米"), "花青素", "含量较高",
     "深紫/黑色食材的花青素主要集中在外皮"),
    (("番茄", "西瓜", "西柚", "番石榴"), "番茄红素", "含量较高", "脂溶性，加热后更易吸收"),
    (("菠菜", "羽衣甘蓝", "玉米", "蛋黄", "南瓜"), "叶黄素/玉米黄素", "含量较高",
     "集中在视网膜黄斑区，帮助过滤蓝光"),
    (("西兰花", "芥蓝", "萝卜", "卷心菜", "羽衣甘蓝"), "萝卜硫素/硫代葡萄糖苷", "含量较高",
     "十字花科特有，切碎静置 10 分钟再烹调更利于保留"),
    (("大蒜", "洋葱", "韭菜", "葱"), "有机硫化物（大蒜素）", "含量较高",
     "捣碎后静置 10 分钟再下锅，可提高大蒜素生成"),
    (("黄豆", "豆腐", "豆浆", "腐竹", "豆皮", "毛豆"), "大豆异黄酮", "约 20–60 mg/100 g",
     "植物雌激素，对骨骼和更年期有益"),
    (("绿茶", "茶叶"), "儿茶素（EGCG）", "含量较高", "抗氧化，避免空腹大量饮用"),
    (("三文鱼", "鲈鱼", "带鱼", "黄花鱼", "鳕鱼", "沙丁鱼", "鲑鱼"), "DHA/EPA", "含量较高",
     "Omega-3 脂肪酸，对心血管和大脑有益"),
    (("燕麦", "莜麦"), "β-葡聚糖", "约 3–5 g/100 g", "可溶性纤维，帮助稳定餐后血糖"),
    (("亚麻籽", "芝麻", "葵花籽"), "木酚素", "含量较高", "植物雌激素，建议碾碎后食用"),
    (("核桃",), "α-亚麻酸", "含量较高", "植物性 Omega-3，每天 2–3 个即可"),
    (("生姜",), "姜辣素", "含量较高", "暖胃，缓解恶心"),
]


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if s in ("", "—", "-", "--", "…", "ND"):
        return None
    if s.lower() in ("tr", "trace"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def cat_of(raw_cat):
    for key, cat in CAT_MAP:
        if raw_cat.startswith(key):
            return cat
    return "other"


def split_name(name):
    alias = []
    m = re.search(r"[［\[【]([^］\]】]*)[］\]】]", name)
    if m:
        alias = [a.strip() for a in re.split(r"[、，,;；/]", m.group(1)) if 1 < len(a.strip()) <= 12]
        name = (name[:m.start()] + name[m.end():]).strip()
    name = re.sub(r"[（(](代表值|均值|平均)[）)]", "", name).strip()
    return name, alias[:4]


def specials(name, carotene, existing=None):
    out = list(existing or [])
    seen = {s["n"] for s in out}
    for keys, nutrient, amount, note in SPECIAL_RULES:
        if nutrient in seen:
            continue
        if any(k in name for k in keys):
            out.append({"n": nutrient, "a": amount, "d": note})
            seen.add(nutrient)
    if carotene and carotene >= 1000 and "β-胡萝卜素" not in seen:
        out.append({"n": "β-胡萝卜素", "a": f"{carotene:g} µg/100 g",
                    "d": "维生素 A 前体，脂溶性，配油烹调吸收更好"})
    return out


COMMON_PREFIXES = [
    # 谷薯
    "米饭", "稻米", "大米", "糙米", "糯米", "小米", "黄米", "玉米", "小麦粉", "面粉",
    "面条", "挂面", "馒头", "面包", "燕麦", "荞麦", "莜麦", "高粱", "薏米", "藜麦",
    "红薯", "马铃薯", "甘薯", "山药", "芋头", "紫薯", "粉丝", "米粉", "年糕", "油条",
    # 豆类豆制品
    "黄豆", "大豆", "黑豆", "绿豆", "红小豆", "赤豆", "芸豆", "豌豆", "蚕豆", "鹰嘴豆",
    "豆腐", "豆腐干", "豆腐皮", "豆浆", "腐竹", "豆芽", "毛豆", "豆角", "四季豆", "荷兰豆",
    # 蔬菜
    "大白菜", "小白菜", "油菜", "菠菜", "生菜", "油麦菜", "空心菜", "苋菜", "芹菜", "韭菜",
    "茼蒿", "芥蓝", "西兰花", "菜花", "卷心菜", "紫甘蓝", "番茄", "西红柿", "黄瓜", "茄子",
    "青椒", "彩椒", "尖椒", "冬瓜", "南瓜", "西葫芦", "苦瓜", "丝瓜", "白萝卜", "胡萝卜",
    "莲藕", "洋葱", "大葱", "蒜", "姜", "香菇", "平菇", "金针菇", "木耳", "银耳",
    "海带", "紫菜", "竹笋", "芦笋", "莴笋", "荸荠", "秋葵", "甜椒",
    # 水果
    "苹果", "香蕉", "橙", "柑橘", "橘", "柚", "梨", "桃", "葡萄", "西瓜", "哈密瓜",
    "草莓", "蓝莓", "樱桃", "猕猴桃", "芒果", "菠萝", "火龙果", "石榴", "柿", "鲜枣",
    "柠檬", "牛油果", "杏", "李子", "杨梅", "荔枝", "龙眼", "枇杷", "山楂",
    # 肉禽蛋
    "猪肉", "猪里脊", "瘦猪肉", "五花肉", "猪蹄", "猪肝", "猪血", "猪排", "牛肉",
    "牛腩", "牛腱", "羊肉", "羊排", "鸡胸脯肉", "鸡腿", "鸡翅", "鸡爪", "鸭肉",
    "鸡蛋", "鸭蛋", "鹌鹑蛋", "咸鸭蛋", "皮蛋",
    # 水产
    "草鱼", "鲤鱼", "鲈鱼", "鲫鱼", "带鱼", "黄花鱼", "鲑鱼", "鳕鱼", "鲳鱼", "鲫",
    "虾", "基围虾", "河虾", "对虾", "蟹", "蛤蜊", "牡蛎", "扇贝", "鱿鱼", "海参", "虾皮",
    # 奶
    "牛乳", "牛奶", "酸奶", "奶酪", "奶粉", "羊奶", "炼乳",
    # 坚果油籽
    "花生", "核桃", "杏仁", "腰果", "开心果", "榛子", "芝麻", "葵花子", "南瓜子",
    "松子", "栗子", "板栗", "莲子", "亚麻籽", "奇亚籽",
    # 油与调味
    "菜籽油", "花生油", "大豆油", "橄榄油", "玉米油", "芝麻油", "香油", "调和油",
    "蜂蜜", "白砂糖", "绵白糖", "酱油", "醋", "精盐", "食盐",
]


def is_common(name, cat):
    for p in COMMON_PREFIXES:
        if name.startswith(p):
            return True
    return False


def main():
    doc = json.load(open(RAW, encoding="utf-8"))
    rows = doc["rows"]
    foods, seen_ids = [], set()
    qc_bad, qc_macro, names = [], [], Counter()

    for r in rows:
        raw_name = str(r.get("foodName", "")).strip()
        if not raw_name:
            qc_bad.append((r.get("foodCode"), "名称为空"))
            continue
        name, alias = split_name(raw_name)
        if not name:
            qc_bad.append((r.get("foodCode"), "清理后名称为空"))
            continue
        names[name] += 1
        cat = cat_of(r.get("_category", ""))
        per100 = {}
        for src, dst in FIELD_MAP.items():
            v = num(r.get(src))
            if v is not None:
                per100[dst] = round(v, 3)
        kcal = per100.get("kcal")
        if kcal is None:
            qc_bad.append((r.get("foodCode"), "缺少能量值"))
            continue
        p = per100.get("protein") or 0
        f = per100.get("fat") or 0
        c = per100.get("carb") or 0
        calc = 4 * p + 9 * f + 4 * c
        if kcal > 25 and abs(calc - kcal) / kcal > 0.3:
            qc_macro.append((name, r.get("foodCode"), round(calc), kcal))
        if not (0 <= kcal <= 950):
            qc_bad.append((r.get("foodCode"), f"能量异常 {kcal}"))

        fid = "cn" + str(r.get("foodCode", "")).strip()
        if fid in seen_ids:
            fid += "_" + str(len(foods))
        seen_ids.add(fid)

        rec = {"id": fid, "name": name, "cat": cat, "per100": per100}
        if alias:
            rec["alias"] = alias
        if is_common(name, cat):
            rec["common"] = True
        remark = str(r.get("remark", "") or "").strip()
        if remark:
            rec["remark"] = remark
        sp = specials(name, per100.get("carotene"))
        if sp:
            rec["special"] = sp
        foods.append(rec)

    # USDA 补充的常见食材（蓝莓、牛油果、藜麦等中国成分表未收录）
    if os.path.exists(SUPP):
        for s in json.load(open(SUPP, encoding="utf-8")):
            s = dict(s)
            fid = s["id"]
            if fid in seen_ids:
                continue
            seen_ids.add(fid)
            s["per100"] = {k: v for k, v in s["per100"].items() if v is not None}
            foods.append(s)

    dup_names = [n for n, c in names.items() if c > 1]

    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    payload = json.dumps(foods, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("/* 内置《中国食物成分表》(第6版) + USDA 补充数据，由 tools/build_foods.py 生成 */\n")
        fh.write("window.Nutri = window.Nutri || {};\n")
        fh.write("Nutri.foods = " + payload + ";\n")
        fh.write("Nutri.foodIndex = (function(){var m={};Nutri.foods.forEach(function(f){m[f.id]=f;});return m;})();\n")

    size = os.path.getsize(OUT_JS) / 1024
    lines = [
        "# 食材数据质检报告", "",
        "- 源文件：`data/cfct-raw.json`（《中国食物成分表》第 6 版「能量和一般营养成分」公开转换版）"
        " + `data/supplement-usda.json`（USDA 补充，标注 `est:true`）",
        f"- 原始行数：{len(rows)}", f"- 成功转换：{len(foods)}",
        f"- 生成文件：`src/js/data-foods.js`（{size:.0f} KB）", "",
        "## 字段口径", "",
        "- 全部数值为每 100 g **可食部**含量；`—` = 未检出/未收录（字段省略 = null）；`Tr` = 微量（记 0）。",
        "- `carotene` 为胡萝卜素（µg），`va` 为维生素 A（µgRAE），`ve` 为维生素 E 总量（mg）。",
        "- 糖、维生素 B6/B12、叶酸、维生素 D/K、碘、胆碱 **第 6 版未收录**，界面显示「未收录」；"
        "拿到 USDA KEY 后可联网补全。", "",
        "## 能量-宏量偏差 >30% 的条目（可能录入/转换误差）", "",
    ]
    if qc_macro:
        lines += ["| 食物 | 编码 | 按宏量计算 kcal | 表列 kcal |", "|---|---|---|---|"]
        for n, code, calc, k in qc_macro[:60]:
            lines.append(f"| {n} | {code} | {calc} | {k} |")
        if len(qc_macro) > 60:
            lines.append(f"\n（共 {len(qc_macro)} 条，仅列前 60）")
    else:
        lines.append("无。")
    lines += ["", "## 缺关键字段被跳过的条目", ""]
    lines += [f"- `{code}`：{why}" for code, why in qc_bad[:60]] or ["无。"]
    lines += ["", "## 同名食物（均保留，建议核对后再用）", ""]
    lines.append("、".join(dup_names) if dup_names else "无。")
    with open(QC, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"foods={len(foods)} size={size:.0f}KB macro_anomalies={len(qc_macro)} "
          f"bad={len(qc_bad)} dup_names={len(dup_names)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
