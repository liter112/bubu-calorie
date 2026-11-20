"""Retry the CFCT files that failed with connection resets, then merge back."""
import json
import os
import sys
import time
import urllib.request
from urllib.parse import quote

REPO = "Sanotsu/china-food-composition-data"
BRANCH = "main"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "data", "cfct-raw.json")
UA = {"User-Agent": "nutri-app-builder/1.0"}


def get(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    with open(RAW, encoding="utf-8") as f:
        doc = json.load(f)
    rows = doc["rows"]
    failed = doc.get("failed") or []
    still = []
    print(f"retrying {len(failed)} files, {len(rows)} rows loaded")
    for path, _err in failed:
        name = os.path.basename(path)
        category = name[len("merged_"):-len(".json")]
        url = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/" + quote(path)
        ok = False
        for attempt in range(6):
            try:
                data = json.loads(get(url))
                if not isinstance(data, list):
                    raise ValueError("not a list")
                for rec in data:
                    if isinstance(rec, dict):
                        rec["_category"] = category
                        rec["_file"] = name
                        rows.append(rec)
                print(f"  OK {name}: {len(data)} rows (attempt {attempt + 1})")
                ok = True
                break
            except Exception as e:  # noqa: BLE001
                wait = 2 ** attempt
                print(f"  retry {name} in {wait}s: {e}")
                time.sleep(wait)
        if not ok:
            still.append((path, "retries exhausted"))
        time.sleep(0.4)

    # de-duplicate by foodCode + category (keep first)
    seen = set()
    deduped = []
    for r in rows:
        key = (str(r.get("foodCode", "")).strip(), r.get("_category", ""))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    doc["rows"] = deduped
    doc["failed"] = still
    with open(RAW, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"now {len(deduped)} rows, {len(still)} files still failing")
    return 0 if not still else 2


if __name__ == "__main__":
    sys.exit(main())
