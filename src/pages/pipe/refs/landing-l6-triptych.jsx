/* Landing L6 — TRIPTYCH
   Three vertical columns of scrolling posters fill the page background.
   Each column moves in alternating direction (down / up / down) at
   different speeds. A white ink-bordered card overlays the middle of
   the page with the manifesto + how-it-works. Posters are visible above
   and below the card, hinting at the constant city motion underneath. */

function TriptychColumn({ posters, dur, dir, gap = 6 }) {
  const strip = [...posters, ...posters];
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: CS.K, height: "100%",
      borderRight: `1.5px solid ${CS.K}`,
    }}>
      <div style={{
        display: "flex", flexDirection: "column", gap,
        padding: `${gap}px`,
        animation: `cs-tri-${dir} ${dur}s linear infinite`,
        willChange: "transform",
      }}>
        {strip.map((p, i) => (
          <DuotonePoster key={`${p}-${i}`} src={p}
            style={{
              width: "100%", aspectRatio: "1 / 1.32",
              border: `1px solid ${CS.K}`, flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LandingL6Triptych() {
  return (
    <PageShell dotGrid={false} footer={
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: CS.K, color: CS.W, zIndex: 30,
        padding: "14px 18px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <Mark color="rgba(255,255,255,0.5)">Шаг 1 / 4</Mark>
          <div style={{
            fontWeight: 900, fontSize: 18, lineHeight: 1, marginTop: 5,
            letterSpacing: "-0.025em", textTransform: "uppercase",
          }}>Войти в эту картинку</div>
        </div>
        <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 900 }}>→</span>
      </div>
    }>
      {/* edition strip (above the triptych) */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 7, marginBottom: 10,
        borderBottom: `2px solid ${CS.K}`,
      }}>
        <Mark>N° 001 · CITYSIGNAL</Mark>
        <Mark color={CS.G55}>MSC · SPB · WK 20</Mark>
      </div>

      {/* Triptych "stage" — fixed height column of scrolling posters,
          with overlay card centered on top */}
      <div style={{
        position: "relative",
        margin: "0 -18px",
        height: 720,
        overflow: "hidden",
        borderTop: `2px solid ${CS.K}`, borderBottom: `2px solid ${CS.K}`,
      }}>
        {/* The 3 columns, fill the stage */}
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        }}>
          <TriptychColumn posters={POSTERS_8} dur={30} dir="down" />
          <TriptychColumn posters={[...POSTERS_8].reverse()} dur={24} dir="up" />
          <TriptychColumn posters={POSTERS_8} dur={36} dir="down" />
        </div>

        {/* fade top/bottom into white */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 40,
          background: "linear-gradient(to bottom, #FFFFFF, transparent)",
          pointerEvents: "none", zIndex: 2,
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
          background: "linear-gradient(to top, #FFFFFF, transparent)",
          pointerEvents: "none", zIndex: 2,
        }} />

        {/* Centered overlay card with the manifesto */}
        <div style={{
          position: "absolute", left: 16, right: 16, top: 96,
          background: CS.W, border: `2.5px solid ${CS.K}`,
          boxShadow: `5px 5px 0 ${CS.B}`,
          padding: "16px 16px 16px",
          zIndex: 5,
          fontFamily: "var(--cs-font-sans)",
        }}>
          {/* corner stamp */}
          <span style={{
            position: "absolute", top: -3, right: -3,
            background: CS.B, color: CS.W,
            padding: "5px 8px",
            fontWeight: 900, fontSize: 9, letterSpacing: "0.22em", lineHeight: 1,
          }}>ABOUT</span>

          <Mark color={CS.G55}>Что это</Mark>
          <div style={{
            fontWeight: 900, fontSize: 30, lineHeight: 0.92,
            letterSpacing: "-0.04em", textTransform: "uppercase",
            color: CS.K, marginTop: 6,
          }}>
            CitySignal —
          </div>
          <div style={{
            fontWeight: 900, fontSize: 30, lineHeight: 0.92,
            letterSpacing: "-0.04em", textTransform: "uppercase",
            color: CS.B, marginLeft: 8,
          }}>
            то, что
          </div>
          <div style={{
            fontWeight: 900, fontSize: 30, lineHeight: 0.92,
            letterSpacing: "-0.04em", textTransform: "uppercase",
            color: CS.K,
          }}>
            движется в городе
          </div>

          <div style={{
            fontWeight: 600, fontSize: 12.5, lineHeight: 1.45,
            color: CS.G70, marginTop: 10,
          }}>
            Подборка событий Москвы и Петербурга, которых нет в больших афишах: подвалы, галереи, клубы, кинопоказы, лекции. Раз в неделю — одна лента под твой вкус.
          </div>

          {/* Mini how-it-works */}
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: `1.5px solid ${CS.K}`,
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
          }}>
            {[
              { n: "01", t: "Слежу", b: "35+ каналов" },
              { n: "02", t: "Отбираю", b: "ред. + алг." },
              { n: "03", t: "Шлю", b: "1 раз / нед." },
            ].map((s) => (
              <div key={s.n}>
                <div style={{
                  fontFamily: "var(--cs-font-mono)", fontSize: 9,
                  color: CS.B, fontWeight: 700, letterSpacing: "0.06em",
                }}>{s.n}</div>
                <div style={{
                  fontWeight: 900, fontSize: 12, lineHeight: 1,
                  letterSpacing: "-0.02em", textTransform: "uppercase",
                  color: CS.K, marginTop: 3,
                }}>{s.t}</div>
                <div style={{
                  fontFamily: "var(--cs-font-mono)", fontSize: 9,
                  color: CS.G55, marginTop: 3, letterSpacing: "0.04em",
                }}>{s.b}</div>
              </div>
            ))}
          </div>

          {/* Stats bottom row */}
          <div style={{
            marginTop: 12,
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            borderTop: `2px solid ${CS.K}`, paddingTop: 8,
          }}>
            <span style={{
              fontWeight: 900, fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: CS.K,
            }}>Сейчас в эфире</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{
                fontWeight: 900, fontSize: 22, color: CS.B, lineHeight: 1,
                letterSpacing: "-0.04em",
              }}>142</span>
              <span style={{
                fontFamily: "var(--cs-font-mono)", fontSize: 10, color: CS.G55,
              }}>событий / нед.</span>
            </span>
          </div>
        </div>

        {/* Bottom-of-stage label */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 8,
          padding: "0 18px", zIndex: 3,
          display: "flex", justifyContent: "space-between",
          fontFamily: "var(--cs-font-mono)", fontSize: 9,
          color: CS.W, letterSpacing: "0.16em", textTransform: "uppercase",
          textShadow: "0 0 4px rgba(0,0,0,0.5)",
        }}>
          <span>↓ за неделю</span>
          <span>↑ live now</span>
          <span>↓ MSC + SPB</span>
        </div>
      </div>

      <style>{`
        @keyframes cs-tri-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        @keyframes cs-tri-up   { from { transform: translateY(0); }     to { transform: translateY(-50%); } }
      `}</style>
    </PageShell>
  );
}

window.LandingL6Triptych = LandingL6Triptych;
