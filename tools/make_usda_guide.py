"""把 USDA FoodData Central 截图转成 README 用的图文教程配图。

- 缩放到宽 1600
- 自动框住展开的 DATA 下拉菜单，以及最下面的 GET AN API KEY
- 底部加一条中文说明
用法：<dsh 内置 python> tools/make_usda_guide.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

SRC = r"C:\Users\明亮\.dsh\attachments\v1\objects\26\2632103c9a78e64ab6251b2e9c35d5cb8ffeec92f535cac248e695f51337924f"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "docs")
OUT = os.path.join(OUT_DIR, "usda-api-step1.jpg")
DEBUG_CROP = os.path.join(OUT_DIR, "_menu_crop.png")

RED = (222, 32, 32)
W_TARGET = 1600
FONT = r"C:\Windows\Fonts\msyh.ttc"


def is_blue(p):
    r, g, b = p
    return r < 70 and 85 <= g <= 150 and b > 150


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    im = im.resize((W_TARGET, round(im.height * W_TARGET / im.width)), Image.LANCZOS)
    W, H = im.size
    px = im.load()

    # 1. 找横贯全宽的导航条
    nav_rows = []
    for y in range(0, int(H * 0.35)):
        cnt = sum(1 for x in range(0, W, 4) if is_blue(px[x, y]))
        if cnt > (W / 4) * 0.6:
            nav_rows.append(y)
    nav_bottom = max(nav_rows) if nav_rows else int(H * 0.16)

    # 2. 从导航条正下方那一行找最长的蓝色连续段 = 下拉菜单宽度
    row = min(nav_bottom + 2, H - 1)
    runs, start = [], None
    for x in range(0, W):
        if is_blue(px[x, row]):
            if start is None:
                start = x
        else:
            if start is not None and x - start > 30:
                runs.append((start, x - 1))
            start = None
    if start is not None and W - start > 30:
        runs.append((start, W - 1))
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    print("row", row, "runs", runs[:3])

    if runs:
        x0, x1 = runs[0]
        y = row
        last = row
        while y < int(H * 0.55):
            cnt = sum(1 for x in range(x0, x1 + 1, 2) if is_blue(px[x, y]))
            if cnt < (x1 - x0) / 2 * 0.5:
                break
            last = y
            y += 2
        box = (x0, row, x1, last)
    else:
        box = (int(W * 0.29), int(H * 0.17), int(W * 0.46), int(H * 0.47))
    x0, y0, x1, y1 = box
    print("nav_bottom", nav_bottom, "menu box", box)

    # 调试：把菜单区域裁出来看一眼
    im.crop((max(0, x0 - 20), max(0, y0 - 20), min(W, x1 + 20), min(H, y1 + 20))).save(DEBUG_CROP)

    draw = ImageDraw.Draw(im)
    # 整个下拉菜单：细红框
    draw.rounded_rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], radius=8, outline=RED, width=4)
    # 最后一项 GET AN API KEY：粗红框（菜单 5 项，最后一项在底部约 20%）
    ih = y1 - y0
    draw.rounded_rectangle([x0 - 2, y0 + ih * 0.775, x1 + 2, y0 + ih * 0.97],
                           radius=6, outline=RED, width=7)

    # 3. 底部说明条
    try:
        font = ImageFont.truetype(FONT, 30)
    except Exception:
        font = ImageFont.load_default()

    text = "① 顶部 DATA 菜单    ② 点最下面的 GET AN API KEY"
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    pad = 18
    try:
        tw = od.textlength(text, font=font)
    except Exception:
        tw = 900
    bx0 = int((W - tw) / 2 - pad * 1.6)
    bx1 = int((W + tw) / 2 + pad * 1.6)
    by0, by1 = H - 96, H - 26
    od.rounded_rectangle([bx0, by0, bx1, by1], radius=12, fill=(0, 0, 0, 185))
    od.text(((W - tw) / 2, by0 + 10), text, font=font, fill=(255, 255, 255, 255))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")

    im.save(OUT, "JPEG", quality=90, optimize=True, progressive=True)
    size = os.path.getsize(OUT) / 1024
    print("wrote", OUT, f"{size:.0f} KB", im.size)


if __name__ == "__main__":
    main()
