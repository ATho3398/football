# 안드로이드 앱 아이콘·스플래시 (C.77v): PWA 아이콘(public/icons)으로 android/app/src/main/res 의 PNG 를 다시 만든다.
# 실행: python3 scripts/android-icons.py (Pillow 필요). 결과 PNG 는 커밋한다 — CI 는 이 스크립트를 돌리지 않는다
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
ICON = Image.open(ROOT / 'public/icons/icon-512.png').convert('RGBA')
MASK = Image.open(ROOT / 'public/icons/maskable-512.png').convert('RGBA')
BG = (22, 23, 27, 255)  # #16171b = manifest background_color
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

for d, k in DENS.items():
    out = RES / f'mipmap-{d}'
    # 옛 런처(48dp): 둥근 사각 아이콘 그대로, 둥근 아이콘은 원으로 자른다
    n = round(48 * k)
    ICON.resize((n, n), Image.LANCZOS).save(out / 'ic_launcher.png')
    m = MASK.resize((n, n), Image.LANCZOS)
    circle = Image.new('L', (n, n), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, n - 1, n - 1), fill=255)
    r = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    r.paste(m, (0, 0), circle)
    r.save(out / 'ic_launcher_round.png')
    # 적응형 아이콘 앞면(108dp): maskable 의 안전 영역(지름 80%)이 적응형 안전 영역(66dp)에 들어오게 82dp 로 줄여 가운데
    c = round(108 * k)
    s = round(82 * k)
    fg = Image.new('RGBA', (c, c), BG)
    fg.paste(MASK.resize((s, s), Image.LANCZOS), ((c - s) // 2, (c - s) // 2))
    fg.save(out / 'ic_launcher_foreground.png')

# 스플래시(안드로이드 11 이하): 어두운 바탕 가운데 아이콘
for p in RES.glob('drawable*/splash.png'):
    w, h = Image.open(p).size
    im = Image.new('RGBA', (w, h), BG)
    s = min(w, h) // 3
    im.paste(ICON.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2), ICON.resize((s, s), Image.LANCZOS))
    im.convert('RGB').save(p)
