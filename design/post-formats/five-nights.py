# -*- coding: utf-8 -*-
"""CitySignal · неделя в редакторском serif-списке (à la портфолио-индекс):
крупное название засечками + мини-превью (реальный постер из ленты или цветная
плашка по категории) + дата справа."""
import base64, io, json, re, urllib.request, pathlib, unicodedata
from PIL import Image

FEED=[]
for off in range(0,800,200):
    d=json.load(urllib.request.urlopen(f"https://citysignal.digital-assistant.tech/curator/me/feed?limit=200&offset={off}",timeout=40))
    items=d if isinstance(d,list) else d.get('items',[])
    if not items: break
    FEED+=items

def low(s):
    s=unicodedata.normalize('NFKD',(s or '').lower())
    return ''.join(c for c in s if not unicodedata.combining(c))  # ё→е, й→и и т.п.
def poster_for(keyword):
    kw=low(keyword)
    for e in FEED:
        blob=low((e.get('title') or '')+' '+(e.get('description') or '')+' '+str(e.get('venue') or ''))
        if kw in blob:
            for u in (e.get('media_urls') or []):
                if re.search(r'\.(jpe?g|png|webp)', u or '', re.I):
                    return u if u.startswith('http') else "https://citysignal.digital-assistant.tech"+u
    return None
def thumb_b64(url):
    try:
        raw=urllib.request.urlopen(url,timeout=25).read()
        im=Image.open(io.BytesIO(raw)).convert("RGB")
        s=min(im.size); im=im.crop(((im.width-s)//2,(im.height-s)//2,(im.width+s)//2,(im.height+s)//2)).resize((120,120),Image.LANCZOS)
        buf=io.BytesIO(); im.save(buf,"JPEG",quality=80)
        return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None

# палитра только наша
CATCOL={"art":"#0D0D0D","music":"#0055FF","party":"#0055FF","cinema":"#E0162B","stage":"#E0162B","food":"#0D0D0D","talk":"#0D0D0D"}
# выборка ПРЯМО из ленты: (уникальная подстрока названия, короткое имя для списка, категория)
# у каждого события берём его собственный постер и реальную дату.
PICKS=[
 ("Ярмарка Blazar","Ярмарка Blazar — Set Projects","art"),
 ("Инструментариум","«Инструментариум» — Ходынка","art"),
 ("DEL SOTOS","Сёрф-рок: DEL SOTOS","music"),
 ("Сумерки","Показ «Сумерки» — Парк Горького","cinema"),
 ("Кусково","Свободный день в Кускове","art"),
]
def find_event(sub):
    k=low(sub)
    best=None
    for e in FEED:
        if k in low(e.get('title') or ''):
            img=next((u for u in (e.get('media_urls') or []) if re.search(r'\.(jpe?g|png|webp)',u or '',re.I)), None)
            if img:
                url=img if img.startswith('http') else "https://citysignal.digital-assistant.tech"+img
                d=str(e.get('event_time') or '')[:10]
                dd=(d[8:10]+"."+d[5:7]) if len(d)==10 else ""
                return url, dd
    return None, ""
rows=[]; got=0
esc=lambda s: s.replace("&","&amp;").replace("<","&lt;")
for sub,name,cat in PICKS:
    url,date=find_event(sub)
    b64=thumb_b64(url) if url else None
    if b64: got+=1
    thumb=(f'<span class="th"><img src="{b64}" alt=""></span>' if b64
           else f'<span class="th ph"><span class="sw" style="background:{CATCOL[cat]}"></span></span>')
    rows.append(f'<div class="row"><span class="nm">{esc(name)}</span>{thumb}<span class="dt">{date or "—"}</span></div>')
print("posters matched:",got,"/",len(PICKS))

CSS="""*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
html,body{margin:0;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px}
.wrap{padding:44px 48px 48px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:1040px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.lockup{display:inline-flex;height:50px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 18px;color:#fff;font-weight:900;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.hd-meta{display:flex;flex-direction:column;align-items:flex-end;gap:9px}
.dstamp{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.05em;padding:9px 13px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue);text-transform:uppercase}
.pick{font-weight:900;font-size:13.5px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;background:var(--blue);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.h1{font-weight:900;font-size:64px;letter-spacing:-.04em;line-height:.9;text-transform:uppercase;margin-top:22px}
.hl{color:var(--blue)}
.rule{height:3px;background:var(--ink);margin:18px 0 8px}
.list{margin-top:14px}
.row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:9px 0;border-bottom:1.5px solid var(--line)}
.row:last-of-type{border-bottom:0}
.nm{font-weight:800;font-size:33px;line-height:1.02;letter-spacing:-.025em;color:var(--ink)}
.th{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:2px solid var(--ink);box-shadow:2.5px 2.5px 0 var(--ink);overflow:hidden;flex:0 0 auto;transform:translateY(1px)}
.th img{width:100%;height:100%;object-fit:cover;display:block}
.th.ph{background:#E4E4E1}
.th.ph .sw{width:15px;height:15px;border:1.5px solid var(--ink)}
.dt{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.05em;color:var(--ink);background:var(--paper);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue);padding:6px 10px}
.foot{margin-top:34px;font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}"""

HTML=f"""<title>CitySignal · Неделя</title><style>{CSS}</style>
<div class="wrap"><div class="inner">
  <div class="top">
    <div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
    <div class="hd-meta"><span class="dstamp">Четверг · 17.09</span><span class="pick">★ вечер</span></div>
  </div>
  <div class="h1">Пять <span class="hl">вечеров</span></div>
  <div class="rule"></div>
  <div class="list">{''.join(rows)}</div>
  <div class="foot">куда пойти после работы · полная афиша — в приложении</div>
</div></div>"""
out=pathlib.Path(__file__).parent/"fivenights.html"
out.write_text(HTML,encoding="utf-8")
print("wrote",out)
