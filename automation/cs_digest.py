#!/usr/bin/env python3
"""CitySignal — авто-дайджест выходных: fetch ленты → отбор 6 событий на
ближайшие сб/вс → рендер фирменной PNG (playwright) → сохранить /tmp/cs_digest.png
и вывести JSON выбранных событий (для подписи). Самодостаточно, без browser-MCP.

env: BASE (default прод), AS_USER (admin id для dev-auth).
deps: httpx, pillow, playwright (+ chromium).
"""
import os, re, io, json, base64, datetime, sys
import httpx
from PIL import Image

BASE = os.environ.get("BASE", "https://citysignal.digital-assistant.tech/curator")
AS = os.environ.get("AS_USER", "1838615751")
OUT = os.environ.get("OUT", "/tmp/cs_digest.png")
N = int(os.environ.get("N", "6"))

MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня", "июля",
          "августа", "сентября", "октября", "ноября", "декабря"]
EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
                   "\U00002190-\U000021FF\U00002B00-\U00002BFF\U0000FE00-\U0000FE0F‍⃣]", re.U)


def clean_title(t):
    t = t or ""
    t = EMOJI.sub("", t)
    t = re.sub(r"[­​-‏⁠﻿︀-️]", "", t)
    t = re.sub(r"^\s*\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?\s*[|·/—\-]*\s*", "", t)
    t = re.sub(r"^\d{1,2}[-–]\d{1,2}\s+\S+\s*[>|·—\-]*\s*", "", t)  # «4-6 СЕНТЯБРЯ >»
    t = re.sub(r"^\d{1,2}\s+\S+\s*[/|·—\->]*\s*", "", t)
    t = re.sub(r"^[^\w«\"'(]+", "", t, flags=re.U)
    t = re.sub(r"\s*[/|·—\-]*\s*\d{1,2}:\d{2}\s*$", "", t)
    # хвостовая дата «… 13 сентября» / «… 5-6 сентября»
    t = re.sub(r"\s+\d{1,2}(?:[-–]\d{1,2})?\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*\.?\s*$", "", t, flags=re.I)
    t = re.sub(r"^[«\"']\s*", "", t)  # ведущая одиночная кавычка-артефакт
    return re.sub(r"\s{2,}", " ", t).strip()


def good_title(t):
    """Чистый заголовок события, а не тело поста: короткий, без предложений."""
    if not t or len(t) > 46:
        return False
    if re.search(r"[.!?]\s+\S", t):  # два предложения = тело поста
        return False
    return bool(re.search(r"\w", t, re.U))


def msk(dt):
    return dt.astimezone(datetime.timezone(datetime.timedelta(hours=3)))


def parse_et(raw):
    if not raw:
        return None
    s = str(raw).strip().replace(" ", "T")
    try:
        if re.search(r"(Z|[+-]\d\d:?\d\d)$", s):
            return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
        if "T" not in s:
            s += "T00:00:00"
        return datetime.datetime.fromisoformat(s).replace(tzinfo=datetime.timezone(datetime.timedelta(hours=3)))
    except Exception:
        return None


def is_img(u):
    return bool(re.search(r"\.(jpe?g|png|webp)(\?|$)", u or "", re.I))


def poster_b64(client, path):
    try:
        r = client.get("https://citysignal.digital-assistant.tech" + path, timeout=20)
        im = Image.open(io.BytesIO(r.content)).convert("RGB")
        w = min(1.0, 300 / im.width)
        im = im.resize((round(im.width * w), round(im.height * w)))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=55)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def upcoming_weekend():
    today = msk(datetime.datetime.now(datetime.timezone.utc)).date()
    # ближайшие сб(5) и вс(6); если сегодня уже выходные — берём их
    sat = today + datetime.timedelta((5 - today.weekday()) % 7)
    return {sat.isoformat(), (sat + datetime.timedelta(1)).isoformat()}


def build_html(cards, h1_main, h1_hl, sub, date_lo, date_hi):
    def esc(s):
        return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def stamp(l, c):
        return f'<span class="stamp"><span class="sq" style="background:{c}"></span>{esc(l)}</span>'

    def card(d):
        price = d["price"] if (d["price"] and d["access"] != "free") else ""
        meta = " · ".join(x for x in [esc(d["venue"]), esc(price)] if x)
        tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in d["tags"])
        return (f'<article class="card"><div class="poster">{f"""<img src="{d["poster"]}" alt="">""" if d["poster"] else ""}</div>'
                f'<div class="body"><div class="brow"><span class="dstamp">{esc(d["when"])}</span>'
                f'{stamp("свободно", "#0055FF") if d["access"]=="free" else ""}</div>'
                f'<h3 class="ttl">{esc(d["title"])}</h3>{f"""<div class="meta">{meta}</div>""" if meta else ""}'
                f'{f"""<div class="tags">{tags}</div>""" if tags else ""}</div></article>')

    CSS = open(os.path.join(os.path.dirname(__file__), "digest_css.txt")).read() if os.path.exists(
        os.path.join(os.path.dirname(__file__), "digest_css.txt")) else DIGEST_CSS
    SCRIPT = DIGEST_SCRIPT
    meta_tags = "".join(f'<span class="tag">{esc(t)}</span>' for t in re.split(r",\s*", sub))
    daterange = f'{date_lo}{f" → {date_hi}" if date_hi and date_hi != date_lo else ""}'
    return (f'<title>CitySignal · {esc(h1_main)} {esc(h1_hl)}</title>\n<style>{CSS}</style>\n'
            f'<div class="wrap"><div class="inner"><div class="top">'
            f'<div class="lockup"><span class="lc-city">City</span><span class="lc-signal">Signal</span></div>'
            f'<div class="hd-meta"><div class="brow" style="justify-content:flex-end">'
            f'<span class="dstamp">{daterange}</span>'
            f'<span class="stamp"><span class="sq" style="background:var(--blue)"></span>{len(cards)} событий</span></div>'
            f'<div class="tags" style="justify-content:flex-end">{meta_tags}</div></div></div>'
            f'<div class="h1" style="margin-top:18px">{esc(h1_main)} <span class="hl">{esc(h1_hl)}</span></div>'
            f'<div class="rule"></div><div class="grid">{"".join(card(c) for c in cards)}</div>'
            f'<div class="botline"></div></div></div>\n{SCRIPT}')


DIGEST_CSS = '*{box-sizing:border-box;margin:0}:root{--ink:#0D0D0D;--paper:#fff;--blue:#0055FF;--red:#E0162B;--ground:#ECEBE6;--line:#D8D7D1;--muted:#8A8A8A;--poster:#E4E4E1;--sans:"Helvetica Neue",Arial,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}.wrap{min-height:100%;background:var(--ground);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:28px 28px;padding:40px 22px 72px;color:var(--ink);font-family:var(--sans)}.inner{max-width:1080px;margin:0 auto}.h1{font-weight:900;font-size:clamp(40px,7vw,72px);letter-spacing:-.04em;line-height:.9;margin-top:8px;text-transform:uppercase}.hl{color:var(--blue)}.rule{height:3px;background:var(--ink);margin:22px 0 26px}.grid{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start}.card{background:var(--paper);border:2.5px solid var(--ink);box-shadow:5px 6px 0 var(--ink)}.poster{background:var(--poster);border-bottom:2.5px solid var(--ink);line-height:0}.poster img{width:100%;height:auto;max-height:430px;object-fit:cover;display:block}.body{padding:13px 15px 16px}.brow{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px}.stamp{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-weight:800;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1;padding:4px 9px 4px 6px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}.stamp .sq{width:11px;height:11px;flex:0 0 auto}.dstamp{display:inline-flex;align-items:center;font-family:var(--mono);font-weight:700;font-size:10.5px;letter-spacing:.04em;line-height:1;padding:5px 9px;background:var(--ink);color:#fff;border:2px solid var(--ink);box-shadow:2px 2px 0 var(--blue)}.ttl{font-weight:900;font-size:19px;line-height:1.05;letter-spacing:-.02em;text-transform:uppercase;overflow-wrap:anywhere}.meta{font-family:var(--mono);font-weight:700;font-size:11px;letter-spacing:.03em;color:var(--muted);margin-top:8px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.tag{font-weight:800;font-size:10px;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:var(--blue);border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink);padding:3px 8px}.botline{height:3px;background:var(--ink);margin-top:36px}.lockup{display:inline-flex;height:52px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}.lc-city,.lc-signal{display:flex;align-items:center;padding:0 19px;color:#fff;font-weight:900;font-size:27px;letter-spacing:-.03em;text-transform:uppercase}.lc-city{background:var(--ink)}.lc-signal{background:var(--blue)}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.hd-meta{display:flex;flex-direction:column;align-items:flex-end}.hd-meta .brow{margin:0;gap:9px}.hd-meta .dstamp{font-size:15.5px;padding:9px 13px}.hd-meta .stamp{font-size:14.5px;padding:8px 12px 8px 8px;gap:7px}.hd-meta .stamp .sq{width:15px;height:15px}.hd-meta .tags{margin-top:11px;gap:8px}.hd-meta .tag{font-size:12.5px;padding:6px 11px}'
DIGEST_SCRIPT = "<script>(function(){function reflow(){var g=document.querySelector('.grid');if(!g)return;var cs=[].slice.call(g.querySelectorAll('.card'));if(!cs.length)return;var gap=22,minCol=300,W=g.clientWidth||1080;var cols=Math.max(1,Math.min(3,Math.floor((W+gap)/(minCol+gap))));var cw=Math.floor((W-gap*(cols-1))/cols);cs.forEach(function(c){c.style.width=cw+'px';});var cd=[],hh=[];for(var i=0;i<cols;i++){var d=document.createElement('div');d.style.cssText='width:'+cw+'px;display:flex;flex-direction:column;gap:'+gap+'px';cd.push(d);hh.push(0);}cs.slice().sort(function(a,b){return b.offsetHeight-a.offsetHeight;}).forEach(function(c){var mi=0;for(var i=1;i<cols;i++){if(hh[i]<hh[mi])mi=i;}hh[mi]+=c.offsetHeight+gap;cd[mi].appendChild(c);});g.innerHTML='';g.style.cssText='display:flex;gap:'+gap+'px;align-items:flex-start';cd.forEach(function(d){g.appendChild(d);});}window.__reflow=reflow;window.addEventListener('load',reflow);document.addEventListener('DOMContentLoaded',function(){setTimeout(reflow,60);});})();</script>"

COARSE = {"Музыка", "Танец", "Кино", "Литература", "Лекции"}


def main():
    client = httpx.Client()
    feed = client.get(f"{BASE}/me/feed?limit=200&as_user={AS}").json()
    items = feed if isinstance(feed, list) else feed.get("items", [])
    wknd = upcoming_weekend()
    picked, seen_titles = [], set()
    for e in items:  # лента уже по rank; берём первые N выходных с постером, без дублей заголовка
        et = (e.get("event_time") or "")[:10]
        if et not in wknd:
            continue
        img = next((m for m in (e.get("media_urls") or []) if is_img(m)), None)
        if not img:
            continue
        title = clean_title(e.get("title"))
        key = title.lower()[:40]
        if not good_title(title) or key in seen_titles:
            continue
        d = parse_et(e.get("event_time"))
        dd = msk(d).strftime("%d.%m") if d else ""
        tm = msk(d).strftime("%H:%M") if d else ""
        when = dd + (f" · {tm}" if tm and tm != "00:00" else "")
        pf = bool(re.search(r"свобод|беспл|free", e.get("price") or "", re.I))
        loc = e.get("location") or ""
        picked.append({
            "id": e.get("id"), "channel": e.get("channel"), "message_id": e.get("message_id"),
            "when": when, "date": dd, "title": title,
            "venue": loc if loc and not str(loc).startswith("@") else "",
            "price": ("бесплатно" if pf else ("от " + re.sub(r"\D", "", (re.search(r"\d[\d\s]*", e.get("price") or "") or [""])[0]) + " ₽" if re.search(r"\d", e.get("price") or "") else "")),
            "access": "free" if pf else "",
            "tags": [t for t in (e.get("tag_labels") or []) if t not in COARSE][:3],
            "poster": poster_b64(client, img),
        })
        seen_titles.add(key)
        if len(picked) >= N:
            break
    if len(picked) < 3:
        print(json.dumps({"error": "too_few", "n": len(picked)}))
        sys.exit(2)
    dates = sorted({p["date"] for p in picked if p["date"]}, key=lambda x: (x.split(".")[1], x.split(".")[0]))
    html = build_html(picked, "Выходные", "в Москве", "афиша, концерты, вечеринки",
                      dates[0] if dates else "", dates[-1] if dates else "")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel="chrome")
        except Exception:
            b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1160, "height": 1400}, device_scale_factor=2)
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(400)
        pg.evaluate("window.__reflow && window.__reflow()")
        pg.wait_for_timeout(300)
        pg.screenshot(path=OUT, full_page=True)
        b.close()
    out = [{k: p[k] for k in ("id", "channel", "message_id", "when", "title", "venue", "access")} for p in picked]
    print(json.dumps({"ok": True, "png": OUT, "count": len(picked), "range": [dates[0], dates[-1]], "events": out}, ensure_ascii=False))


if __name__ == "__main__":
    main()
