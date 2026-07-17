/**
 * CitySignal · полоса плакатов — «выключенные» строки (justified rows).
 *
 *  Афиши приходят из телеграма с произвольными пропорциями (замер 34 живых
 *  постеров: медиана 1.0, разброс 0.56–1.78). Любая ФИКСИРОВАННАЯ форма ячейки
 *  оставляет пустое поле: при 3:4 — в среднем 25.6% кадра, при 1:1 — 15.5%.
 *  Обрезать нельзя: на афише площадь = текст (дата, адрес, состав), 26 из 35
 *  постеров потеряли бы больше четверти.
 *
 *  Поэтому ячейки тут нет вовсе. Каждый плакат получает СВОЮ пропорцию, все в
 *  строке — одну высоту, ширина у каждого своя. Строка заполняет контейнер ровно:
 *
 *      flex: <ar> 1 0   →  width_i = W · ar_i / Σar
 *      aspectRatio: ar  →  height_i = width_i / ar_i = W / Σar  (одинакова в ряду)
 *
 *  Кадр совпадает с картинкой ⇒ поля нет физически, показывать нечего.
 *
 *  Перенос: 4 постера в один ряд на телефоне мельчают до ~60px, поэтому строки
 *  балансируются — не больше MAX_PER_ROW в ряду, поровну (4 → 2+2, 3 → 3, 5 → 3+2).
 *  Ряды могут различаться по высоте — это нормально для justified-галереи.
 *
 *  Пропорции меряются у самих <img> при загрузке (в API их нет). До загрузки
 *  берётся медианная 1.0 — ряд один раз переверстается, зато без скачка высоты.
 */

import { useState } from "react"
import type { ReactNode } from "react"

/** Медиана пропорций наших афиш — разумная заглушка до onLoad. */
const FALLBACK_AR = 1
/** Больше трёх в ряд на телефоне — плакаты-марки; переносим. */
const MAX_PER_ROW = 3

/** Разбить на сбалансированные ряды: минимум рядов, поровну в каждом.
 *  4→[2,2], 3→[3], 5→[3,2], 6→[3,3]. */
function balancedRows<T>(items: T[]): T[][] {
  const n = items.length
  if (n === 0) return []
  const rowCount = Math.ceil(n / MAX_PER_ROW)
  const perRow = Math.ceil(n / rowCount)
  const rows: T[][] = []
  for (let i = 0; i < n; i += perRow) rows.push(items.slice(i, i + perRow))
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
  /** Рамка вокруг плаката. Само поле ей не создаётся — кадр равен картинке. */
  border?: string
  /** Что нарисовать поверх i-го плаката (кнопка «убрать» в админке). */
  overlay?: (i: number) => ReactNode
}) {
  const [ars, setArs] = useState<Record<number, number>>({})
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  // Битый URL (404 в /media) не должен оставлять серую дыру — это ровно та
  // серость, от которой уходим. Такой кадр выпадает, остальные переверстываются.
  const shown = posters.map((p, i) => ({ p, i })).filter(({ p, i }) => p && !failed[i])
  const rows = balancedRows(shown)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: "100%" }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: "flex", gap, alignItems: "flex-start", width: "100%" }}>
          {row.map(({ p, i }) => {
            const ar = ars[i] ?? FALLBACK_AR
            return (
              <div
                key={`${p}-${i}`}
                style={{
                  flex: `${ar} 1 0`,
                  aspectRatio: String(ar),
                  position: "relative",
                  overflow: "hidden",
                  border,
                  // Виден только пока грузится картинка — потом кадр закрыт ею целиком.
                  background: "rgba(13,13,13,0.06)",
                }}
              >
                <img
                  src={p as string}
                  alt=""
                  loading="lazy"
                  onLoad={(e) => {
                    const el = e.currentTarget
                    if (!el.naturalWidth || !el.naturalHeight) return
                    const rr = el.naturalWidth / el.naturalHeight
                    setArs((prev) => (prev[i] === rr ? prev : { ...prev, [i]: rr }))
                  }}
                  onError={() => setFailed((prev) => (prev[i] ? prev : { ...prev, [i]: true }))}
                  // Кадр уже в пропорции картинки, так что cover ничего не режет —
                  // он лишь страхует от субпиксельной щели по краю.
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {overlay?.(i)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
