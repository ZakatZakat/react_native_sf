/* ALT 2 — PHOTO QUIZ
   4-step editorial questionnaire. Each step: a question + 4 poster
   tiles. Pick one. Each pick adds weight to 1-2 categories. After
   the last step, show inferred taste + feed estimate.

   Feels like a brutalist magazine quiz. */

const QUIZ = [
  {
    qShort: "Q1 / 4",
    q: "Вечер пятницы. Куда тебя тянет?",
    opts: [
      { label: "В подвал, где темно и громко",   poster: "02", cats: ["club", "rave"] },
      { label: "В галерею, где можно молчать",   poster: "01", cats: ["art", "photo"] },
      { label: "На сцену, где есть текст",       poster: "03", cats: ["theater", "lit"] },
      { label: "В кино, желательно странное",     poster: "06", cats: ["cinema", "strange"] },
    ],
  },
  {
    qShort: "Q2 / 4",
    q: "Кого хочется в твоём вечере?",
    opts: [
      { label: "Никого. Один, у стены",            poster: "07", cats: ["art", "photo", "lit"] },
      { label: "Полная коробка незнакомцев",       poster: "08", cats: ["rave", "club"] },
      { label: "Двое-трое и разговор до утра",     poster: "04", cats: ["lit", "lect"] },
      { label: "Сцена, я в зале",                  poster: "05", cats: ["music", "perf", "theater"] },
    ],
  },
  {
    qShort: "Q3 / 4",
    q: "Что для тебя «странное»?",
    opts: [
      { label: "Знакомое, поданное не так",         poster: "01", cats: ["art", "perf"] },
      { label: "Эксперимент без правил",            poster: "08", cats: ["strange", "rave"] },
      { label: "Большая идея в малой форме",        poster: "03", cats: ["theater", "lit", "lect"] },
      { label: "Музыка, которой ещё не было",       poster: "02", cats: ["music", "rave"] },
    ],
  },
  {
    qShort: "Q4 / 4",
    q: "Чтобы потом было что вспомнить:",
    opts: [
      { label: "Фестиваль на три дня",              poster: "04", cats: ["fest", "music"] },
      { label: "Одна сильная картина",              poster: "01", cats: ["art", "photo"] },
      { label: "Спектакль, который трясёт",         poster: "05", cats: ["theater", "perf"] },
      { label: "Сет, после которого до 7 утра",     poster: "02", cats: ["rave", "club"] },
    ],
  },
];

function QuizOption({ opt, idx, selected, onClick }) {
  const letters = ["A", "B", "C", "D"];
  return (
    <button onClick={onClick} style={{
      position: "relative", padding: 0, cursor: "pointer",
      border: `2px solid ${CS.K}`,
      background: CS.W,
      transition: "all 0.15s var(--cs-ease)",
      boxShadow: selected ? `3px 3px 0 ${CS.B}` : "none",
      transform: selected ? "translate(-1px,-1px)" : "translate(0,0)",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--cs-font-sans)",
      textAlign: "left", overflow: "hidden",
    }}>
      <div style={{ position: "relative" }}>
        <DuotonePoster src={opt.poster} style={{ width: "100%", aspectRatio: "1/1", borderBottom: `1.5px solid ${CS.K}` }} />
        <span style={{
          position: "absolute", top: 6, left: 6,
          width: 22, height: 22,
          background: selected ? CS.B : CS.W,
          color: selected ? CS.W : CS.K,
          border: `1.5px solid ${CS.K}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 12, lineHeight: 1,
        }}>{letters[idx]}</span>
        {selected && (
          <div style={{
            position: "absolute", inset: 0,
            border: `4px solid ${CS.B}`, pointerEvents: "none",
          }} />
        )}
      </div>
      <div style={{
        padding: "9px 10px 10px",
        fontWeight: 900, fontSize: 12.5, lineHeight: 1.15,
        letterSpacing: "-0.015em", color: CS.K,
        minHeight: 48,
      }}>
        {opt.label}
      </div>
    </button>
  );
}

function Alt2Quiz() {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState([]); /* index per step */

  const isDone = step >= QUIZ.length;
  const current = isDone ? null : QUIZ[step];

  /* Tally categories across all answered questions */
  const tally = React.useMemo(() => {
    const t = {};
    answers.forEach((aIdx, qIdx) => {
      const opt = QUIZ[qIdx].opts[aIdx];
      opt.cats.forEach((k) => { t[k] = (t[k] || 0) + 1; });
    });
    return t;
  }, [answers]);

  const inferred = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, n]) => ({ cat: CAT_BY_KEY[k], n }));
  const estFeed = inferred.reduce((s, x) => s + x.cat.count, 0);

  const pickOption = (oIdx) => {
    const next = [...answers];
    next[step] = oIdx;
    setAnswers(next);
    setTimeout(() => setStep((s) => s + 1), 280);
  };

  const reset = () => { setStep(0); setAnswers([]); };

  return (
    <PageShell
      dotGrid={false}
      footer={isDone ? (
        <OnboardFooter count={inferred.length} eventsCount={estFeed} canFinish={inferred.length > 0} />
      ) : (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          background: CS.W, borderTop: `2.5px solid ${CS.K}`, zIndex: 20,
          padding: "12px 16px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <Mark color={CS.G55}>Анкета</Mark>
            <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
              {QUIZ.map((_, idx) => (
                <span key={idx} style={{
                  width: 22, height: 5,
                  background: idx < step ? CS.K : idx === step ? CS.B : CS.G18,
                }} />
              ))}
            </div>
          </div>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{
            fontFamily: "var(--cs-font-sans)", cursor: step === 0 ? "not-allowed" : "pointer",
            fontWeight: 900, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
            padding: "10px 14px", border: `2px solid ${CS.K}`,
            background: CS.W, color: step === 0 ? CS.G35 : CS.K,
            opacity: step === 0 ? 0.5 : 1,
          }}>← Назад</button>
        </div>
      )}
    >
      <OnboardHeader
        title1={isDone ? "Готово." : "Анкета."}
        title2={isDone ? "Лента" : "4 шага"}
        subtitle={isDone ? (
          <>Вот <span style={{ color: CS.K, fontWeight: 900 }}>что выходит</span> из твоих ответов. Можно править.</>
        ) : (
          <>Выбери по одной карточке. Лента <span style={{ color: CS.K, fontWeight: 900 }}>соберётся сама</span>.</>
        )}
      />

      {!isDone ? (
        <>
          {/* Question header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingBottom: 7, marginBottom: 12,
            borderBottom: `2px solid ${CS.K}`,
          }}>
            <Mark>{current.qShort}</Mark>
            <Mark color={CS.G55}>Выбери одно</Mark>
          </div>
          <div style={{
            fontWeight: 900, fontSize: 22, lineHeight: 1.0,
            letterSpacing: "-0.025em", textTransform: "uppercase",
            color: CS.K, marginBottom: 14,
            animation: "cs-card-in 0.32s var(--cs-ease) both",
          }}>
            {current.q}
          </div>

          {/* 2x2 option grid */}
          <div
            key={step}
            style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9,
              animation: "cs-card-in 0.32s var(--cs-ease) both",
            }}
          >
            {current.opts.map((opt, i) => (
              <QuizOption key={i} opt={opt} idx={i}
                selected={answers[step] === i}
                onClick={() => pickOption(i)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Receipt-style result */}
          <div style={{
            border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.B}`,
            background: CS.W, padding: 0, marginTop: 6,
          }}>
            <div style={{
              padding: "10px 14px", background: CS.K, color: CS.W,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <Label color={CS.W}>Результат</Label>
              <span style={{ fontFamily: "var(--cs-font-mono)", fontSize: 10 }}>
                ID 0001 · 16.05.26
              </span>
            </div>
            <div style={{ padding: "14px 14px 16px" }}>
              <Mark color={CS.G55}>Твои сигналы</Mark>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {inferred.map((x, j) => (
                  <div key={x.cat.key} style={{
                    display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 10,
                    alignItems: "baseline", paddingBottom: 7,
                    borderBottom: `1px dotted ${CS.G35}`,
                  }}>
                    <span style={{
                      fontFamily: "var(--cs-font-mono)", fontSize: 10, color: CS.G55,
                    }}>{String(j + 1).padStart(2, "0")}</span>
                    <span style={{
                      fontWeight: 900, fontSize: 18,
                      letterSpacing: "-0.025em", textTransform: "uppercase",
                    }}>{x.cat.ru}</span>
                    <span style={{
                      fontFamily: "var(--cs-font-mono)", fontSize: 10, color: CS.B,
                    }}>×{x.n} · +{x.cat.count}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12, paddingTop: 8,
                borderTop: `2px solid ${CS.K}`,
                display: "flex", justifyContent: "space-between",
                fontWeight: 900, fontSize: 14, textTransform: "uppercase",
                letterSpacing: "-0.02em",
              }}>
                <span>В ленте</span>
                <span style={{ color: CS.B, fontSize: 22, letterSpacing: "-0.04em" }}>
                  {estFeed} событий
                </span>
              </div>
            </div>
          </div>
          <button onClick={reset} style={{
            marginTop: 12, width: "100%",
            fontFamily: "var(--cs-font-sans)", cursor: "pointer",
            fontWeight: 900, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
            padding: "10px", border: `2px solid ${CS.K}`,
            background: CS.W, color: CS.K,
          }}>↻ Заново</button>
        </>
      )}
    </PageShell>
  );
}

window.Alt2Quiz = Alt2Quiz;
