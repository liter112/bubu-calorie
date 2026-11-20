"""Download the public 《中国食物成分表》JSON conversion from GitHub.

Only reads the per-category merged_*.json files; screenshots are ignored.
Output: data/cfct-raw.json  (array of raw rows + category metadata)
"""
import json
import os
import sys
import time
import urllib.request
from urllib.parse import quote

REPO = "Sanotsu/china-food-composition-data"
BRANCH = "main"
DIR = "json_data_v3_20260825_qwen38max_kimi_k3_fixed"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

UA = {"User-Agent": "nutri-app-builder/1.0"}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    tree_url = f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1"
    tree = json.loads(get(tree_url))
    paths = [
        n["path"]
        for n in tree.get("tree", [])
        if n.get("type") == "blob"
        and n["path"].startswith(DIR + "/")
        and n["path"].endswith(".json")
        and "log" not in os.path.basename(n["path"]).lower()
    ]
    print(f"tree entries: {len(tree.get('tree', []))}, food files: {len(paths)}")
    rows = []
    failed = []
    for i, p in enumerate(sorted(paths), 1):
        name = os.path.basename(p)
        category = name[len("merged_"):-len(".json")]
        url = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/" + quote(p)
        try:
            data = json.loads(get(url))
        except Exception as e:  # noqa: BLE001
            failed.append((p, repr(e)))
            print(f"  FAIL {name}: {e}")
            continue
        if not isinstance(data, list):
            failed.append((p, "not a list"))
            continue
        for rec in data:
            if isinstance(rec, dict):
                rec["_category"] = category
                rec["_file"] = name
                rows.append(rec)
        print(f"  [{i}/{len(paths)}] {name}: {len(data)} rows (total {len(rows)})")
        time.sleep(0.05)

    out = os.path.join(OUT_DIR, "cfct-raw.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"source": REPO, "dir": DIR, "failed": failed, "rows": rows}, f,
                  ensure_ascii=False, indent=1)
    print(f"wrote {out}: {len(rows)} rows, {len(failed)} failed files")
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
