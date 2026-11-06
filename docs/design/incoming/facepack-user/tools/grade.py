import sys
from PIL import Image, ImageEnhance, ImageFilter, ImageChops
import numpy as np
def grade(src,dst,fade=0.22):
    im=Image.open(src).convert('RGBA'); a=im.getchannel('A'); rgb=im.convert('RGB')
    # 선명: 디테일(clarity) + 언샵
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=6,percent=60,threshold=2))
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=1.2,percent=120,threshold=1))
    # 톤: S커브 대비, 채도, 살짝 따뜻한 하이라이트·차가운 그림자
    x=np.asarray(rgb).astype(np.float32)/255
    x=np.clip(x,0,1); s=x*x*(3-2*x); x=0.55*s+0.45*x       # S커브
    lum=(0.299*x[...,0]+0.587*x[...,1]+0.114*x[...,2])[...,None]
    x=lum+(x-lum)*1.22                                      # 채도
    x[...,0]+=0.025*lum[...,0]; x[...,2]+=0.03*(1-lum[...,0])-0.015  # 하이라이트 따뜻·그림자 푸른
    x=np.clip(x,0,1)
    rgb=Image.fromarray((x*255).astype(np.uint8))
    rgb=ImageEnhance.Brightness(rgb).enhance(1.03)
    # 아래쪽 페이드(피파 미페처럼)
    A=np.asarray(a).astype(np.float32)
    h=A.shape[0]; rows=np.linspace(0,1,h)[:,None]
    f=np.clip((1-rows)/fade,0,1)**2.2; A=A*f
    out=rgb.convert('RGBA'); out.putalpha(Image.fromarray(A.astype(np.uint8)))
    out.save(dst)
grade(sys.argv[1],sys.argv[2],float(sys.argv[3]) if len(sys.argv)>3 else 0.22)
