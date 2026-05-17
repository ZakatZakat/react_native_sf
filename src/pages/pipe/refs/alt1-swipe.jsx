/* ALT 1 — SWIPE-TRAIN
   Not a category picker — a taste trainer.
   Show real event cards one at a time. User taps ✕ or ♥.
   Each ♥ counts a vote for that event's category. After ~8 cards
   the system reveals the inferred categories. Tinder meets Pitchfork. */

/* Curate a varied sample deck — mix of categories, 10 cards */
const DECK = [
  "201", "401", "501", "701", "1101", "301", "801", "601", "1201", "101",
].map((id) => EVENTS.find((e) => e.id === Number(id))).filter(Boolean);

function SwipeCard({ ev, idx, top, onSwipe, isTop }) {
  const cat = CAT_BY_KEY[ev.cat];
  const rotate = [-1.2, 0.9, -0.6][idx % 3] || 0;
  return (
    <div style={{
      position: "absolute", inset: 0,
      transform: `translateY(${top}px) scale(${1 - idx * 0.04}) rotate(${rotate}deg)`,
      transition: "transform 0.3s var(--cs-ease)",
      zIndex: 10 - idx,
      pointerEvents: isTop ? "auto" : "none",
    }}>
      <div style={{
        width: "100%", height: "100%",
        border: `2.5px solid ${CS.K}`, background: CS.W,
        boxShadow: isTop ? `5px 5px 0 ${CS.B}` : `3px 3px 0 ${CS.K}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: "var(--cs-font-sans)",
      }}>
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <DuotonePoster src={ev.poster} style={{ position: "absolute", inset: 0 }} />
          <div style={{
            position: "absolute", top: 10, left: 10, zIndex: 2,
            background: CS.W, color: CS.K, padding: "4px 8px",
            fontWeight: 900, fontSize: 9, letterSpacing: "0.22em",
            border: `1.5px solid ${CS.K}`, lineHeight: 1,
          }}>{cat.ru}</div>
          <div style={{
            position: "absolute", top: 10, right: 10, zIndex: 2,
            background: CS.K, color: CS.W, padding: "4px 8px",
            fontFamily: "var(--cs-font-mono)", fontSize: 9, letterSpacing: "0.06em",
          }}>{ev.date} · {ev.time}</div>
        </div>
        <div style={{ padding: "12px 14px 14px", borderTop: `2px solid ${CS.K}` }}>
          <div style={{
            fontFamily: "var(--cs-font-mono)", fontSize: 9,
            color: CS.G55, letterSpacing: "0.06em", marginBottom: 5,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>{ev.channel}</span>
            <span>пошёл бы?</span>
          </div>
          <div style={{
            fontWeight: 900, fontSize: 19, lineHeight: 1, letterSpacing: "-0.03em",
            textTransform: "uppercase", color: CS.K,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {ev.title}
          </div>
          <div style={{ fontWeight: 600, fontSize: 11, color: CS.G55, marginTop: 6 }}>
            {ev.venue}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const isYes = verdict === "yes";
  return (
    <div style={{
      position: "absolute", top: 60, left: "50%",
      transform: `translateX(-50%) rotate(${isYes ? -8 : 8}deg)`,
      zIndex: 30, pointerEvents: "none",
      background: isYes ? CS.B : CS.K, color: CS.W,
      padding: "10px 18px",
      fontWeight: 900, fontSize: 22, letterSpacing: "0.16em",
      border: `3px solid ${CS.K}`,
      animation: "cs-stamp 0.5s var(--cs-ease) both",
    }}>{isYes ? "ХОЧУ" : "МИМО"}</div>
  );
}

function Alt1Swipe() {
  const [i, setI] = React.useState(0);
  const [tally, setTally] = React.useState({}); /* catKey -> 1 */
  const [liked, setLiked] = React.useState(0);
  const [verdict, setVerdict] = React.useState(null); /* "yes" | "no" | null */

  const done = i >= DECK.length;
  const top = done ? null : DECK[i];

  const decide = (kind) => {
    if (done || verdict) return;
    setVerdict(kind);
    if (kind === "yes") {
      const k = top.cat;
      setTally((t) => ({ ...t, [k]: (t[k] || 0) + 1 }));
      setLiked((n) => n + 1);
    }
    setTimeout(() => {
      setVerdict(null);
      setI((x) => x + 1);
    }, 360);
  };

  const reset = () => {
    setI(0); setTally({}); setLiked(0);
  };

  /* Derived: top 3 categories the user gravitates to */
  const inferred = React.useMemo(() => (
    Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, n]) => ({ cat: CAT_BY_KEY[k], n }))
  ), [tally]);

  /* Estimated feed size (sum of category counts) */
  const estFeed = inferred.reduce((s, x) => s + x.cat.count, 0);

  return (
    <PageShell dotGrid={false} footer={
      done ? (
        <OnboardFooter count={inferred.length} eventsCount={estFeed} canFinish={inferred.length > 0} />
      ) : (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          background: CS.W, borderTop: `2.5px solid ${CS.K}`, zIndex: 20,
          padding: "12px 16px 16px",
          display: "flex", gap: 10,
        }}>
          <button onClick={() => decide("no")} style={{
            flex: 1, padding: "14px 0",
            fontFamily: "var(--cs-font-sans)", cursor: "pointer",
            fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase",
            border: `3px solid ${CS.K}`, background: CS.W, color: CS.K,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: `3px 3px 0 ${CS.K}`,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span>
            <span>Мимо</span>
          </button>
          <button onClick={() => decide("yes")} style={{
            flex: 1, padding: "14px 0",
            fontFamily: "var(--cs-font-sans)", cursor: "pointer",
            fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase",
            border: `3px solid ${CS.K}`, background: CS.K, color: CS.W,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: `3px 3px 0 ${CS.B}`,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, color: CS.B }}>♥</span>
            <span>Хочу</span>
          </button>
        </div>
      )
    }>
      <OnboardHeader
        title1={done ? "Готово." : "Пошёл бы?"}
        title2={done ? "Лента" : "Жми."}
        subtitle={done ? (
          <>Что тебя зацепило — стало <span style={{ color: CS.K, fontWeight: 900 }}>категориями</span>. Можно поправить.</>
        ) : (
          <>Смотри карточки, тапай <span style={{ color: CS.K, fontWeight: 900 }}>✕ или ♥</span>. Лента подстроится сама.</>
        )}
      />

      {!done ? (
        <>
          {/* Progress dots */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 12,
            justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", gap: 4 }}>
              {DECK.map((_, idx) => (
                <span key={idx} style={{
                  width: 18, height: 5,
                  background: idx < i ? CS.K : idx === i ? CS.B : CS.G18,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: "var(--cs-font-mono)", fontSize: 10, color: CS.G55,
            }}>
              {i + 1} / {DECK.length}  ·  ♥ {liked}
            </span>
          </div>

          {/* Card stack */}
          <div style={{ position: "relative", width: "100%", aspectRatio: "0.8 / 1", margin: "0 auto" }}>
            {[2, 1, 0].map((k) => {
              const idx = i + k;
              if (idx >= DECK.length) return null;
              const ev = DECK[idx];
              return <SwipeCard key={ev.id + "-" + idx} ev={ev} idx={k} top={k * 6} isTop={k === 0} />;
            })}
            <VerdictBadge verdict={verdict} />
          </div>
        </>
      ) : (
        <>
          {/* Result page */}
          <div style={{
            border: `2px solid ${CS.K}`, padding: "16px 14px",
            boxShadow: `4px 4px 0 ${CS.B}`, marginTop: 4,
          }}>
            <Mark color={CS.G55}>На основе ♥ {liked} из {DECK.length}</Mark>
            <div style={{
              fontWeight: 900, fontSize: 24, marginTop: 6,
              letterSpacing: "-0.035em", lineHeight: 1, textTransform: "uppercase",
            }}>
              Похоже, ты про
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {inferred.length === 0 ? (
                <div style={{ fontWeight: 600, fontSize: 12, color: CS.G55 }}>
                  Ничего не зацепило. Можно пройти ещё раз.
                </div>
              ) : inferred.map((x, j) => (
                <div key={x.cat.key} style={{
                  display: "grid", gridTemplateColumns: "24px 1fr 56px", alignItems: "center",
                  paddingBottom: 7, borderBottom: `1px solid ${CS.G18}`, gap: 10,
                }}>
                  <span style={{ fontFamily: "var(--cs-font-mono)", fontSize: 10, color: CS.G55 }}>
                    {String(j + 1).padStart(2, "0")}
                  </span>
                  <span style={{
                    fontWeight: 900, fontSize: 17,
                    letterSpacing: "-0.025em", textTransform: "uppercase",
                  }}>{x.cat.ru}</span>
                  <span style={{
                    fontFamily: "var(--cs-font-mono)", fontSize: 10,
                    color: CS.B, textAlign: "right",
                  }}>+{x.cat.count} в ленту</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={reset} style={{
            marginTop: 12, width: "100%",
            fontFamily: "var(--cs-font-sans)", cursor: "pointer",
            fontWeight: 900, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "10px", border: `2px solid ${CS.K}`,
            background: CS.W, color: CS.K,
          }}>↻ Пройти ещё раз</button>
        </>
      )}

      <style>{`
        @keyframes cs-stamp {
          0% { opacity: 0; transform: translateX(-50%) scale(0.5) rotate(0deg); }
          100% { opacity: 1; }
        }
      `}</style>
    </PageShell>
  );
}

window.Alt1Swipe = Alt1Swipe;
