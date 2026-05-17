/* Shared tokens, data, primitives — version 2.
   No radar. The interest picker now powers a live preview feed. */

const CS = {
  K: "#0D0D0D",
  W: "#FFFFFF",
  B: "#0055FF",
  G70: "rgba(13,13,13,0.70)",
  G55: "rgba(13,13,13,0.55)",
  G35: "rgba(13,13,13,0.35)",
  G18: "rgba(13,13,13,0.18)",
  G06: "rgba(13,13,13,0.06)",
};

/* 12 categories — order kept stable across variations.
   Each has a count, used for the "X событий" affordance. */
const CATS = [
  { key: "cinema",  ru: "Кино",        en: "Cinema",       count: 14 },
  { key: "art",     ru: "Совр. иск.",  en: "Contemporary", count: 22 },
  { key: "music",   ru: "Музыка",      en: "Music",        count: 31 },
  { key: "club",    ru: "Клуб",        en: "Club",         count: 19 },
  { key: "theater", ru: "Театр",       en: "Theatre",      count: 11 },
  { key: "lect",    ru: "Лекции",      en: "Talks",        count: 9  },
  { key: "rave",    ru: "Рейв",        en: "Rave",         count: 7  },
  { key: "perf",    ru: "Перформанс",  en: "Performance",  count: 6  },
  { key: "photo",   ru: "Фото",        en: "Photo",        count: 12 },
  { key: "lit",     ru: "Литература",  en: "Literature",   count: 5  },
  { key: "fest",    ru: "Фестиваль",   en: "Festival",     count: 4  },
  { key: "strange", ru: "Странное",    en: "Strange",      count: 8  },
];
const CAT_BY_KEY = Object.fromEntries(CATS.map((c) => [c.key, c]));

/* Sample event database — 2–3 events per category.
   Real-ish Moscow / SPB events. Poster id 01–08 cycled. */
const EVENTS = [
  // cinema
  { id: 101, cat: "cinema",  title: "Бергман / Седьмая печать",  venue: "Гараж · кинозал",         date: "17.05", time: "21:00", poster: "01", channel: "@garage" },
  { id: 102, cat: "cinema",  title: "Ночной показ: «Стокер»",     venue: "Garage Screen Open Air",  date: "20.05", time: "23:30", poster: "06", channel: "@garage" },
  { id: 103, cat: "cinema",  title: "Док-сезон: «Сны Сибири»",    venue: "Третьяковка / Лекторий",  date: "22.05", time: "19:30", poster: "07", channel: "@gtg_lect" },
  // contemporary art
  { id: 201, cat: "art",     title: "Объект с фотоаппаратом",      venue: "Пречистенка 21",         date: "до 03.04", time: "12-21", poster: "01", channel: "@museumof" },
  { id: 202, cat: "art",     title: "Призраки модернизма",         venue: "ГЭС-2 / зал №3",          date: "до 30.06", time: "11-22", poster: "05", channel: "@ges2_moscow" },
  { id: 203, cat: "art",     title: "MMOMA: новые поступления",    venue: "Гоголевский 10",          date: "до 01.06", time: "12-21", poster: "03", channel: "@mmoma" },
  // music
  { id: 301, cat: "music",   title: "Shortparis · акустика",       venue: "Дом Радио, СПб",         date: "23.05", time: "20:00", poster: "02", channel: "@shortparis" },
  { id: 302, cat: "music",   title: "Кубинский джаз / квартет",    venue: "Шестнадцать тонн",       date: "25.05", time: "21:00", poster: "04", channel: "@16tons" },
  // club
  { id: 401, cat: "club",    title: "Mutabor — closing season",    venue: "Шарикоподшипниковская",  date: "31.05", time: "23:00", poster: "02", channel: "@mutabor_msk" },
  { id: 402, cat: "club",    title: "Mosaic · резиденты",          venue: "Mosaic, СПб",            date: "18.05", time: "23:30", poster: "08", channel: "@mosaic" },
  // theater
  { id: 501, cat: "theater", title: "«Топливо» / документальный",   venue: "Театр.doc",              date: "19.05", time: "20:00", poster: "03", channel: "@teatrdoc" },
  { id: 502, cat: "theater", title: "Богомолов / «Слуга двух...»",  venue: "Театр на М. Бронной",    date: "24.05", time: "19:00", poster: "07", channel: "@nabronnoy" },
  // lectures
  { id: 601, cat: "lect",    title: "Чем больна архитектура 90-х",  venue: "Стрелка",                date: "21.05", time: "19:30", poster: "06", channel: "@strelka" },
  { id: 602, cat: "lect",    title: "Куратор: как читать выставку", venue: "Гараж · лекторий",        date: "29.05", time: "19:00", poster: "01", channel: "@garage" },
  // rave
  { id: 701, cat: "rave",    title: "outline · open-air",           venue: "Сев. Речной вокзал",     date: "07.06", time: "22:00", poster: "04", channel: "@outline" },
  { id: 702, cat: "rave",    title: "POPOFF / live + DJs",          venue: "Powerhouse, СПб",        date: "25.05", time: "23:00", poster: "08", channel: "@powerhouse" },
  // perf
  { id: 801, cat: "perf",    title: "Тело как объект (премьера)",   venue: "ZIL, малая сцена",       date: "30.05", time: "20:00", poster: "05", channel: "@zilculture" },
  { id: 802, cat: "perf",    title: "Soundwalk / Ника Васильева",   venue: "парк Горького",          date: "01.06", time: "18:00", poster: "03", channel: "@gorkypark" },
  // photo
  { id: 901, cat: "photo",   title: "Серия «Зимний свет»",          venue: "Lumiere, СПб",           date: "до 12.06", time: "11-20", poster: "01", channel: "@lumieregallery" },
  { id: 902, cat: "photo",   title: "Открытие: Александр Гронский", venue: "Pop/off/art",            date: "26.05", time: "19:00", poster: "07", channel: "@popoffart" },
  // lit
  { id: 1001, cat: "lit",    title: "Поэт. вечер · Бронте",         venue: "Дом 12",                 date: "22.05", time: "19:30", poster: "05", channel: "@dom12" },
  { id: 1002, cat: "lit",    title: "Презентация: «Облачный полк»", venue: "Подписные издания, СПб", date: "27.05", time: "19:00", poster: "06", channel: "@podpisnie" },
  // fest
  { id: 1101, cat: "fest",   title: "Архстояние · 3 дня",           venue: "Никола-Ленивец",         date: "26-28.07", time: "all day", poster: "02", channel: "@arch_st" },
  { id: 1102, cat: "fest",   title: "Дикая Мята / open-air",        venue: "Бунырево, Тула",         date: "13-16.06", time: "all day", poster: "04", channel: "@mintaday" },
  // strange
  { id: 1201, cat: "strange",title: "Концерт для пылесоса",         venue: "ТРЦ \"Метрополис\", −2", date: "20.05", time: "20:00", poster: "08", channel: "@verystrange" },
  { id: 1202, cat: "strange",title: "Чтения протоколов ОВД",        venue: "квартирник, заявка",     date: "24.05", time: "19:00", poster: "03", channel: "@verystrange" },
  { id: 1203, cat: "strange",title: "Ритуал: спящие в музее",       venue: "Музей Москвы",           date: "08.06", time: "23:00", poster: "06", channel: "@verystrange" },
];

function eventsForCats(catKeys) {
  if (!catKeys.size) return [];
  return EVENTS.filter((e) => catKeys.has(e.cat));
}

/* ── Small typographic atoms ───────────────────────────────── */

function Mark({ children, color, style }) {
  return (
    <span style={{
      fontWeight: 900, fontSize: 9, letterSpacing: "0.32em",
      textTransform: "uppercase", color: color || CS.K, lineHeight: 1,
      fontFamily: "var(--cs-font-sans)",
      ...style,
    }}>{children}</span>
  );
}

function Label({ children, color, size = 11, style }) {
  return (
    <span style={{
      fontWeight: 900, fontSize: size, letterSpacing: "0.18em",
      textTransform: "uppercase", color: color || CS.K, lineHeight: 1,
      fontFamily: "var(--cs-font-sans)",
      ...style,
    }}>{children}</span>
  );
}

/* Duotone-treated poster — black + signal-blue multiply, like in spec */
function DuotonePoster({ src, style }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: CS.W, ...style,
    }}>
      <img src={`posters/${src}.jpg`} alt=""
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: "grayscale(1) contrast(1.18) brightness(0.95)",
          display: "block",
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: CS.B, mixBlendMode: "multiply", opacity: 0.85,
        pointerEvents: "none",
      }} />
      {/* riso dot overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.18, pointerEvents: "none",
        backgroundImage: `radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 1.2px)`,
        backgroundSize: "4px 4px",
      }} />
    </div>
  );
}

/* Shared title block — no radar copy */
function OnboardHeader({ title1 = "Что тебя", title2 = "цепляет", subtitle }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 8, marginBottom: 8, borderBottom: `2px solid ${CS.K}`,
      }}>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
          padding: 0, cursor: "pointer", fontFamily: "var(--cs-font-sans)",
          fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: CS.B,
        }}>
          <span style={{ fontSize: 14 }}>←</span> Назад
        </button>
        <Label color={CS.W} style={{ background: CS.K, padding: "6px 10px" }}>Шаг 1 / 2</Label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <Mark color={CS.G55}>Section / Интересы</Mark>
        <Mark color={CS.G55}>12 категорий</Mark>
      </div>

      <div style={{ paddingBottom: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 0.86, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K }}>
          {title1}
        </div>
        <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 0.86, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.B, marginLeft: 14 }}>
          {title2}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.4, color: CS.G55, marginTop: 12, marginBottom: 12 }}>
        {subtitle || (
          <>Жми категории — <span style={{ color: CS.K, fontWeight: 900 }}>сразу видно</span>, какие события туда попадают.</>
        )}
      </div>
    </div>
  );
}

/* Sticky bottom action bar */
function OnboardFooter({ count, eventsCount, canFinish }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: CS.W, borderTop: `2.5px solid ${CS.K}`, zIndex: 20,
      padding: "12px 18px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Mark color={CS.G55} style={{ letterSpacing: "0.22em" }}>В твоей ленте</Mark>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 28, color: CS.K, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {eventsCount}
          </span>
          <span style={{ fontWeight: 800, fontSize: 11, color: CS.G55 }}>
            событий · {count}/12 кат.
          </span>
        </div>
      </div>
      <button
        disabled={!canFinish}
        style={{
          fontFamily: "var(--cs-font-sans)",
          fontWeight: 900, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "13px 16px", border: `3px solid ${CS.K}`,
          background: canFinish ? CS.K : CS.W, color: canFinish ? CS.W : CS.G35,
          cursor: canFinish ? "pointer" : "not-allowed",
          boxShadow: canFinish ? `3px 3px 0 ${CS.B}` : "none",
          transition: "all 0.14s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <span>Открыть</span>
        <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
      </button>
    </div>
  );
}

/* Page chrome — paper, max-width frame, dotted grid bg, status-bar safe */
function PageShell({ children, dotGrid = true, footer }) {
  return (
    <div style={{
      width: "100%", height: "100%", background: CS.W,
      position: "relative", overflow: "hidden",
      fontFamily: "var(--cs-font-sans)", color: CS.K,
    }}>
      {dotGrid && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.55,
          backgroundImage: `radial-gradient(${CS.G18} 1px, transparent 1.4px)`,
          backgroundSize: "12px 12px", zIndex: 0,
        }} />
      )}
      <div style={{
        position: "relative", zIndex: 1, height: "100%",
        padding: "48px 18px 110px", boxSizing: "border-box",
        overflowY: "auto", overflowX: "hidden",
      }}>
        {children}
      </div>
      {footer}
    </div>
  );
}

Object.assign(window, {
  CS, CATS, CAT_BY_KEY, EVENTS, eventsForCats,
  Mark, Label, DuotonePoster, OnboardHeader, OnboardFooter, PageShell,
});
