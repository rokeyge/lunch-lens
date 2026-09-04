import { useEffect, useMemo, useRef, useState } from "react";
import menuJson from "./data/current.json";

type Choice = { name: string; vegetarian: boolean };
type MenuDay = { date: string; status: "service" | "no-school"; choices: Choice[] };
type Menu = {
  schemaVersion: number;
  menuType: string;
  month: string;
  title: string;
  sourcePageUrl: string;
  sourceImageUrl: string;
  sourceSha256: string;
  checkedAt: string;
  automated: boolean;
  model: string;
  dailyNote: string;
  days: MenuDay[];
};

const MENU = menuJson as Menu;

const dateParts = (date: string) => ({
  weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
  day: Number(date.slice(-2)),
});

const localDateKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addUtcDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
};

const utcDateKey = (date: Date) => date.toISOString().slice(0, 10);

const buildWeeks = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const firstMonday = addUtcDays(first, -mondayOffset);
  const weeks: string[][] = [];

  for (let monday = firstMonday; monday <= last; monday = addUtcDays(monday, 7)) {
    weeks.push(Array.from({ length: 5 }, (_, index) => utcDateKey(addUtcDays(monday, index))));
  }
  return weeks;
};

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
};

const formatCheckedAt = (date: string) => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));

const formatWeek = (dates: string[]) => {
  const first = new Date(`${dates[0]}T12:00:00Z`);
  const last = new Date(`${dates.at(-1)}T12:00:00Z`);
  const firstLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(first);
  const lastLabel = new Intl.DateTimeFormat("en-US", { month: first.getUTCMonth() === last.getUTCMonth() ? undefined : "short", day: "numeric", timeZone: "UTC" }).format(last);
  return `${firstLabel}–${lastLabel}`;
};

function MealCard({ meal, today, outsideMonth }: { meal?: MenuDay; today: boolean; outsideMonth: boolean }) {
  const date = meal?.date ?? "";
  const { weekday, day } = dateParts(date);
  const choices = (meal?.choices ?? [])
    .slice()
    .sort((a, b) => Number(a.vegetarian) - Number(b.vegetarian));

  return (
    <article className={`meal-card ${today ? "featured" : ""}`} data-today={today || undefined}>
      <div className="meal-date">
        <span className="weekday">{weekday}</span>
        <strong>{day}</strong>
        {today && <span className="today-pill">Today</span>}
      </div>
      {!meal || outsideMonth ? (
        <div className="no-school unavailable"><span>Other month</span><small>Not in this menu</small></div>
      ) : meal.status === "no-school" ? (
        <div className="no-school"><span>School’s out</span><small>No lunch service</small></div>
      ) : (
        <div className="choices">
          {choices.map((choice, index) => (
            <div className={`choice ${choice.vegetarian ? "veg-choice" : ""}`} key={choice.name}>
              <span className="choice-number">{index + 1}</span>
              <h3>
                {choice.name}
                {choice.vegetarian && <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>}
              </h3>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function App() {
  const today = localDateKey();
  const weeks = useMemo(() => buildWeeks(MENU.month), []);
  const matchingWeek = weeks.findIndex((week) => week.includes(today));
  const currentWeek = matchingWeek >= 0 ? matchingWeek : today < `${MENU.month}-01` ? 0 : weeks.length - 1;
  const [view, setView] = useState<"week" | "month">("week");
  const [weekIndex, setWeekIndex] = useState(currentWeek);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const weekStrip = useRef<HTMLDivElement>(null);
  const mealsByDate = useMemo(() => new Map(MENU.days.map((meal) => [meal.date, meal])), []);

  useEffect(() => {
    const savedView = localStorage.getItem("lunchbox-view");
    const savedWeek = Number(localStorage.getItem("lunchbox-week"));
    const savedWeekMonth = localStorage.getItem("lunchbox-week-month");
    const savedVegetarian = localStorage.getItem("lunchbox-vegetarian");

    if (savedView === "week" || savedView === "month") setView(savedView);
    if (savedWeekMonth === MENU.month && Number.isInteger(savedWeek) && savedWeek >= 0 && savedWeek < weeks.length) setWeekIndex(savedWeek);
    if (savedVegetarian === "true") setVegetarianOnly(true);
  }, [weeks.length]);

  useEffect(() => {
    if (view === "week") {
      requestAnimationFrame(() => weekStrip.current?.querySelector("[data-today='true']")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
    }
  }, [view, weekIndex]);

  const changeView = (value: "week" | "month") => {
    setView(value);
    localStorage.setItem("lunchbox-view", value);
  };

  const changeWeek = (value: number) => {
    setWeekIndex(value);
    localStorage.setItem("lunchbox-week", String(value));
    localStorage.setItem("lunchbox-week-month", MENU.month);
  };

  const changeVegetarian = (value: boolean) => {
    setVegetarianOnly(value);
    localStorage.setItem("lunchbox-vegetarian", String(value));
  };

  const visibleChoices = (meal: MenuDay) => vegetarianOnly
    ? meal.choices.filter((choice) => choice.vegetarian)
    : meal.choices;

  const monthLabel = formatMonth(MENU.month);
  const displayedWeek = weeks[weekIndex];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lunchbox SMFC home">
          <span className="brand-mark">L</span>
          <span>Lunchbox <em>SMFC</em></span>
        </a>
        <span className="unofficial">Unofficial community project</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{monthLabel} · Elementary lunch</p>
          <h1>What’s for lunch?</h1>
        </div>
        <div className="menu-context">
          <span>District menu</span>
          <strong>Standard elementary schools</strong>
        </div>
      </section>

      <section className="content-shell" aria-label="Lunch menu">
        <div className="toolbar">
          <div className="tabs" role="group" aria-label="Choose menu range">
            {(["week", "month"] as const).map((option) => (
              <button key={option} className={view === option ? "active" : ""} onClick={() => changeView(option)}>
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
          <label className="veg-toggle">
            <input type="checkbox" checked={vegetarianOnly} onChange={(event) => changeVegetarian(event.target.checked)} />
            <span>Vegetarian only</span>
          </label>
        </div>

        {view === "week" ? (
          <>
            <div className="week-nav">
              <button aria-label="Previous week" disabled={weekIndex === 0} onClick={() => changeWeek(weekIndex - 1)}>←</button>
              <strong>{formatWeek(displayedWeek)}</strong>
              <button aria-label="Next week" disabled={weekIndex === weeks.length - 1} onClick={() => changeWeek(weekIndex + 1)}>→</button>
            </div>
            <div className="week-strip" ref={weekStrip}>
              {displayedWeek.map((date) => {
                const meal = mealsByDate.get(date);
                const filtered = meal ? { ...meal, choices: visibleChoices(meal) } : undefined;
                return <MealCard meal={filtered ?? { date, status: "service", choices: [] }} today={date === today} outsideMonth={!date.startsWith(MENU.month)} key={date} />;
              })}
            </div>
          </>
        ) : (
          <div className="calendar" aria-label={`${monthLabel} lunch calendar`}>
            {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((day) => <div className="calendar-heading" key={day}>{day}</div>)}
            {weeks.flat().map((date) => {
              const meal = mealsByDate.get(date);
              const choices = meal ? visibleChoices(meal).slice().sort((a, b) => Number(a.vegetarian) - Number(b.vegetarian)) : [];
              const outside = !date.startsWith(MENU.month);
              return (
                <article className={`calendar-cell ${outside ? "outside" : ""} ${date === today ? "current" : ""}`} key={date}>
                  <div className="calendar-date">{dateParts(date).day}{date === today && <span>Today</span>}</div>
                  {outside ? <small>{formatMonth(date.slice(0, 7)).split(" ")[0]}</small> : meal?.status === "no-school" ? <strong className="calendar-closed">No school</strong> : choices.map((choice) => (
                    <p className={choice.vegetarian ? "calendar-veg" : ""} key={choice.name}>
                      {choice.name}
                      {choice.vegetarian && <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>}
                    </p>
                  ))}
                </article>
              );
            })}
          </div>
        )}

        <p className="daily-note">
          <span><strong>Daily:</strong> {MENU.dailyNote}</span>
          <span id="vegetarian-note"><span className="veg-key">V</span> District-marked vegetarian choice</span>
        </p>
      </section>

      <section className="safety-note">
        <p><strong>Allergies:</strong> This is an unofficial transcription, not allergy guidance. Ingredients and substitutions can change; contact your school or Child Nutrition Services.</p>
        <a href={MENU.sourceImageUrl} target="_blank" rel="noreferrer">Original district menu <span aria-hidden="true">↗</span></a>
      </section>

      <footer>
        <span>Transcribed from the SMFCSD {monthLabel} elementary lunch menu.</span>
        <span>Checked {formatCheckedAt(MENU.checkedAt)} · {MENU.automated ? "Automated double-check" : "Manual transcription"}</span>
      </footer>
    </main>
  );
}
