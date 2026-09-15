# -*- coding: utf-8 -*-
"""CitySignal · «Голоса» — карточка с живыми репликами из авторских каналов."""
import pathlib
esc=lambda s:(s or "").replace("&","&amp;").replace("<","&lt;")
VOICES=[
 ("DaDa 🖤","В Подклете Английского двора — выставка «Гост. Россия. 1967–2026»: о реновации Зарядья, о строительстве и сносе гостиницы «Россия».","https://t.me/DaDa_1978/46127","#0055FF"),
 ("Go китч! Москва","Буфет «Исток» — как посиделки на загородной даче: самовары, фрукты, винтажная мебель и домашняя русская кухня.","https://t.me/go_kitsch/10351","#E0162B"),
 ("АГАНЁК","Собрали места, которые сохраняют ментальное здоровье и убирают осеннюю хандру.","https://t.me/aganiokart/3167","#0D0D0D"),
]
cards="".join(
 f'''<div class="q"><span class="bar" style="background:{c}"></span>
   <div class="qc"><div class="mark">“</div><div class="txt">{esc(t)}</div>
   <div class="meta"><span class="sq" style="background:{c}"></span>{esc(a)}<span class="go">читать →</span></div></div></div>'''
 for a,t,u,c in VOICES)

CSS="""*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
html,body{margin:0;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px}
.wrap{padding:44px 46px 48px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:900px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.lockup{display:inline-flex;height:50px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 18px;color:#fff;font-weight:900;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.hd-meta{display:flex;flex-direction:column;align-items:flex-end;gap:9px}
.dstamp{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.05em;padding:9px 13px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue);text-transform:uppercase}
.pick{font-weight:900;font-size:13.5px;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;background:var(--blue);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.h1{font-weight:900;font-size:66px;letter-spacing:-.04em;line-height:.9;text-transform:uppercase;margin-top:22px}
.hl{color:var(--blue)}
.sub{font-family:var(--mono);font-size:13px;letter-spacing:.06em;color:var(--muted);margin-top:12px;text-transform:uppercase}
.rule{height:3px;background:var(--ink);margin:18px 0 24px}
.q{display:flex;gap:0;margin-bottom:20px}
.bar{width:8px;flex:0 0 auto;border:2px solid var(--ink);border-right:0}
.qc{flex:1;background:var(--paper);border:2.5px solid var(--ink);box-shadow:5px 6px 0 var(--ink);padding:18px 22px 16px;position:relative}
.mark{position:absolute;top:2px;right:16px;font-family:Georgia,serif;font-size:60px;color:var(--line);line-height:1}
.txt{font-size:20px;line-height:1.34;font-weight:600;letter-spacing:-.01em;max-width:92%}
.meta{display:flex;align-items:center;gap:9px;margin-top:14px;font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:.03em}
.meta .sq{width:12px;height:12px;border:1.5px solid var(--ink)}
.meta .go{margin-left:auto;color:var(--blue)}
.foot{margin-top:12px;font-family:var(--mono);font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}"""

HTML=f"""<title>CitySignal · Голоса</title><style>{CSS}</style>
<div class="wrap"><div class="inner">
 <div class="top">
   <div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
   <div class="hd-meta"><span class="dstamp">Среда</span><span class="pick">★ живая лента</span></div>
 </div>
 <div class="h1">Голоса <span class="hl">города</span></div>
 <div class="sub">что пишут авторские каналы москвы</div>
 <div class="rule"></div>
 {cards}
 <div class="foot">больше живых заметок — в приложении, раздел «голоса»</div>
</div></div>"""
out=pathlib.Path(__file__).parent/"voices.html"; out.write_text(HTML,encoding="utf-8"); print("wrote",out)
