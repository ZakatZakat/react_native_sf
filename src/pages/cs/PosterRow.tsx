/**
 * CitySignal · полоса плакатов — без пустого поля и без обрезки.
 *
 *  Афиши приходят с произвольными пропорциями (замер 34 живых постеров: медиана
 *  1.0, разброс 0.56–1.78). Фиксированная ячейка оставляет пустое поле (3:4 —
 *  25.6% кадра, 1:1 — 15.5%), а обрезать нельзя: на афише площадь = текст.
 *
 *  До трёх постеров — одна «выключенная» строка (justified): все одной высоты,
 *  ширина у каждого своя по его пропорции, ряд заполняет контейнер ровно. Кадр
 *  совпадает с картинкой ⇒ поля нет.
 *
 *  От четырёх — masonry в ДВЕ РАВНЫЕ КОЛОНКИ. Почему не 2+2 строками: там каждый
 *  ряд заполняет ширину сам, поэтому центральный вертикальный шов получается
 *  кривым (ширины постеров в рядах разные). Равные колонки дают ПРЯМОЙ шов; цена —
 *  низ колонок чуть неровный. Постеры распределяются жадно (каждый в более
 *  короткую колонку), чтобы низ был максимально ровным. Обрезки и пустого поля
 *  по-прежнему нет: постер занимает всю ширину колонки в своей пропорции.
 *
 *  Пропорции меряются у самих <img> при onLoad (в API их нет), до загрузки —
 *  медианная 1.0. Битый URL (404) не оставляет серую дыру: onError выкидывает
 *  кадр, раскладка пересчитывается.
 */

import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"

/** Медиана пропорций наших афиш — заглушка до onLoad. */
const FALLBACK_AR = 1
/** С этого числа переходим со строки на две колонки. */
const MASONRY_FROM = 4

type Item = { p: string; i: number }

/** Разложить по 2 колонкам жадно: каждый следующий (от «высокого» к «низкому») —
 *  в колонку с меньшей суммарной высотой. Высота постера ∝ 1/ar. Внутри колонки
 *  порядок — по исходному индексу (по порядку выбора). */
function twoColumns(items: Item[], arOf: (i: number) => number): [Item[], Item[]] {
  const cols: [Item[], Item[]] = [[], []]
  const h: [number, number] = [0, 0]
  ;[...items]
    .sort((a, b) => 1 / arOf(a.i) - 1 / arOf(b.i))
    .reverse() // самые «высокие» первыми
    .forEach((it) => {
      const c = h[0] <= h[1] ? 0 : 1
      cols[c].push(it)
      h[c] += 1 / arOf(it.i)
    })
  cols[0].sort((a, b) => a.i - b.i)
  cols[1].sort((a, b) => a.i - b.i)
  return cols
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

  // Битый URL не должен оставлять серую дыру — выпадает, раскладка пересчитывается.
  const shown: Item[] = posters
    .map((p, i) => ({ p, i }))
    .filter((x): x is Item => !!x.p && !failed[x.i])

  const Poster = ({ p, i, extra }: { p: string; i: number; extra: CSSProperties }) => (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border,
        // Виден только пока грузится картинка — потом кадр закрыт ею целиком.
        background: "rgba(13,13,13,0.06)",
        ...extra,
      }}
    >
      <img
        src={p}
        alt=""
        loading="lazy"
        onLoad={(e) => {
          const el = e.currentTarget
          if (!el.naturalWidth || !el.naturalHeight) return
          const r = el.naturalWidth / el.naturalHeight
          setArs((prev) => (prev[i] === r ? prev : { ...prev, [i]: r }))
        }}
        onError={() => setFailed((prev) => (prev[i] ? prev : { ...prev, [i]: true }))}
        // Кадр уже в пропорции картинки, cover ничего не режет — лишь страхует
        // от субпиксельной щели по краю.
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {overlay?.(i)}
    </div>
  )

  // До 4 — одна justified-строка: flex по пропорции даёт равную высоту.
  if (shown.length < MASONRY_FROM) {
    return (
      <div style={{ display: "flex", gap, alignItems: "flex-start", width: "100%" }}>
        {shown.map(({ p, i }) => (
          <Poster key={`${p}-${i}`} p={p} i={i} extra={{ flex: `${arOf(i)} 1 0`, aspectRatio: String(arOf(i)) }} />
        ))}
      </div>
    )
  }

  // 4+ — две равные колонки, прямой центральный шов.
  const [colA, colB] = twoColumns(shown, arOf)
  const column = (items: Item[]) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap }}>
      {items.map(({ p, i }) => (
        <Poster key={`${p}-${i}`} p={p} i={i} extra={{ width: "100%", aspectRatio: String(arOf(i)) }} />
      ))}
    </div>
  )
  return (
    <div style={{ display: "flex", gap, alignItems: "flex-start", width: "100%" }}>
      {column(colA)}
      {column(colB)}
    </div>
  )
}
