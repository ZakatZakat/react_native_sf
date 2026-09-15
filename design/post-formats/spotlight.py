# -*- coding: utf-8 -*-
"""CitySignal · спотлайт одного события — постер + фирменная рамка. Пример: Врубель."""
import base64, io, urllib.request, pathlib
from PIL import Image

# реальный постер события из ленты (id13968, @vmuzey)
raw = urllib.request.urlopen("https://citysignal.digital-assistant.tech/media/1242545525_31021.jpg", timeout=30).read()
im = Image.open(io.BytesIO(raw)).convert("RGB")
# ужимаем до ширины 900 (jpeg q82) → самодостаточный html
w = 900; h = round(im.height * w / im.width)
im = im.resize((w, h), Image.LANCZOS)
buf = io.BytesIO(); im.save(buf, "JPEG", quality=82)
poster_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

TITLE = "Врубель. Рождение нового искусства"
VENUE = "Музей декоративно-прикладного искусства"
WHEN  = "с 18 сентября"
TAGS  = ["выставка", "искусство", "must-see"]

esc = lambda s: (s or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
tags_html = "".join(f'<span class="tag">{esc(t)}</span>' for t in TAGS)

CSS = """*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--poster:#E4E4E1;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
html,body{margin:0;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px}
.wrap{padding:40px 34px 44px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:860px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px}
.lockup{display:inline-flex;height:50px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 18px;color:#fff;font-weight:900;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.hd-meta{display:flex;flex-direction:column;align-items:flex-end;gap:9px}
.dstamp{display:inline-flex;align-items:center;font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.05em;line-height:1;padding:9px 13px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue);text-transform:uppercase}
.pick{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-weight:900;font-size:13.5px;letter-spacing:.06em;text-transform:uppercase;line-height:1;padding:8px 12px;background:var(--blue);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.pick .st{font-size:14px}
.card{background:var(--paper);border:2.5px solid var(--ink);box-shadow:6px 7px 0 var(--ink)}
.poster{background:var(--poster);border-bottom:2.5px solid var(--ink);line-height:0}
.poster img{width:100%;height:auto;max-height:560px;object-fit:cover;display:block}
.body{padding:20px 22px 22px}
.brow{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.kick{font-family:var(--mono);font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.ttl{font-weight:900;font-size:40px;line-height:.98;letter-spacing:-.03em;text-transform:uppercase;overflow-wrap:anywhere}
.venue{font-family:var(--mono);font-weight:700;font-size:14px;letter-spacing:.02em;color:var(--ink);margin-top:14px;line-height:1.4}
.venue .dot{color:var(--blue)}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.tag{font-weight:800;font-size:12px;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:var(--blue);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink);padding:5px 10px}
.botline{height:3px;background:var(--ink);margin-top:26px}
.foot{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;color:var(--muted);margin-top:12px;text-transform:uppercase}"""

HTML = f"""<title>CitySignal · Спотлайт · Врубель</title>
<style>{CSS}</style>
<div class="wrap"><div class="inner">
  <div class="top">
    <div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
    <div class="hd-meta">
      <span class="dstamp">{esc(WHEN)}</span>
      <span class="pick"><span class="st">★</span> Выбор редакции</span>
    </div>
  </div>
  <div class="card">
    <div class="poster"><img src="{poster_b64}" alt=""></div>
    <div class="body">
      <div class="brow"><span class="kick">Спотлайт · выставка</span></div>
      <div class="ttl">{esc(TITLE)}</div>
      <div class="venue">{esc(VENUE)}<br><span class="dot">▪</span> {esc(WHEN)} · Москва</div>
      <div class="tags">{tags_html}</div>
    </div>
  </div>
  <div class="botline"></div>
  <div class="foot">спотлайт недели · афиша москвы · #citysignal</div>
</div></div>"""

out = pathlib.Path(__file__).parent / "spotlight.html"
out.write_text(HTML, encoding="utf-8")
print("wrote", out, "| poster", im.size)
