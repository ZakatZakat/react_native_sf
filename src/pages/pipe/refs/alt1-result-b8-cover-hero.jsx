/* Profile variant — COVER HERO
   Magazine-cover composition. The top category gets a BIG poster
   takeover with its name set huge over the duotone image and stats
   in a corner block. The remaining categories sit below as a strip
   of small thumbnails, each with its own micro-stat. */

function ProfileCoverHero() {
  const top = SAMPLE_INFERRED[0];
  const rest = SAMPLE_INFERRED.slice(1);
  const topEv = SAMPLE_FEED_EVENTS.find((e) => e.cat === top.cat.key);
  const totalHits = SAMPLE_INFERRED.reduce((s, x) => s + x.n, 0);
  const topPct = Math.round((top.n / totalHits) * 100);

  return (
    <div style={{ fontFamily: "var(--cs-font-sans)" }}>
      {/* edition strip */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 0 7px", borderTop: `2px solid ${CS.K}`, borderBottom: `2px solid ${CS.K}`,
      }}>
        <Mark>Профиль</Mark>
        <Mark color={CS.G55}>
          ♥{SAMPLE_LIKED} → {SAMPLE_INFERRED.length} сигналов
        </Mark>
      </div>

      {/* HERO — top category */}
      <div style={{
        position: "relative", marginTop: 8,
        border: `2.5px solid ${CS.K}`, overflow: "hidden", background: CS.K,
        aspectRatio: "1.35 / 1",
      }}>
        <DuotonePoster src={topEv.poster} style={{ position: "absolute", inset: 0 }} />

        {/* top-left badge */}
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 3,
          background: CS.W, padding: "5px 8px",
          fontFamily: "var(--cs-font-mono)", fontSize: 9, color: CS.K,
          fontWeight: 700, letterSpacing: "0.06em",
          border: `1.5px solid ${CS.K}`,
        }}>
          N°01 · ГЛАВНЫЙ СИГНАЛ
        </div>

        {/* top-right stat block */}
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 3,
          background: CS.K, color: CS.W,
          padding: "6px 9px",
          textAlign: "right",
        }}>
          <div style={{
            fontFamily: "var(--cs-font-mono)", fontSize: 8.5,
            color: "rgba(255,255,255,0.65)", letterSpacing: "0.16em",
          }}>SHARE</div>
          <div style={{
            fontWeight: 900, fontSize: 22, letterSpacing: "-0.04em", lineHeight: 1,
            marginTop: 2,
          }}>{topPct}%</div>
        </div>

        {/* Huge name overlay (bottom-left) */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3,
          padding: "0",
        }}>
          {/* stats strip */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "4px 10px",
            background: CS.W, borderTop: `1.5px solid ${CS.K}`,
            fontFamily: "var(--cs-font-mono)", fontSize: 9,
            color: CS.G55, letterSpacing: "0.06em",
          }}>
            <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
              {Array.from({ length: top.n }).map((_, j) => (
                <span key={j} style={{ width: 7, height: 12, background: CS.B }} />
              ))}
              <span style={{ marginLeft: 4 }}>×{top.n} hit</span>
            </span>
            <span>+{top.cat.count} событий</span>
          </div>

          {/* name */}
          <div style={{
            background: CS.K, color: CS.W,
            padding: "10px 12px 12px",
            fontWeight: 900, fontSize: 32, lineHeight: 0.92,
            letterSpacing: "-0.04em", textTransform: "uppercase",
          }}>
            {top.cat.ru}
          </div>
        </div>
      </div>

      {/* Strip head for the rest */}
      <div style={{
        marginTop: 12, paddingBottom: 6,
        borderBottom: `1.5px solid ${CS.K}`,
        display: "flex", justifyContent: "space-between",
      }}>
        <Mark>Поддержка / +{rest.length}</Mark>
        <Mark color={CS.G55}>тап — убрать</Mark>
      </div>

      {/* Supporting thumbnails strip */}
      <div style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(rest.length, 5)}, 1fr)`,
        gap: 6,
      }}>
        {rest.map((x, i) => {
          const ev = SAMPLE_FEED_EVENTS.find((e) => e.cat === x.cat.key);
          return (
            <div key={x.cat.key} style={{
              border: `1.5px solid ${CS.K}`, background: CS.W,
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ position: "relative" }}>
                <DuotonePoster src={ev.poster} style={{ width: "100%", aspectRatio: "1/1" }} />
                <span style={{
                  position: "absolute", top: 3, left: 3,
                  background: CS.W, padding: "1px 4px",
                  fontFamily: "var(--cs-font-mono)", fontSize: 8, fontWeight: 700,
                  border: `1px solid ${CS.K}`,
                }}>{String(i + 2).padStart(2, "0")}</span>
                <span style={{
                  position: "absolute", top: 3, right: 3,
                  display: "inline-flex", gap: 2,
                  background: CS.W, padding: "2px 3px",
                  border: `1px solid ${CS.K}`,
                }}>
                  {Array.from({ length: x.n }).map((_, j) => (
                    <span key={j} style={{ width: 4, height: 5, background: CS.B }} />
                  ))}
                </span>
              </div>
              <div style={{
                padding: "4px 5px 5px", borderTop: `1px solid ${CS.K}`,
              }}>
                <div style={{
                  fontWeight: 900, fontSize: 9.5, lineHeight: 1,
                  letterSpacing: "-0.015em", textTransform: "uppercase",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{x.cat.ru}</div>
                <div style={{
                  fontFamily: "var(--cs-font-mono)", fontSize: 8, color: CS.G55,
                  marginTop: 1,
                }}>+{x.cat.count}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Result_B8_CoverHero() {
  const shelves = buildShelves();
  return (
    <PageShell
      dotGrid={false}
      footer={<OnboardFooter
        count={SAMPLE_INFERRED.length}
        eventsCount={SAMPLE_FEED_COUNT}
        canFinish={true}
      />}
    >
      <OnboardHeader
        title1="Похоже,"
        title2="ты про"
        subtitle={<>Сверху — <span style={{ color: CS.K, fontWeight: 900 }}>главный сигнал</span>. Внизу — поддержка.</>}
      />

      <ProfileCoverHero />

      <div style={{
        marginTop: 22, marginBottom: 4,
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <Label size={10}>Полки / Shelves</Label>
        <Mark color={CS.G55}>{shelves.length} рядов · {SAMPLE_FEED_COUNT} событий</Mark>
      </div>

      <div style={{ marginTop: 12 }}>
        {shelves.map((s, i) => (
          <Shelf key={s.cat.key} idx={i} cat={s.cat} hits={s.hits} events={s.events} />
        ))}
      </div>
    </PageShell>
  );
}

window.Result_B8_CoverHero = Result_B8_CoverHero;
