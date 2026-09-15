# -*- coding: utf-8 -*-
"""CitySignal · арт-неделя 14–18.09 — day-by-day agenda в фирменном дизайне.
Единая панель + 2 CSS-балансируемые колонки → низ ровный, пустот нет."""
import html, pathlib

CATS = {
    "art": "ink", "music": "blue", "party": "blue", "cinema": "red",
    "stage": "red", "talk": "ink", "food": "ink", "other": "ink",
}

DAYS = [
    ("ВТ", "15.09", [
        ("art",  "Вернисаж на «Фабрике»"),
        ("art",  "Галерея «Бомба» открыта"),
        ("art",  "«История чёрного цвета» — фонд «Екатерина»"),
        ("art",  "Вернисаж в РГБМ"),
        ("art",  "Alrosa Diamonds — картина Анки Ахалая"),
        ("art",  "Афра Шафик + «Словарь воображаемых мест» — «Гараж»"),
        ("art",  "«Боги и люди. От мифа к истории» — Серпуховский ИХМ"),
        ("art",  "Выставка в библиотеке Чехова на Страстном"),
        ("art",  "Сборка выставки Шатилова — Столичная галерея"),
        ("talk", "АртЛифт с Викой Марковой"),
        ("stage","Спектакль Гофмана — Зверевский центр"),
        ("food", "Food Expo — «Крокус»"),
        ("talk", "О Толстом — Go with Russia"),
        ("other","ТОН-центр за 200₽ (до 18:00)"),
        ("talk", "Чтение «Крокодила» о хлебе — «Зотов»"),
        ("talk", "Чтения «Божественной комедии»"),
        ("cinema","Кинопоказ — November Cinema"),
    ]),
    ("СР", "16.09", [
        ("art",  "VLADEY × «Атланты» — Леонид Цхэ «Продолжение»"),
        ("art",  "Вернисаж в «Багратуни»"),
        ("art",  "Стив Маккарри — «Люмьер»"),
        ("art",  "Любовь Ремизова — Открытые студии (с 18:00)"),
        ("talk", "Творческий вечер с Игорем Ермолаевым — Давыдково"),
        ("art",  "Вернисаж — фонд «Геометрия» (возможно 18.09)"),
        ("talk", "«История вина в стране царей и комиссаров» — «Зотов»"),
        ("stage","FemStandUp"),
        ("cinema","«Внутри Льюина Дэвиса»"),
    ]),
    ("ЧТ", "17.09", [
        ("art",  "«Врубель. Рождение нового искусства» — музей ДПИ"),
        ("art",  "«Смена фокуса» — Ruarts (последняя)"),
        ("art",  "Вернисажи: Измайлово А3, Ростокино, Китай-город"),
        ("art",  "Выставка дизайна — RRomer"),
        ("art",  "Вернисаж Худякова — «Зарядье»"),
        ("art",  "Винзавод × Минздрав"),
        ("art",  "«Корней» на Никитской"),
        ("art",  "Вернисаж в Зюзино"),
        ("music","Выставка + гиг — «Мотыга Йети»"),
        ("stage","Кабаре «Шум» — ДР «Мужчина, вы куда?»"),
        ("food", "«Полуночный пир. Пролог» — «Тверской. Дом вкуса»"),
        ("other","День рождения White Rabbit"),
        ("other","Настолки — EMM"),
        ("cinema","Кинопоказ — Magnum Corpus"),
        ("party","«Бимбостоицизм: теория, практика, рейв» — Парк Горького"),
        ("stage","Henderson AW’26 «Геометрия ритма» — Дом Пашкова"),
        ("other","Ретрит «Тенгри» 18+ — 2-я Звенигородская 12"),
        ("other","AutoFAQ — конференция, Сколково"),
        ("cinema","«Фест коллективных фильмов» — ГЭС-2"),
    ]),
    ("ПТ", "18.09", [
        ("art",  "Вернисаж на Солянке"),
        ("art",  "«След» — VS Gallery"),
        ("art",  "Мосвинтаж — выставка"),
        ("food", "Маркет «Жить красиво» — усадьба Барышникова"),
        ("talk", "Встреча с Утенковой и Тихоновым — Давыдково"),
        ("music","Выставка + гиг — «Мотыга» (400₽)"),
        ("party","Made in Bali — Flat (по реге)"),
        ("party","Summer Punch — Столешников"),
        ("party","В «Котельной» — бесплатно"),
        ("party","День рождения клуба «Культура»"),
        ("party","Сигма-фест — Dex"),
    ]),
]

COL = {"ink": "var(--ink)", "blue": "var(--blue)", "red": "var(--red)"}
esc = lambda s: html.escape(str(s or ""))
total = sum(len(d[2]) for d in DAYS)

CSS = """*{box-sizing:border-box;margin:0}
:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
.wrap{min-height:100%;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px;padding:40px 24px 56px;color:var(--ink);font-family:var(--sans)}
.inner{max-width:1120px;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.lockup{display:inline-flex;height:52px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lc-city,.lc-signal{display:flex;align-items:center;padding:0 19px;color:#fff;font-weight:900;font-size:27px;letter-spacing:-.03em;text-transform:uppercase}
.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}
.hd-meta{display:flex;flex-direction:column;align-items:flex-end;gap:11px}
.hd-row{display:flex;gap:9px;justify-content:flex-end}
.dstamp{display:inline-flex;align-items:center;font-family:var(--mono);font-weight:700;font-size:15.5px;letter-spacing:.04em;line-height:1;padding:9px 13px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue)}
.stamp{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-weight:800;font-size:14.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1;padding:8px 12px 8px 8px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
.stamp .sq{width:15px;height:15px;flex:0 0 auto}
.tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.tag{font-weight:800;font-size:12.5px;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:var(--blue);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink);padding:6px 11px}
.h1{font-weight:900;font-size:clamp(44px,7vw,74px);letter-spacing:-.04em;line-height:.9;margin-top:20px;text-transform:uppercase}
.hl{color:var(--blue)}
.rule{height:3px;background:var(--ink);margin:20px 0 18px}
.legend{display:flex;flex-wrap:wrap;gap:16px;font-family:var(--mono);font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:22px}
.lg{display:inline-flex;align-items:center;gap:7px}
.lg .sq{width:12px;height:12px;border:1.5px solid var(--ink)}
.board{background:var(--paper);border:2.5px solid var(--ink);box-shadow:5px 6px 0 var(--ink);padding:4px 0 8px}
.flow{columns:2;column-gap:0;column-rule:2px solid var(--ink)}
.day-head{break-inside:avoid;break-after:avoid;display:flex;align-items:baseline;gap:10px;background:var(--ink);color:#fff;padding:10px 15px;margin:20px 16px 9px}
.flow>.day-head:first-child{margin-top:8px}
.day-head .dow{font-weight:900;font-size:18px;letter-spacing:.02em}
.day-head .date{font-family:var(--mono);font-size:13px;letter-spacing:.06em;opacity:.85}
.day-head .cnt{margin-left:auto;font-family:var(--mono);font-size:12px;color:#6ea0ff;font-weight:700}
.entry{break-inside:avoid;display:flex;gap:10px;align-items:flex-start;padding:8px 0;margin:0 16px;border-bottom:1px solid #ECECE8}
.cdot{width:11px;height:11px;flex:0 0 auto;margin-top:4px;border:1.5px solid var(--ink)}
.etext{font-size:14.5px;line-height:1.32;font-weight:600;letter-spacing:-.01em}
.botline{height:3px;background:var(--ink);margin-top:30px}
.foot{font-family:var(--mono);font-size:11.5px;letter-spacing:.06em;color:var(--muted);margin-top:12px;text-transform:uppercase}"""

def day_block(dow, date, items):
    head = (f'<div class="day-head"><span class="dow">{dow}</span>'
            f'<span class="date">{date}</span><span class="cnt">{len(items)}</span></div>')
    rows = "".join(
        f'<div class="entry"><span class="cdot" style="background:{COL[CATS[c]]}"></span>'
        f'<span class="etext">{esc(t)}</span></div>'
        for c, t in items
    )
    return head + rows

flow = "".join(day_block(*d) for d in DAYS)

legend = (
    '<div class="legend">'
    '<span class="lg"><span class="sq" style="background:var(--ink)"></span>выставки · вернисажи</span>'
    '<span class="lg"><span class="sq" style="background:var(--blue)"></span>музыка · клубы</span>'
    '<span class="lg"><span class="sq" style="background:var(--red)"></span>кино · сцена</span>'
    '</div>'
)

HTML = f"""<title>CitySignal · Арт-неделя 14–18.09</title>
<style>{CSS}</style>
<div class="wrap"><div class="inner">
<div class="top">
  <div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>
  <div class="hd-meta">
    <div class="hd-row"><span class="dstamp">15.09 → 18.09</span><span class="stamp"><span class="sq" style="background:var(--blue)"></span>{total} событий</span></div>
    <div class="tags"><span class="tag">вернисажи</span><span class="tag">кино</span><span class="tag">клубы</span></div>
  </div>
</div>
<div class="h1">Арт <span class="hl">неделя</span></div>
<div class="rule"></div>
{legend}
<div class="board"><div class="flow">{flow}</div></div>
<div class="botline"></div>
<div class="foot">арт-неделя · 15–18.09 · полная афиша москвы · #артнеделя</div>
</div></div>"""

out = pathlib.Path(__file__).parent / "artweek.html"
out.write_text(HTML, encoding="utf-8")
print("wrote", out, len(HTML), "chars |", total, "events across", len(DAYS), "days")
