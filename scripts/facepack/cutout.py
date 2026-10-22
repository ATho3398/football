# 페이스팩 배경 제거 (C.77u): 사람만 남기고 얼굴·상반신 중심 정사각 PNG 로 만든다. 로컬 전용(네트워크 없음).
# 준비: python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]"  (모델은 ~/.u2net/<모델>.onnx, 없으면 rembg 가 github 에서 받는다)
# 실행: python3 cutout.py <입력> <출력> [--size 128] [--model u2net_human_seg]   (입력·출력을 여러 쌍 줄 수 있다: in1 out1 in2 out2 ...)
# 이미 투명 배경인 원본(불투명 영역 상자 안에 빈 곳이 20% 넘음)은 배경 제거를 건너뛰고 크롭만 한다.
import argparse
import sys

from PIL import Image
from rembg import new_session, remove


def already_cut(img: Image.Image) -> bool:
    if img.mode != 'RGBA':
        return False
    # 옛 128 PNG 는 짧은 쪽을 투명으로 채웠으므로, 불투명 영역의 테두리 상자 안에서만 빈 곳을 센다
    a = img.getchannel('A')
    box = a.point(lambda v: 255 if v > 16 else 0).getbbox()
    if not box:
        return False
    hist = a.crop(box).histogram()
    return sum(hist[:16]) / ((box[2] - box[0]) * (box[3] - box[1])) > 0.2


def head_square(img: Image.Image, size: int) -> Image.Image:
    """알파 영역에서 머리를 위쪽 가운데로 둔 정사각 크롭 → size×size (아래 맞춤)."""
    a = img.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    box = a.getbbox()
    if not box:
        return img.resize((size, size))
    l, t, r, b = box
    w, h = r - l, b - t
    # 머리 가로 중심: 사람 윗부분(높이 18%) 줄의 알파 중심
    top = a.crop((l, t, r, t + max(1, int(h * 0.18))))
    cols = [sum(1 for y in range(top.height) if top.getpixel((x, y))) for x in range(top.width)]
    tot = sum(cols)
    cx = l + (sum(i * c for i, c in enumerate(cols)) / tot if tot else w / 2)
    # 한 변: 상반신이 들어오게 사람 높이의 70% (어깨 폭보다 좁으면 넓힘), 원본 안으로 제한
    side = max(int(h * 0.7), min(w, int(h * 0.95)))
    side = min(side, max(img.width, img.height))
    x0 = int(round(cx - side / 2))
    y0 = max(0, t - int(side * 0.06))
    crop = img.crop((x0, y0, x0 + side, y0 + side))  # 밖은 투명
    return crop.resize((size, size), Image.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('pairs', nargs='+')
    ap.add_argument('--size', type=int, default=128)
    ap.add_argument('--model', default='u2net_human_seg')
    o = ap.parse_args()
    if len(o.pairs) % 2:
        print('입력·출력을 쌍으로 준다', file=sys.stderr)
        return 2
    session = new_session(o.model)
    for src, dst in zip(o.pairs[::2], o.pairs[1::2]):
        img = Image.open(src)
        img.load()
        img = img.convert('RGBA')
        if not already_cut(img):
            # 투명 여백(옛 128 PNG 의 채움)은 흰색으로 깔고 지운 뒤 원래 알파와 곱한다
            base = Image.new('RGBA', img.size, (255, 255, 255, 255))
            base.alpha_composite(img)
            out = remove(base.convert('RGB'), session=session, post_process_mask=True).convert('RGBA')
            alpha = Image.composite(out.getchannel('A'), Image.new('L', img.size, 0), img.getchannel('A'))
            out.putalpha(alpha)
            img = out
        head_square(img, o.size).save(dst, optimize=True)
        print(f'{src} -> {dst}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
