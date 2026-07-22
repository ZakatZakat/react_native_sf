/**
 * CitySignal · полоса плакатов — заполненная мозайка без обрезки.
 *
 *  Афиши приходят с произвольными пропорциями (замер 34 живых постеров: медиана
 *  1.0, разброс 0.56–1.78). Раскладка — «выключенные» ряды (justified): в каждом
 *  ряду постеры одной высоты, ширина у каждого своя по его пропорции, ряд
 *  заполняет контейнер по ширине РОВНО:
 *
 *      flex: <ar> 1 0   →  width_i = W · ar_i / Σar
 *      aspectRatio: ar  →  height_i = W / Σar  (одинакова в пределах ряда)
 *
 *  Ряды стыкуются без зазора, последний ряд тоже заполнен по ширине ⇒ блок —
 *  сплошной заполненный прямоугольник: ни белого фона, ни серого мата, ни
 *  обрезки. Постеры разной ширины/высоты — это и есть «неровная мозайка».
 *  (Почему не колонки-masonry: у них низ колонок разной длины, из-за чего под
 *  короткой оставалось пустое место — как раз то, чего быть не должно.)
 *
 *  Больше трёх в один ряд на телефоне мельчает, поэтому переносим: не больше
 *  MAX_PER_ROW в ряду, ряды по количеству ровные (4→2+2, 3→3, 5→3+2).
 *
 *  Пропорции меряются у самих <img> при onLoad (в API их нет), до загрузки —
 *  медианная 1.0. Битый URL (404) не оставляет дыру: onError выкидывает кадр,
 *  ряды пересчитываются.
 */

import { useState } from "react"
import type { ReactNode } from "react"

/** Медиана пропорций наших афиш — заглушка до onLoad. */
const FALLBACK_AR = 1
/** Больше трёх в ряд на телефоне — плакаты-марки; переносим. */
const MAX_PER_ROW = 3

type Item = { p: string; i: number }

/** Разбить на ряды ровного размера: минимум рядов, поровну. 4→[2,2], 3→[3], 5→[3,2]. */
function rowsOf(items: Item[]): Item[][] {
  const n = items.length
  if (n === 0) return []
  const rowCount = Math.ceil(n / MAX_PER_ROW)
  const perRow = Math.ceil(n / rowCount)
  const rows: Item[][] = []
  for (let k = 0; k < n; k += perRow) rows.push(items.slice(k, k + perRow))
  return rows
}

export function PosterRow({
  posters,
  gap = 6,
  border,
  overlay,
}: {
  posters: (string | null)[]
  gap?: number
  /** Рамка вокруг плаката. Поля ей не создаётся — кадр равен картинке. */
  border?: string
  /** Что нарисовать поверх i-го плаката (кнопка «убрать» в админке). */
  overlay?: (i: number) => ReactNode
}) {
  const [ars, setArs] = useState<Record<number, number>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const arOf = (i: number) => ars[i] ?? FALLBACK_AR

  // Битый URL не должен оставлять дыру — выпадает, ряды пересчитываются.
  const shown: Item[] = posters
    .map((p, i) => ({ p, i }))
    .filter((x): x is Item => !!x.p && !failed[x.i])
  const rows = rowsOf(shown)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: "100%" }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap, alignItems: "flex-start", width: "100%" }}>
          {row.map(({ p, i }) => (
            <div
              key={`${p}-${i}`}
              style={{
                flex: `${arOf(i)} 1 0`,
                aspectRatio: String(arOf(i)),
                position: "relative",
                overflow: "hidden",
                border,
                // Виден только пока грузится картинка — потом кадр закрыт ею целиком.
                background: "rgba(13,13,13,0.06)",
              }}
            >
              <img
                src={p}
                alt=""
                onLoad={(e) => {
                  const el = e.currentTarget
                  if (!el.naturalWidth || !el.naturalHeight) return
                  const rr = el.naturalWidth / el.naturalHeight
                  setArs((prev) => (prev[i] === rr ? prev : { ...prev, [i]: rr }))
                }}
                onError={() => setFailed((prev) => (prev[i] ? prev : { ...prev, [i]: true }))}
                // Кадр уже в пропорции картинки, cover ничего не режет — лишь
                // страхует от субпиксельной щели по краю.
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {overlay?.(i)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
