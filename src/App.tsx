import { useEffect, useMemo, useRef, useState } from "react";

type Meal = {
  date: string;
  choices?: { name: string; vegetarian?: boolean }[];
  noSchool?: boolean;
};

const SCHOOLS = [
  "Audubon Elementary",
  "Baywood Elementary",
  "Beach Park Elementary",
  "Beresford Elementary",
  "Brewer Island Elementary",
  "College Park Elementary",
  "Cottage Grove Elementary",
  "Foster City Elementary",
  "George Hall Elementary",
  "Highlands Elementary",
  "Laurel Elementary",
  "Meadow Heights Elementary",
  "San Mateo Park Elementary",
  "Sunnybrae Elementary",
];

const SOURCE_URL =
  "https://resources.finalsite.net/images/f_auto,q_auto/v1788453923/smfcsdnet/uwpmmgi3wjb4p0vlcl9b/ESLUNCHMENU_1.png";

const MEALS: Meal[] = [
  { date: "2026-09-01", choices: [{ name: "Beef taquitos with salsa" }, { name: "Bean, rice & cheese burrito", vegetarian: true }] },
  { date: "2026-09-02", choices: [{ name: "Orange chicken with vegetable fried rice" }, { name: "Tofu in butter simmer sauce, rice & naan bread", vegetarian: true }] },
  { date: "2026-09-03", choices: [{ name: "Chicken Alfredo pasta" }, { name: "Veggie nuggets, fries & crackers", vegetarian: true }] },
  { date: "2026-09-04", choices: [{ name: "Cheese pizza", vegetarian: true }, { name: "Pepperoni pizza" }] },
  { date: "2026-09-07", noSchool: true },
  { date: "2026-09-08", choices: [{ name: "Chicken adobo, potatoes & rice" }, { name: "Cheese bites with marinara", vegetarian: true }] },
  { date: "2026-09-09", choices: [{ name: "Beef stroganoff with rotini pasta" }, { name: "Grilled cheese", vegetarian: true }] },
  { date: "2026-09-10", choices: [{ name: "Teriyaki chicken dumplings with veggie fried rice" }, { name: "Cheese enchiladas in chile verde sauce", vegetarian: true }] },
  { date: "2026-09-11", choices: [{ name: "Cheese pizza", vegetarian: true }, { name: "Pepperoni pizza" }] },
  { date: "2026-09-14", choices: [{ name: "Turkey nachos & tortilla chips" }, { name: "Veggie burger & fries", vegetarian: true }] },
  { date: "2026-09-15", choices: [{ name: "Cheese breadsticks & marinara", vegetarian: true }, { name: "Tinga chicken rice bowl" }] },
  { date: "2026-09-16", choices: [{ name: "Chicken burger with fries" }, { name: "Vegetarian Florentine pasta", vegetarian: true }] },
  { date: "2026-09-17", choices: [{ name: "Pollo Loco drumstick, cilantro rice & corn" }, { name: "Bean & cheese pupusa with curtido", vegetarian: true }] },
  { date: "2026-09-18", choices: [{ name: "Cheese pizza", vegetarian: true }, { name: "Pepperoni pizza" }] },
  { date: "2026-09-21", noSchool: true },
  { date: "2026-09-22", choices: [{ name: "Chicken nuggets & fries" }, { name: "Creamy tomato curry tortellini with garlic toast", vegetarian: true }] },
  { date: "2026-09-23", choices: [{ name: "BBQ chicken meatballs, mashed potatoes & garlic toast" }, { name: "Bean & cheese quesadilla", vegetarian: true }, { name: "Hummus, cucumbers & pita chips", vegetarian: true }] },
  { date: "2026-09-24", choices: [{ name: "Macaroni & cheese", vegetarian: true }, { name: "Chicken corn dog" }] },
  { date: "2026-09-25", choices: [{ name: "Cheese pizza", vegetarian: true }, { name: "Pepperoni pizza" }] },
  { date: "2026-09-28", choices: [{ name: "Chicken tikka masala with rice & naan bread" }, { name: "Veggie burger & fries", vegetarian: true }] },
  { date: "2026-09-29", choices: [{ name: "Beef taquitos with salsa" }, { name: "Bean, rice & cheese burrito", vegetarian: true }] },
  { date: "2026-09-30", choices: [{ name: "Orange chicken with vegetable fried rice" }, { name: "Tofu in butter simmer sauce, rice & naan bread", vegetarian: true }] },
];

const TODAY = "2026-09-03";
const WEEKS = [
  ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
  ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"],
  ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"],
  ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"],
  ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"],
];
const WEEK_LABELS = ["Aug 31–Sep 4", "Sep 7–11", "Sep 14–18", "Sep 21–25", "Sep 28–Oct 2"];

const dateParts = (date: string) => ({
  weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
  day: Number(date.slice(-2)),
});

function MealCard({ meal, featured = false }: { meal: Meal; featured?: boolean }) {
  const { weekday, day } = dateParts(meal.date);
  return (
    <article className={`meal-card ${featured ? "featured" : ""}`} data-today={featured || undefined}>
      <div className="meal-date">
        <span className="weekday">{weekday}</span>
        <strong>{day}</strong>
        {featured && <span className="today-pill">Today</span>}
      </div>
      {!meal.choices && !meal.noSchool ? (
        <div className="no-school unavailable"><span>Previous menu</span><small>Open the August source</small></div>
      ) : meal.noSchool ? (
        <div className="no-school"><span>School’s out</span><small>No lunch service</small></div>
      ) : (
        <div className="choices">
          {meal.choices?.map((choice, index) => (
            <div className={`choice ${choice.vegetarian ? "veg-choice" : ""}`} key={choice.name}>
              <span className="choice-number">{index + 1}</span>
              <div>
                <h3>
                  {choice.name}
                  {choice.vegetarian && <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [school, setSchool] = useState(SCHOOLS[0]);
  const [view, setView] = useState<"week" | "month">("week");
  const [weekIndex, setWeekIndex] = useState(0);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const weekStrip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSchool = localStorage.getItem("lunchbox-school");
    const savedView = localStorage.getItem("lunchbox-view");
    const savedWeek = Number(localStorage.getItem("lunchbox-week"));
    const savedVegetarian = localStorage.getItem("lunchbox-vegetarian");

    if (savedSchool && SCHOOLS.includes(savedSchool)) setSchool(savedSchool);
    if (savedView === "week" || savedView === "month") setView(savedView);
    if (Number.isInteger(savedWeek) && savedWeek >= 0 && savedWeek < WEEKS.length) setWeekIndex(savedWeek);
    if (savedVegetarian === "true") setVegetarianOnly(true);
  }, []);

  useEffect(() => {
    if (view === "week") {
      requestAnimationFrame(() => weekStrip.current?.querySelector("[data-today='true']")?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
    }
  }, [view, weekIndex]);

  const changeSchool = (value: string) => {
    setSchool(value);
    localStorage.setItem("lunchbox-school", value);
  };

  const changeView = (value: "week" | "month") => {
    setView(value);
    localStorage.setItem("lunchbox-view", value);
  };

  const changeWeek = (value: number) => {
    setWeekIndex(value);
    localStorage.setItem("lunchbox-week", String(value));
  };

  const changeVegetarian = (value: boolean) => {
    setVegetarianOnly(value);
    localStorage.setItem("lunchbox-vegetarian", String(value));
  };

  const mealsByDate = useMemo(() => new Map(MEALS.map((meal) => [meal.date, meal])), []);
  const filterMeal = (meal: Meal): Meal => !meal.choices ? meal : {
    ...meal,
    choices: meal.choices
      .filter((choice) => !vegetarianOnly || choice.vegetarian)
      .sort((a, b) => Number(Boolean(a.vegetarian)) - Number(Boolean(b.vegetarian))),
  };

  const weekMeals = WEEKS[weekIndex].map((date) => filterMeal(mealsByDate.get(date) || { date }));

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
          <p className="eyebrow">September 2026 · Elementary lunch</p>
          <h1>What’s for lunch?</h1>
        </div>
        <label className="school-picker">
          <span>Your school</span>
          <select value={school} onChange={(event) => changeSchool(event.target.value)}>
            {SCHOOLS.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
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
              <strong>{WEEK_LABELS[weekIndex]}</strong>
              <button aria-label="Next week" disabled={weekIndex === WEEKS.length - 1} onClick={() => changeWeek(weekIndex + 1)}>→</button>
            </div>
            <div className="week-strip" ref={weekStrip}>
              {weekMeals.map((meal) => <MealCard meal={meal} featured={meal.date === TODAY} key={meal.date} />)}
            </div>
          </>
        ) : (
          <div className="calendar" aria-label="September 2026 lunch calendar">
            {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((day) => <div className="calendar-heading" key={day}>{day}</div>)}
            <div className="calendar-cell outside"><span>31</span><small>August</small></div>
            {MEALS.map((rawMeal) => {
              const meal = filterMeal(rawMeal);
              return (
                <article className={`calendar-cell ${meal.date === TODAY ? "current" : ""}`} key={meal.date}>
                  <div className="calendar-date">{dateParts(meal.date).day}{meal.date === TODAY && <span>Today</span>}</div>
                  {meal.noSchool ? <strong className="calendar-closed">No school</strong> : meal.choices?.map((choice) => (
                    <p className={choice.vegetarian ? "calendar-veg" : ""} key={choice.name}>
                      {choice.name}
                      {choice.vegetarian && <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>}
                    </p>
                  ))}
                </article>
              );
            })}
            <div className="calendar-cell outside"><span>1</span><small>October</small></div>
            <div className="calendar-cell outside"><span>2</span><small>October</small></div>
          </div>
        )}

        <p className="daily-note">
          <span><strong>Daily:</strong> entrée, yogurt pack or sunflower-butter sandwich, fruit, vegetable, and milk.</span>
          <span id="vegetarian-note"><span className="veg-key">V</span> District-marked vegetarian choice</span>
        </p>
      </section>

      <section className="safety-note">
        <p><strong>Allergies:</strong> This is an unofficial transcription, not allergy guidance. Ingredients and substitutions can change; contact your school or Child Nutrition Services.</p>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">Original district menu <span aria-hidden="true">↗</span></a>
      </section>

      <footer>
        <span>Transcribed from the SMFCSD September elementary lunch menu.</span>
        <span>Last checked September 3, 2026</span>
      </footer>
    </main>
  );
}
