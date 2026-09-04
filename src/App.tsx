import { useEffect, useMemo, useState } from "react";
import currentDataJson from "./data/current.json";
import { SCHOOLS, DEFAULT_SCHOOL_ID, getSchool, School } from "./data/schools";
import {
  Choice,
  MenuDay,
  cleanMealName,
  dateParts,
  localDateKey,
  buildWeeks,
  formatMonth,
  formatCheckedAt,
  formatWeek,
  isServiceDay,
  getInitialDayForWeek,
  getRelevantSchoolDate
} from "./utils/menu-helpers";
import { InstallModal, BeforeInstallPromptEvent } from "./components/InstallModal";

export type { Choice, MenuDay };

export type MenuProgram = {
  schemaVersion: number;
  menuType: string;
  month: string;
  title: string;
  sourcePageUrl: string;
  sourceImageUrl: string;
  sourceImagePath: string;
  sourceSha256: string;
  checkedAt: string;
  automated: boolean;
  model: string;
  dailyNote: string;
  days: MenuDay[];
};

type CurrentData = {
  schemaVersion: number;
  updatedAt: string;
  defaultProgram: string;
  programs: Record<string, MenuProgram>;
} & MenuProgram;

const currentData = currentDataJson as unknown as CurrentData;

function MealCard({ meal, today, outsideMonth }: { meal?: MenuDay; today: boolean; outsideMonth: boolean }) {
  const date = meal?.date ?? "";
  const { weekday, day } = date ? dateParts(date) : { weekday: "", day: 0 };
  const choices = (meal?.choices ?? [])
    .slice()
    .sort((a, b) => Number(a.vegetarian) - Number(b.vegetarian));

  return (
    <article className={`meal-card ${today ? "featured" : ""}`} data-today={today || undefined} tabIndex={0}>
      <div className="meal-date">
        <span className="weekday">{weekday}</span>
        <strong>{day || "—"}</strong>
        {today && <span className="today-pill">Today</span>}
      </div>
      {!meal || outsideMonth ? (
        <div className="no-school unavailable"><span>Other month</span><small>Not in this menu</small></div>
      ) : meal.status === "no-school" ? (
        <div className="no-school"><span>School’s out</span><small>No lunch service</small></div>
      ) : (
        <div className="choices">
          {choices.map((choice, index) => {
            const displayName = cleanMealName(choice.name);
            return (
              <div className={`choice ${choice.vegetarian ? "veg-choice" : ""}`} key={`${index}-${choice.name}`}>
                <span className="choice-number">{index + 1}</span>
                <h3>
                  {displayName}
                  {choice.vegetarian && (
                    <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>
                  )}
                </h3>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function App() {
  const today = localDateKey();
  const relevantSchoolDate = getRelevantSchoolDate(today);

  const [schoolId, setSchoolId] = useState(() => localStorage.getItem("lunchbox-school") || DEFAULT_SCHOOL_ID);
  const selectedSchool = useMemo(() => getSchool(schoolId), [schoolId]);

  const activeMenu: MenuProgram = useMemo(() => {
    return currentData.programs?.[selectedSchool.programId] ?? currentData;
  }, [selectedSchool.programId]);

  const weeks = useMemo(() => buildWeeks(activeMenu.month), [activeMenu.month]);
  const matchingWeek = weeks.findIndex((week) => week.includes(relevantSchoolDate));
  const currentWeek = matchingWeek >= 0 ? matchingWeek : relevantSchoolDate < `${activeMenu.month}-01` ? 0 : weeks.length - 1;

  const [view, setView] = useState<"week" | "month">("week");
  const [weekIndex, setWeekIndex] = useState(currentWeek);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);

  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const mealsByDate = useMemo(() => new Map(activeMenu.days.map((meal) => [meal.date, meal])), [activeMenu.days]);

  // Ensure weekIndex stays strictly within valid bounds if program week count changes
  useEffect(() => {
    setWeekIndex((prev) => Math.max(0, Math.min(prev, weeks.length - 1)));
  }, [weeks.length]);

  // Check standalone mode and capture Android install prompt
  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const displayedWeek = weeks[weekIndex] || weeks[0];

  const [selectedMobileDate, setSelectedMobileDate] = useState(() =>
    getInitialDayForWeek(displayedWeek, relevantSchoolDate, mealsByDate)
  );

  useEffect(() => {
    const savedView = localStorage.getItem("lunchbox-view");
    const savedVegetarian = localStorage.getItem("lunchbox-vegetarian");

    if (savedView === "week" || savedView === "month") setView(savedView);
    if (savedVegetarian === "true") setVegetarianOnly(true);
  }, []);

  useEffect(() => {
    setSelectedMobileDate((prev) => {
      if (displayedWeek.includes(prev)) return prev;
      return getInitialDayForWeek(displayedWeek, relevantSchoolDate, mealsByDate);
    });
  }, [displayedWeek, relevantSchoolDate, mealsByDate]);

  const handleSchoolChange = (newSchoolId: string) => {
    setSchoolId(newSchoolId);
    localStorage.setItem("lunchbox-school", newSchoolId);
    const newSchool = getSchool(newSchoolId);
    const newMenu: MenuProgram = currentData.programs?.[newSchool.programId] ?? currentData;
    const newWeeks = buildWeeks(newMenu.month);
    if (newMenu.month !== activeMenu.month) {
      const newMatching = newWeeks.findIndex((w) => w.includes(relevantSchoolDate));
      const newCurrent = newMatching >= 0 ? newMatching : relevantSchoolDate < `${newMenu.month}-01` ? 0 : newWeeks.length - 1;
      setWeekIndex(newCurrent);
    } else {
      setWeekIndex((prev) => Math.max(0, Math.min(prev, newWeeks.length - 1)));
    }
  };

  const changeView = (value: "week" | "month") => {
    setView(value);
    localStorage.setItem("lunchbox-view", value);
  };

  const changeVegetarian = (value: boolean) => {
    setVegetarianOnly(value);
    localStorage.setItem("lunchbox-vegetarian", String(value));
  };

  const jumpToToday = () => {
    setWeekIndex(currentWeek);
    const targetWeek = weeks[currentWeek];
    setSelectedMobileDate(getInitialDayForWeek(targetWeek, relevantSchoolDate, mealsByDate));
  };

  const isAwayFromToday = weekIndex !== currentWeek || (displayedWeek.includes(today) && selectedMobileDate !== today && isServiceDay(today, mealsByDate));

  const visibleChoices = (meal: MenuDay) => vegetarianOnly
    ? meal.choices.filter((choice) => choice.vegetarian)
    : meal.choices;

  const monthLabel = formatMonth(activeMenu.month);
  const currentMonthKey = today.slice(0, 7);
  const isFutureMonthUnavailable = currentMonthKey > activeMenu.month;

  const selectedMobileMeal = mealsByDate.get(selectedMobileDate);
  const selectedMobileMealFiltered = selectedMobileMeal
    ? { ...selectedMobileMeal, choices: visibleChoices(selectedMobileMeal) }
    : undefined;

  const schoolCategories = useMemo(() => {
    const groups = new Map<School["category"], School[]>();
    for (const school of SCHOOLS) {
      const list = groups.get(school.category) || [];
      list.push(school);
      groups.set(school.category, list);
    }
    return Array.from(groups.entries());
  }, []);

  const viewOptions = ["week", "month"] as const;
  const handleViewKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentOption: "week" | "month") => {
    const currentIndex = viewOptions.indexOf(currentOption);
    let targetIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      targetIndex = (currentIndex + 1) % viewOptions.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      targetIndex = (currentIndex - 1 + viewOptions.length) % viewOptions.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = viewOptions.length - 1;
    }
    if (targetIndex >= 0) {
      e.preventDefault();
      const nextOption = viewOptions[targetIndex];
      changeView(nextOption);
      document.getElementById(`tab-range-${nextOption}`)?.focus();
    }
  };

  const handleDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex = -1;
    if (e.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % displayedWeek.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + displayedWeek.length) % displayedWeek.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = displayedWeek.length - 1;
    }
    if (targetIndex >= 0) {
      e.preventDefault();
      const nextDate = displayedWeek[targetIndex];
      setSelectedMobileDate(nextDate);
      document.getElementById(`mobile-tab-${nextDate}`)?.focus();
    }
  };

  const handleOpenInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt().then(() => {
        deferredPrompt.userChoice.then((choice) => {
          if (choice.outcome === "accepted") setDeferredPrompt(null);
        });
      });
    } else {
      setShowInstallModal(true);
    }
  };

  return (
    <main>
      <header className="topbar">
        <div className="topbar-main">
          <a className="brand" href="#top" aria-label="Lunchbox SMFC home">
            <span className="brand-mark">L</span>
            <span>Lunchbox <em>SMFC</em></span>
          </a>
          {!isStandalone && (
            <button
              type="button"
              className="save-app-btn"
              onClick={handleOpenInstall}
              aria-label="Add Lunchbox shortcut to your phone home screen"
            >
              <span aria-hidden="true" className="save-icon">📱</span>
              <span className="save-label">Add to Phone</span>
            </button>
          )}
        </div>
        <div className="school-selector-wrap">
          <label htmlFor="school-select" className="visually-hidden">Select School</label>
          <select
            id="school-select"
            className="school-select"
            value={schoolId}
            onChange={(e) => handleSchoolChange(e.target.value)}
            aria-label="Select school to view menu"
          >
            {schoolCategories.map(([category, schools]) => (
              <optgroup key={category} label={category}>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.grades})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </header>

      <div className={`freshness-bar-container ${isFutureMonthUnavailable ? "is-warning" : "is-standard"}`}>
        {isFutureMonthUnavailable ? (
          <aside className="freshness-banner warning" role="status">
            <span>{formatMonth(currentMonthKey)} menu has not been processed yet</span>
            <span className="dot" aria-hidden="true">·</span>
            <a href={activeMenu.sourcePageUrl} target="_blank" rel="noreferrer">
              View district source <span aria-hidden="true">↗</span>
            </a>
          </aside>
        ) : (
          <aside className="freshness-banner" role="status">
            <span>{monthLabel} menu</span>
            <span className="dot" aria-hidden="true">·</span>
            <span>Checked {formatCheckedAt(activeMenu.checkedAt)}</span>
            <span className="dot" aria-hidden="true">·</span>
            <a href={`${import.meta.env.BASE_URL}${activeMenu.sourceImagePath}`} target="_blank" rel="noreferrer">
              View original <span aria-hidden="true">↗</span>
            </a>
          </aside>
        )}
      </div>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{monthLabel} · Lunch Menu</p>
          <h1>What’s for lunch?</h1>
        </div>
        <div className="menu-context">
          <span>Selected School</span>
          <strong>{selectedSchool.name}</strong>
          <small>{activeMenu.title}</small>
        </div>
      </section>

      <section className="content-shell" aria-label="Lunch menu">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Choose menu range">
            {viewOptions.map((option) => (
              <button
                key={option}
                id={`tab-range-${option}`}
                role="tab"
                aria-selected={view === option}
                aria-controls={`panel-range-${option}`}
                tabIndex={view === option ? 0 : -1}
                className={view === option ? "active" : ""}
                onClick={() => changeView(option)}
                onKeyDown={(e) => handleViewKeyDown(e, option)}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>

          <div className="toolbar-actions">
            {isAwayFromToday && (
              <button className="today-jump-btn" onClick={jumpToToday} aria-label="Jump back to current week and today">
                Today
              </button>
            )}
            <label className="veg-toggle" aria-label="Filter vegetarian only">
              <input type="checkbox" checked={vegetarianOnly} onChange={(e) => changeVegetarian(e.target.checked)} />
              <span className="veg-text-desktop">Vegetarian only</span>
              <span className="veg-text-mobile">🌱 Veg</span>
            </label>
          </div>
        </div>

        {view === "week" ? (
          <div id="panel-range-week" role="tabpanel" aria-labelledby="tab-range-week">
            <div className="week-nav">
              <button
                aria-label="Previous week"
                disabled={weekIndex === 0}
                onClick={() => setWeekIndex(weekIndex - 1)}
              >
                ←
              </button>
              <div className="week-label-wrap">
                <strong>{formatWeek(displayedWeek)}</strong>
              </div>
              <button
                aria-label="Next week"
                disabled={weekIndex === weeks.length - 1}
                onClick={() => setWeekIndex(weekIndex + 1)}
              >
                →
              </button>
            </div>

            {/* Mobile Layout: Compact 5-day pill row + expanded card below */}
            <div className="mobile-week-container">
              <div className="mobile-day-tabs" role="tablist" aria-label="Select weekday">
                {displayedWeek.map((date, idx) => {
                  const { weekday, day } = dateParts(date);
                  const isToday = date === today;
                  const isSelected = date === selectedMobileDate;
                  const meal = mealsByDate.get(date);
                  const isNoSchool = meal?.status === "no-school";

                  return (
                    <button
                      key={date}
                      id={`mobile-tab-${date}`}
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="mobile-day-panel"
                      tabIndex={isSelected ? 0 : -1}
                      aria-label={`${weekday}, ${date}${isToday ? " (Today)" : ""}${isNoSchool ? " (No school)" : ""}`}
                      className={`mobile-day-tab ${isSelected ? "selected" : ""} ${isToday ? "is-today" : ""} ${isNoSchool ? "is-closed" : ""}`}
                      onClick={() => setSelectedMobileDate(date)}
                      onKeyDown={(e) => handleDayKeyDown(e, idx)}
                    >
                      <span className="day-name">{weekday}</span>
                      <strong className="day-num">{day}</strong>
                      {isToday && <span className="today-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <div id="mobile-day-panel" className="mobile-expanded-card" role="tabpanel" aria-labelledby={`mobile-tab-${selectedMobileDate}`}>
                <MealCard
                  meal={selectedMobileMealFiltered ?? { date: selectedMobileDate, status: "service", choices: [] }}
                  today={selectedMobileDate === today}
                  outsideMonth={!selectedMobileDate.startsWith(activeMenu.month)}
                />
              </div>
            </div>

            {/* Desktop / Tablet Layout: Full 5-day row */}
            <div className="desktop-week-row">
              {displayedWeek.map((date) => {
                const meal = mealsByDate.get(date);
                const filtered = meal ? { ...meal, choices: visibleChoices(meal) } : undefined;
                return (
                  <MealCard
                    meal={filtered ?? { date, status: "service", choices: [] }}
                    today={date === today}
                    outsideMonth={!date.startsWith(activeMenu.month)}
                    key={date}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div
            id="panel-range-month"
            role="tabpanel"
            aria-labelledby="tab-range-month"
            className="calendar"
            aria-label={`${monthLabel} lunch calendar`}
          >
            {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((day) => (
              <div className="calendar-heading" key={day} aria-hidden="true">{day}</div>
            ))}
            {weeks.flat().map((date) => {
              const meal = mealsByDate.get(date);
              const choices = meal ? visibleChoices(meal).slice().sort((a, b) => Number(a.vegetarian) - Number(b.vegetarian)) : [];
              const outside = !date.startsWith(activeMenu.month);
              return (
                <article
                  className={`calendar-cell ${outside ? "outside" : ""} ${date === today ? "current" : ""}`}
                  key={date}
                  tabIndex={0}
                  aria-label={`${date}: ${outside ? "outside menu month" : meal?.status === "no-school" ? "no school" : choices.map((c) => cleanMealName(c.name)).join(", ")}`}
                >
                  <div className="calendar-date">
                    {dateParts(date).day}
                    {date === today && <span>Today</span>}
                  </div>
                  {outside ? (
                    <small>{formatMonth(date.slice(0, 7)).split(" ")[0]}</small>
                  ) : meal?.status === "no-school" ? (
                    <strong className="calendar-closed">No school</strong>
                  ) : (
                    choices.map((choice) => {
                      const displayName = cleanMealName(choice.name);
                      return (
                        <p className={choice.vegetarian ? "calendar-veg" : ""} key={choice.name}>
                          {displayName}
                          {choice.vegetarian && (
                            <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>
                          )}
                        </p>
                      );
                    })
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="daily-note">
          <span><strong>Daily:</strong> {activeMenu.dailyNote}</span>
          <span id="vegetarian-note"><span className="veg-key" aria-hidden="true">V</span> District-marked vegetarian choice</span>
        </p>
      </section>

      <section className="safety-note">
        <p>
          <strong>Allergies:</strong> This is an unofficial transcription, not allergy guidance. Ingredients and substitutions can change; contact your school or Child Nutrition Services.
        </p>
        <a href={`${import.meta.env.BASE_URL}${activeMenu.sourceImagePath}`} target="_blank" rel="noreferrer">
          Original district menu <span aria-hidden="true">↗</span>
        </a>
      </section>

      <footer>
        <span>Transcribed from the SMFCSD {monthLabel} menu.</span>
        <span>Checked {formatCheckedAt(activeMenu.checkedAt)} · {activeMenu.automated ? "Automated check" : "Verified transcription"}</span>
      </footer>

      <InstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
      />
    </main>
  );
}
