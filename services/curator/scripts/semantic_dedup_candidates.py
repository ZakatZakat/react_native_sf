#!/usr/bin/env python3
"""Генератор КАНДИДАТОВ на семантический дедуп кросс-постов.

Печатает кластеры однодневных событий, которые токен-дедуп (app.ranking.cluster)
оставил РАЗДЕЛЬНО, но которые делят ≥2 РЕДКИХ токена (имена собственные / названия) —
т.е. могут быть одним и тем же событием, обёрнутым по-разному (разные заголовки,
постеры, без общего URL: фильм-концерт Дзиги из 5 постов и т.п.).

Скрипт НИЧЕГО не пишет в БД — только предлагает кластеры для РУЧНОГО суждения.
Решение (какие id = одно событие) человек принимает сам и применяет UPDATE-ом
(см. services/curator/SEMANTIC_DEDUP.md).

Вход — JSON-массив фид-праймари из psql (stdin или файл-аргумент), элементы:
    {"id":123,"title":"...","time":"2026-07-26T16:00","tx":"первые ~320 симв. текста"}
("day" выведется из time; time может быть пустым — такие в кандидаты не идут,
 т.к. без даты нельзя привязать к дню-бакету.)

Пример:
    ssh root@45.144.52.40 "docker exec -i react_native_sf-db-1 \
      psql -U postgres -d tg_events -t -A -f -" < dump_query.sql \
    | python3 services/curator/scripts/semantic_dedup_candidates.py
"""
from __future__ import annotations

import json
import sys

# Общие/служебные слова — НЕ считаются значимыми токенами (иначе «концерт»,
# «выставка», месяцы связали бы все несвязанные события одного дня).
STOP = {
    "январь","января","февраль","февраля","март","марта","апрель","апреля",
    "май","мая","июнь","июня","июль","июля","август","августа","сентябрь",
    "сентября","октябрь","октября","ноябрь","ноября","декабрь","декабря",
    "понедельник","вторник","среда","среду","четверг","пятница","пятницу",
    "суббота","субботу","воскресенье","для","что","как","это","все","уже",
    "при","под","над","без","про","или","где","там","так","года","году",
    "билеты","билет","вход","бесплатно","регистрация","москва","москве",
    "the","and","for","with",
}

RARE_DF = 18  # токен «редкий», если встречается ≤ RARE_DF праймари (имя собственное)
MIN_SHARED_RARE = 2  # ребро, если пара делит ≥ столько редких токенов


def toks(s: str) -> set[str]:
    out: set[str] = set()
    buf = []
    for ch in (s or "").lower().replace("ё", "е"):
        if ch.isalnum():
            buf.append(ch)
        else:
            if buf:
                w = "".join(buf)
                buf = []
                if len(w) >= 3 and not w.isdigit() and w not in STOP:
                    out.add(w)
    if buf:
        w = "".join(buf)
        if len(w) >= 3 and not w.isdigit() and w not in STOP:
            out.add(w)
    return out


def main() -> None:
    raw = (open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1
           else sys.stdin.read())
    events = json.loads(raw)
    by_id = {e["id"]: e for e in events}

    # токены события: заголовок + первые 140 символов текста
    tk = {e["id"]: toks((e.get("title") or "") + " " + (e.get("tx") or "")[:140])
          for e in events}
    df: dict[str, int] = {}
    for s in tk.values():
        for t in s:
            df[t] = df.get(t, 0) + 1

    def day(e: dict) -> str:
        return (e.get("time") or e.get("day") or "")[:10]

    by_day: dict[str, list[int]] = {}
    for e in events:
        d = day(e)
        if d:
            by_day.setdefault(d, []).append(e["id"])

    parent = {e["id"]: e["id"] for e in events}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    edges = 0
    for ids in by_day.values():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = ids[i], ids[j]
                rare = sum(1 for t in tk[a] if t in tk[b] and df[t] <= RARE_DF)
                if rare >= MIN_SHARED_RARE:
                    parent[find(a)] = find(b)
                    edges += 1

    comp: dict[int, list[int]] = {}
    for e in events:
        comp.setdefault(find(e["id"]), []).append(e["id"])
    cands = sorted((g for g in comp.values() if len(g) >= 2),
                   key=lambda g: -len(g))

    print(f"# праймари={len(events)}  рёбер={edges}  "
          f"кандидатов(размер≥2)={len(cands)}  всего id={sum(len(g) for g in cands)}")
    print("# ПРАВИЛО: сливай только кросс-посты ОДНОГО И ТОГО ЖЕ действия/фестиваля.")
    print("# Разные сессии на общей площадке — РАЗДЕЛЬНО (концерт vs экскурсия, две")
    print("# лекции в одном музее, два разных фильма). Подробно: SEMANTIC_DEDUP.md\n")
    for i, g in enumerate(cands):
        g = sorted(g)
        print(f"[C{i}] день={day(by_id[g[0]])} размер={len(g)}")
        for eid in g:
            e = by_id[eid]
            t = (e.get("time") or "")[11:16] or "--:--"
            print(f"  #{eid}  {t}  {(e.get('title') or '').strip()[:60]}")
            print(f"        {(e.get('tx') or '').strip()[:150]}")
        print()


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:  # `... | head` закрыл пайп — это норма
        try:
            sys.stdout.close()
        except Exception:
            pass
