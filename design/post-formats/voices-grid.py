# -*- coding: utf-8 -*-
"""CitySignal · «Голоса» — журнально-сеточный формат В НАШЕМ СТИЛЕ + аватар канала
(видно, кто говорит). Данные — /wall; аватарки — og:image с t.me/<handle>."""
import io, base64, urllib.request, json, re, time, pathlib
from PIL import Image, ImageDraw, ImageFont

wall=json.load(urllib.request.urlopen("https://citysignal.digital-assistant.tech/curator/wall?limit=60",timeout=40))["items"]
def pick(ch_sub, txt_sub):
    for w in wall:
        if ch_sub.lower() in w.get("channel_title","").lower() and txt_sub.lower() in w.get("text","").lower() and w.get("images"):
            return w
    for w in wall:
        if ch_sub.lower() in w.get("channel_title","").lower() and w.get("images"):
            return w
    return None
# (канал-подстрока, текст-подстрока, рубрика, заголовок, дата, выжимка)
SPEC=[
 ("dada","гост","Выставка","«Гост. Россия. 1967–2026»","14.09","О реновации Зарядья, стройке и сносе гостиницы «Россия». В Подклете Английского двора."),
 ("китч","исток","Находка","Буфет «Исток»","14.09","Посиделки на загородной даче: самовары, фрукты, винтажная мебель и домашняя кухня."),
 ("китч","veladore","Маркет","Блошиный рынок в Veladore","12.09","Заключительная барахолка сезона — охота за сокровищами во дворе."),
 ("аганёк","хандр","Заметка","Места от осенней хандры","13.09","Собрали места, которые сохраняют ментальное здоровье и убирают хандру."),
 ("музей","андрей","Взгляд","С добрым утром, Андрейка","14.09","Алексей Канцуров, 1980 — с выставки «Ненаивное наивное» в Царицыне."),
 ("1artchannel","cosmoscow","Новость","Любимчик Cosmoscow — в 12storeez","15.09","Тот самый арт-объект с ярмарки поселился в магазине на Петровке."),
]
CATCOL={"Выставка":"#0D0D0D","Находка":"#0055FF","Маркет":"#0055FF","Заметка":"#0D0D0D","Взгляд":"#E0162B","Новость":"#E0162B"}

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
def emb_cover(url, w, h):
    for _ in range(3):
        try:
            im=Image.open(io.BytesIO(fetch(url))).convert("RGB")
            r=max(w/im.width, h/im.height); im=im.resize((round(im.width*r),round(im.height*r)),Image.LANCZOS)
            im=im.crop(((im.width-w)//2,(im.height-h)//2,(im.width+w)//2,(im.height+h)//2))
            buf=io.BytesIO(); im.save(buf,"JPEG",quality=82); return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()
        except Exception: time.sleep(0.5)
    return None
def avatar(handle, name):
    # og:image с t.me/<handle> = аватар канала
    try:
        h=fetch(f"https://t.me/{handle}").decode('utf-8','replace')
        m=re.search(r'<meta property="og:image" content="([^"]+)"', h)
        if m and 'telesco' in m.group(1):
            b=emb_cover(m.group(1),96,96)
            if b: return b
    except Exception: pass
    # запасной: инициал на цветном квадрате
    im=Image.new("RGB",(96,96),"#0D0D0D"); d=ImageDraw.Draw(im)
    try: f=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc",54)
    except: f=ImageFont.load_default()
    ini=(name.strip()[:1] or "•").upper(); d.text((48,44),ini,fill="#fff",anchor="mm",font=f)
    buf=io.BytesIO(); im.save(buf,"JPEG",quality=85); return "data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()

esc=lambda s:(s or "").replace("&","&amp;").replace("<","&lt;")
ROT=[-4,3,-2.5,4,-3.5,2.5]; SIDE=["l","r","l","r","l","r"]
cards=""
for i,(ch,txt,cat,ttl,date,exc) in enumerate(SPEC):
    w=pick(ch,txt)
    cover=emb_cover(w["images"][0],620,470) if w and w.get("images") else None
    handle=(w.get("channel") if w else ch) or ch
    name=(w.get("channel_title") if w else ch) or ch
    av=avatar(handle, name)
    img=f'<img class="cov" src="{cover}" alt="">' if cover else '<div class="cov ph"></div>'
    cards+=f'''<div class="card">
      <div class="author {SIDE[i%6]}" style="transform:rotate({ROT[i%6]}deg)">
        <img class="av" src="{av}" alt=""><span class="ainfo"><span class="nm">{esc(name)}</span><span class="dt">{esc(date)}</span></span>
      </div>
      <div class="imw">{img}<span class="cat" style="background:{CATCOL[cat]}">{esc(cat)}</span></div>
      <div class="ttl">{esc(ttl)}</div>
      <div class="exc">{esc(exc)}</div></div>'''

CSS="""*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
html,body{margin:0;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px}
.wrap{padding:44px 46px 50px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:1180px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.lockup{display:inline-flex;height:50px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 18px;color:#fff;font-weight:900;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.hd-meta{display:flex;flex-direction:column;align-items:flex-end;gap:9px}
.dstamp{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.05em;padding:9px 13px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue);text-transform:uppercase}
.pick{font-weight:900;font-size:13.5px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;background:var(--blue);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.h1{font-weight:900;font-size:64px;letter-spacing:-.04em;line-height:.9;text-transform:uppercase;margin-top:22px}
.hl{color:var(--blue)}
.rule{height:3px;background:var(--ink);margin:18px 0 30px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);column-gap:26px;row-gap:52px}
.card{position:relative;padding-top:48px;display:flex;flex-direction:column}
/* карточка автора — крупнее, небрежно выглядывает из-за постера */
.author{position:absolute;top:0;z-index:1;display:inline-flex;align-items:center;gap:11px;background:var(--paper);border:2.5px solid var(--ink);box-shadow:4px 5px 0 var(--ink);padding:7px 16px 7px 7px}
.author.l{left:-8px;transform-origin:left bottom}
.author.r{right:-8px;transform-origin:right bottom}
.av{width:56px;height:56px;object-fit:cover;border:2px solid var(--ink);flex:0 0 auto}
.ainfo{display:flex;flex-direction:column;gap:3px}
.ainfo .nm{font-family:var(--mono);font-weight:700;font-size:13.5px;color:var(--ink);max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ainfo .dt{font-family:var(--mono);font-size:11px;color:var(--muted)}
.imw{position:relative;z-index:2;border:2.5px solid var(--ink);box-shadow:5px 6px 0 var(--ink);background:#E4E4E1;line-height:0}
.cov{width:100%;height:230px;object-fit:cover;display:block}
.cov.ph{height:230px}
.cat{position:absolute;bottom:9px;left:9px;color:#fff;font-family:var(--sans);font-weight:900;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border:1.5px solid var(--ink);box-shadow:1.5px 1.5px 0 var(--ink)}
.ttl{font-weight:800;font-size:20px;line-height:1.08;letter-spacing:-.02em;color:var(--ink);margin-top:14px}
.exc{font-size:13.5px;line-height:1.42;color:#5f5d57;margin-top:10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.foot{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:40px}"""

HTML=f"""<title>CitySignal · Голоса</title><style>{CSS}</style>
<div class="wrap"><div class="inner">
 <div class="top"><div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
 <div class="hd-meta"><span class="dstamp">голоса недели</span><span class="pick">★ живая лента</span></div></div>
 <div class="h1">Голоса <span class="hl">города</span></div>
 <div class="rule"></div>
 <div class="grid">{cards}</div>
 <div class="foot">живые заметки авторских каналов москвы · раздел «голоса» в приложении</div>
</div></div>"""
out=pathlib.Path(__file__).parent/"voices_grid_brand.html"; out.write_text(HTML,encoding="utf-8"); print("wrote",out)
