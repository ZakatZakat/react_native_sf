/**
 * CitySignal · полоса плакатов — «выключенная» строка (justified row).
 *
 *  Афиши приходят из телеграма с произвольными пропорциями (замер 34 живых
 *  постеров: медиана 1.0, разброс 0.56–1.78). Любая ФИКСИРОВАННАЯ форма ячейки
 *  оставляет пустое поле: при 3:4 — в среднем 25.6% кадра, при 1:1 — 15.5%.
 *  Обрезать нельзя: на афише площадь = текст (дата, адрес, состав), 26 из 35
 *  постеров потеряли бы больше четверти.
 *
 *  Поэтому ячейки тут нет вовсе. Каждый плакат получает СВОЮ пропорцию, все —
 *  одну высоту, а ширина у каждого своя. Строка при этом заполняет контейнер
 *  ровно, без остатка:
 *
 *      flex: <ar> 1 0   →  width_i = W · ar_i / Σar
 *      aspectRatio: ar  →  height_i = width_i / ar_i = W / Σar  (одинакова у всех)
 *
 *  Кадр совпадает с картинкой ⇒ поля нет физически, показывать нечего.
 *  Цена: плакаты разной ширины — сетка перестаёт быть ровной. Это осознанно.
 *
 *  Пропорции меряются у самих <img> при загрузке (в API их нет). До загрузки
 *  берётся медианная 1.0 — строка один раз переверстается, зато без скачка
 *  высоты контейнера.
 */

import { useState } from "react"
import type { ReactNode } from "react"

/** Медиана пропорций наших афиш — разумная заглушка до onLoad. */
const FALLBACK_AR = 1

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
  // серость, от которой уходим. Такой кадр выпадает из строки, остальные
  // переверстываются и заполняют ширину.
  const shown = posters.map((p, i) => ({ p, i })).filter(({ p, i }) => p && !failed[i])

  return (
    <div style={{ display: "flex", gap, alignItems: "flex-start", width: "100%" }}>
      {shown.map(({ p, i }) => {
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
                const r = el.naturalWidth / el.naturalHeight
                setArs((prev) => (prev[i] === r ? prev : { ...prev, [i]: r }))
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
  )
}
