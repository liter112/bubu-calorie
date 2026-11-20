"""把 src/ 下的 CSS/JS/数据内联成一个可双击打开的 index.html。"""
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "src")
OUT = os.path.join(BASE, "index.html")

CSS_FILES = ["base.css", "components.css", "mascot.css"]

JS_FILES = [
    "data-targets.js",
    "data-cooking.js",
    "data-tips.js",
    "engine.js",
    "library.js",
    "store.js",
    "recommend.js",
    "usda.js",
    "mascot.js",
    "ui.js",
    "selftest.js",
    "app.js",
]


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def main():
    tpl = read(os.path.join(SRC, "index.template.html"))
    css = "\n".join("/* ---- %s ---- */\n%s" % (f, read(os.path.join(SRC, "styles", f)))
                    for f in CSS_FILES)
    data = read(os.path.join(SRC, "js", "data-foods.js"))
    js = "\n".join("/* ---- %s ---- */\n%s" % (f, read(os.path.join(SRC, "js", f)))
                   for f in JS_FILES)

    html = tpl.replace("/*__CSS__*/", css)
    html = html.replace("/*__DATA__*/", data)
    html = html.replace("/*__JS__*/", js)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    size = os.path.getsize(OUT) / 1024
    print("wrote %s (%.0f KB)" % (OUT, size))
    return 0


if __name__ == "__main__":
    sys.exit(main())
