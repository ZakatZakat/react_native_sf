# -*- coding: utf-8 -*-
"""CitySignal · «Выбор редактора» — редактор (Simon Kirsanov) + канал @sartirmsk
сверху (аватары), ниже карточки событий с его рецензиями. Данные — t.me/s/sartirmsk."""
import io, base64, json, re, urllib.request, pathlib
from PIL import Image, ImageDraw, ImageFont

D=json.load(open('/tmp/sartirmsk.json'))
by={p['mid']:p for p in D['reviews']}
PICK=[594,548,567]  # Глубина (Москва) + биеннале (Гардини) + параллельная программа
def sent_trim(t, n=210):
    t=re.sub(r'\s+',' ',t).strip()
    if len(t)<=n: return t
    cut=t[:n]; dot=max(cut.rfind('. '),cut.rfind('! '),cut.rfind('? '))
    return (cut[:dot+1] if dot>90 else cut.rstrip()+'…')

def emb(url,w,h,square=False):
    try:
        raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
        im=Image.open(io.BytesIO(raw)).convert("RGB")
        r=max(w/im.width,h/im.height); im=im.resize((round(im.width*r),round(im.height*r)),Image.LANCZOS)
        im=im.crop(((im.width-w)//2,(im.height-h)//2,(im.width+w)//2,(im.height+h)//2))
        buf=io.BytesIO(); im.save(buf,"JPEG",quality=84); return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()
    except Exception: return None
def monogram(initials, bg="#0D0D0D", w=360, h=280):
    im=Image.new("RGB",(w,h),bg); d=ImageDraw.Draw(im)
    try: f=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",128)
    except: f=ImageFont.load_default()
    d.text((w//2,h//2-6),initials,fill="#fff",anchor="mm",font=f)
    buf=io.BytesIO(); im.save(buf,"JPEG",quality=90); return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()

def emb_fit(im, w=460):
    # без кропа — картинка целиком (сохраняем пропорции)
    im=im.convert("RGB"); h=round(im.height*w/im.width); im=im.resize((w,h),Image.LANCZOS)
    buf=io.BytesIO(); im.save(buf,"JPEG",quality=88); return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()
SIMON_IMG=str(pathlib.Path(__file__).parent/"editor-simon.jpg")
simon=emb_fit(Image.open(SIMON_IMG))
try:
    _raw=urllib.request.urlopen(urllib.request.Request(D['avatar'],headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
    sart=emb_fit(Image.open(io.BytesIO(_raw)))
except Exception:
    sart=monogram("s/a")
esc=lambda s:(s or "").replace("&","&amp;").replace("<","&lt;")
cards=""
for mid in PICK:
    p=by.get(mid)
    if not p: continue
    cover=emb(p['imgs'][0],640,440) if p['imgs'] else None
    exc=sent_trim(p['text'])
    img=f'<img class="cov" src="{cover}">' if cover else '<div class="cov"></div>'
    cards+=f'''<div class="rc">
      <div class="imw">{img}<span class="q">рецензия</span></div>
      <div class="rtext">{esc(exc)}</div>
      <a class="rlink">{esc(p['date'])} · читать в @sartirmsk →</a></div>'''

CSS="""*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
html,body{margin:0;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px}
.wrap{padding:44px 48px 50px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:1180px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.lockup{display:inline-flex;height:50px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 18px;color:#fff;font-weight:900;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.pick{font-weight:900;font-size:14px;letter-spacing:.06em;text-transform:uppercase;padding:9px 13px;background:var(--blue);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.h1{font-weight:900;font-size:62px;letter-spacing:-.04em;line-height:.9;text-transform:uppercase;margin-top:22px}
.hl{color:var(--blue)}
/* редактор + канал — карточки как события, крупнее и небрежно повёрнуты в разные стороны */
.editor{display:flex;gap:34px;margin:30px 0 8px;padding-left:8px}
.ecard{width:250px;background:var(--paper);border:2.5px solid var(--ink);box-shadow:6px 7px 0 var(--ink)}
.ecard.a{transform:rotate(-3.5deg)}
.ecard.b{transform:rotate(3deg);margin-top:18px}
.eimw{border-bottom:2.5px solid var(--ink);background:#fff;line-height:0}
.eimw img{width:100%;height:auto;display:block}
.ecap{padding:13px 15px 15px}
.ename{font-weight:900;font-size:20px;letter-spacing:-.02em;line-height:1.05}
.erole{font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;color:var(--muted);text-transform:uppercase;margin-top:7px}
.erole.b{color:var(--blue)}
.rule{height:3px;background:var(--ink);margin:26px 0 28px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;align-items:start}
.rc{display:flex;flex-direction:column;background:var(--paper);border:2.5px solid var(--ink);box-shadow:5px 6px 0 var(--ink)}
.imw{position:relative;border-bottom:2.5px solid var(--ink);background:#E4E4E1;line-height:0}
.cov{width:100%;height:210px;object-fit:cover;display:block}
.q{position:absolute;bottom:9px;left:9px;background:var(--red);color:#fff;font-weight:900;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border:1.5px solid var(--ink);box-shadow:1.5px 1.5px 0 var(--ink)}
.rtext{padding:15px 16px 6px;font-size:15px;line-height:1.4;color:var(--ink)}
.rlink{display:block;padding:6px 16px 16px;font-family:var(--mono);font-size:11.5px;letter-spacing:.03em;color:var(--blue);font-weight:700}
.foot{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:36px}"""

HTML=f"""<title>CitySignal · Выбор редактора</title><style>{CSS}</style>
<div class="wrap"><div class="inner">
 <div class="top"><div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
 <span class="pick">★ выбор редактора</span></div>
 <div class="h1">Выбор <span class="hl">редактора</span></div>
 <div class="editor">
   <div class="ecard a"><div class="eimw"><img src="{simon}"></div><div class="ecap"><div class="ename">Simon Kirsanov</div><div class="erole">арт-редактор</div></div></div>
   <div class="ecard b"><div class="eimw"><img src="{sart}"></div><div class="ecap"><div class="ename">@sartirmsk</div><div class="erole b">канал редактора</div></div></div>
 </div>
 <div class="rule"></div>
 <div class="grid">{cards}</div>
 <div class="foot">рецензии редактора · полные тексты — в @sartirmsk</div>
</div></div>"""
out=pathlib.Path(__file__).parent/"editor_pick.html"; out.write_text(HTML,encoding="utf-8"); print("wrote",out)
