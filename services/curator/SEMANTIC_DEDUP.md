# Семантический дедуп кросс-постов (ручной)

Как **правильно** склеивать дубли одного события, которые токен-дедуп не берёт.

## Зачем это нужно

Основной дедуп ленты — токен/хэш (`app/ranking.py:cluster`): байт-идентичный
постер, общий URL, пересечение значимых слов заголовка ≥0.85. Он не ловит случаи,
когда **одно** событие обёрнуто по-разному разными каналами: разные заголовки,
разные постеры, нет общего URL. Эталон — фильм-концерт Дзиги Вертова (26.07),
разошедшийся 5 постами («Фильм-концерт Дзиги Вертова», «Вечеринка Зотова», «⭐️
Фильм-концерт от Зотова и fābula radio» …). Текст-оверлап между ними < порога → в
ленте 5 карточек одного концерта.

## Механизм (уже в коде)

Колонка `curator.events_curated.dup_override_group` (bigint, индекс; аддитивная
миграция в `app/db.py`). В `cluster()` есть union-find проход поверх токен-дедупа:
**строки с одинаковым `dup_override_group` принудительно оказываются в одной
дедуп-группе.** Значение durable — переживает 15-минутный пересчёт ранга. Ставим
override только на текущие праймари: остальные члены их токен-групп подтянутся сами.

## ⭐ Правило суждения (главное)

Сливать **только кросс-посты ОДНОГО И ТОГО ЖЕ действия** (одна активность / один
фестиваль, просто разные анонсы). Разные сессии на общей площадке/бренде —
**РАЗДЕЛЬНО**:

- ✅ Фильм-концерт Дзиги = 4 поста → одна карточка.
- ❌ …но экскурсия «Дзига Вертов. Киноглаз» (12:00, трансляция «Культура.РФ») —
  **отдельно**, хоть и делит имя выставки.
- ❌ Две разные лекции в одном музее; два разных фильма; концерт vs мастер-класс —
  **не сливать**.
- ⚠️ Фестиваль-зонтик (Архстояние, ЦИКЛ, Фестик): общие анонсы фестиваля можно
  слить в одну карточку, но выделенное именное под-событие (конкретный проект/
  спектакль с своим таймингом) лучше оставить отдельной карточкой.

Сомневаешься — **не сливай**. Ложная склейка (спрятали реальное отдельное событие)
хуже, чем лишний дубль.

## Порядок действий

### 1. Достать кандидатов

Дампим фид-праймари из прода и прогоняем генератор — он печатает однодневные
события, что делят ≥2 редких токена (имена собственные), т.е. подозрительны на
«одно событие». Скрипт ничего не пишет, только предлагает — судишь сам.

```bash
ssh root@45.144.52.40 "docker exec -i react_native_sf-db-1 psql -U postgres -d tg_events -t -A" <<'SQL' | python3 services/curator/scripts/semantic_dedup_candidates.py
SELECT json_agg(json_build_object(
  'id',    e.id,
  'title', coalesce(e.title,''),
  'time',  to_char(e.event_time,'YYYY-MM-DD HH24:MI'),
  'tx',    left(regexp_replace(coalesce(p.text,''), E'\s+',' ','g'), 320)
) ORDER BY e.event_time)
FROM curator.events_curated e
JOIN curator.posts_raw p ON p.id = e.post_id
WHERE e.status='approved' AND e.is_primary
  AND (e.event_time >= now() OR e.event_time IS NULL OR e.event_time_end >= now())
  AND coalesce(e.location_meta->>'region','moscow') NOT IN ('spb','other')
  AND cast(p.media_urls AS text) ILIKE '%.jpg%';
SQL
```

Получишь список `[C0] … [Cn]` — по каждому кластеру id/время/заголовок/сниппет.

### 2. Рассудить

По каждому кластеру примени правило выше. Кластер может распадаться на несколько
реальных событий (напр. концерт + экскурсия) — тогда сливаешь только нужное
подмножество, остальное оставляешь. Не все кластеры сливаются — многие это просто
разные лекции одного дня.

### 3. Применить `dup_override_group`

Для каждой РЕШЁННОЙ merge-группы задай общий id (соглашение — **min id** группы).
Праймари уже слитых токен-групп трогать не надо — ставь только на видимые карточки.

```bash
ssh root@45.144.52.40 "docker exec -i react_native_sf-db-1 psql -U postgres -d tg_events" <<'SQL'
UPDATE curator.events_curated e SET dup_override_group = v.gid
FROM (VALUES
  (2894,2894),(3086,2894),(4162,2894),(4402,2894),   -- Дзига фильм-концерт
  (2590,2590),(3279,2590)                              -- Фестик
  -- … (id, gid) для каждой группы; gid = min id группы
) AS v(id,gid)
WHERE e.id = v.id;
SQL
```

### 4. Пересчитать ранг (применит склейку)

```bash
ssh root@45.144.52.40 "docker exec react_native_sf-curator-1 python -m app.backfill_rank --apply --skip-taxonomy"
```

(15-мин шедулер и так пересчитает, но так — сразу.)

### 5. Проверить

Каждая override-группа должна дать ровно одну карточку, а нужные разделения —
сохраниться:

```bash
ssh root@45.144.52.40 "docker exec -i react_native_sf-db-1 psql -U postgres -d tg_events" <<'SQL'
-- у каждой ov: n_groups=1, primaries=1
SELECT dup_override_group AS ov, count(DISTINCT dup_group_id) AS n_groups,
       count(*) FILTER (WHERE is_primary) AS primaries, count(*) AS members
FROM curator.events_curated WHERE dup_override_group IS NOT NULL GROUP BY 1 ORDER BY 1;
-- спот-чек разделения (пример: экскурсия 3608 НЕ должна попасть в группу концерта)
SELECT id, dup_group_id, is_primary, dup_override_group,
       to_char(event_time,'MM-DD HH24:MI') t, left(title,34) title
FROM curator.events_curated WHERE id IN (2894,3608) ORDER BY id;
SQL
```

### 6. Если у карточки-праймари пустой/тизерный заголовок

`_primary` берёт лучший `_title_score`→authority→−id и может выбрать пост с
длинным тизером вместо названия. Поправь заголовок у праймари напрямую:

```sql
UPDATE curator.events_curated SET title='Soma 4 года: день рождения' WHERE id=4767;
```

## Откат

```sql
UPDATE curator.events_curated SET dup_override_group=NULL WHERE dup_override_group=<gid>;
-- затем backfill_rank --apply --skip-taxonomy
```

## История

- 2026-07-25 — колонка + union-find в `cluster()` (первый прогон: 14 групп / 34
  строки; Дзига-концерт слит, экскурсия 3608 оставлена отдельно).
