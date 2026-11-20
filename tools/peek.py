import json, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
txt = open(os.path.join(BASE, "src", "js", "data-foods.js"), encoding="utf-8").read()
txt = txt[txt.index("Nutri.foods = ") + len("Nutri.foods = "):]
foods = json.loads(txt[:txt.index(";\nNutri.foodIndex")])
want = sys.argv[1:] or ["胡萝卜", "鸡胸", "米饭", "蓝莓", "鸡蛋", "西兰花", "豆腐", "三文鱼"]
for w in want:
    hit = [f for f in foods if w in f["name"]][:3]
    print(f"== {w}: {len([f for f in foods if w in f['name']])} hits")
    for f in hit:
        print("  ", f["name"], f["cat"], json.dumps(f["per100"], ensure_ascii=False)[:260])
print("total", len(foods))
