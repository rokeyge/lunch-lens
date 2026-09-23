import { useEffect, useMemo, useRef, useState } from "react";
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
const archivedMenus = Object.values(
  import.meta.glob("./data/menus/*/*.json", { eager: true, import: "default" })
) as MenuProgram[];

const menusForProgram = (programId: string) => {
  const byMonth = new Map<string, MenuProgram>();
  for (const menu of archivedMenus) {
    if (menu.menuType === programId) byMonth.set(menu.month, menu);
  }
  const latest = currentData.programs?.[programId];
  if (latest) byMonth.set(latest.month, latest);
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
};

const defaultMenuForDate = (menus: MenuProgram[], dateKey: string) => {
  const month = dateKey.slice(0, 7);
  return menus.filter((menu) => menu.month <= month).at(-1) ?? menus[0] ?? currentData;
};

const schoolExists = (schoolId: string | null): schoolId is string =>
  schoolId !== null && SCHOOLS.some((school) => school.id === schoolId);

const getInitialSchoolId = () => {
  const schoolFromUrl = new URL(window.location.href).searchParams.get("school");
  if (schoolExists(schoolFromUrl)) return schoolFromUrl;

  const savedSchool = localStorage.getItem("lunchbox-school");
  return schoolExists(savedSchool) ? savedSchool : DEFAULT_SCHOOL_ID;
};

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

  const [schoolId, setSchoolId] = useState(getInitialSchoolId);
  const selectedSchool = useMemo(() => getSchool(schoolId), [schoolId]);
  const availableMenus = useMemo(() => menusForProgram(selectedSchool.programId), [selectedSchool.programId]);
  const weeks = useMemo(() => {
    const byMonday = new Map<string, string[]>();
    for (const menu of availableMenus) {
      for (const week of buildWeeks(menu.month)) byMonday.set(week[0], week);
    }
    return Array.from(byMonday.values()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableMenus]);
  const matchingWeek = weeks.findIndex((week) => week.includes(relevantSchoolDate));
  const currentWeek = matchingWeek >= 0 ? matchingWeek : relevantSchoolDate < weeks[0][0] ? 0 : weeks.length - 1;

  const [view, setView] = useState<"week" | "month">("week");
  const todayCalendarRef = useRef<HTMLElement | null>(null);
  const [weekIndex, setWeekIndex] = useState(currentWeek);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const mealsByDate = useMemo(() => new Map(
    availableMenus.flatMap((menu) => menu.days).map((meal) => [meal.date, meal])
  ), [availableMenus]);
  const displayedWeek = weeks[weekIndex] || weeks[0];
  const displayedMonth = displayedWeek[Math.floor(displayedWeek.length / 2)].slice(0, 7);
  const activeMenu = availableMenus.find((menu) => menu.month === displayedMonth)
    ?? defaultMenuForDate(availableMenus, displayedWeek[0]);

  // Ensure weekIndex stays strictly within valid bounds if program week count changes
  useEffect(() => {
    setWeekIndex((prev) => Math.max(0, Math.min(prev, weeks.length - 1)));
  }, [weeks.length]);

  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Check standalone mode, mobile device, and capture install prompt
  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    const checkMobile = () => {
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, []);

  const [selectedMobileDate, setSelectedMobileDate] = useState(() =>
    getInitialDayForWeek(displayedWeek, relevantSchoolDate, mealsByDate)
  );
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonthDate) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMonthDate(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedMonthDate]);

  useEffect(() => {
    const savedView = localStorage.getItem("lunchbox-view");
    const savedVegetarian = localStorage.getItem("lunchbox-vegetarian");

    if (savedView === "week" || savedView === "month") setView(savedView);
    if (savedVegetarian === "true") setVegetarianOnly(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("lunchbox-school", schoolId);

    const url = new URL(window.location.href);
    if (url.searchParams.get("school") !== schoolId) {
      url.searchParams.set("school", schoolId);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [schoolId]);

  useEffect(() => {
    const handlePopState = () => {
      const schoolFromUrl = new URL(window.location.href).searchParams.get("school");
      if (schoolExists(schoolFromUrl)) setSchoolId(schoolFromUrl);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setSelectedMobileDate((prev) => {
      if (displayedWeek.includes(prev)) return prev;
      return getInitialDayForWeek(displayedWeek, relevantSchoolDate, mealsByDate);
    });
  }, [displayedWeek, relevantSchoolDate, mealsByDate]);

  useEffect(() => {
    if (view !== "month" || !window.matchMedia("(max-width: 760px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      todayCalendarRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, selectedSchool.programId]);

  const handleSchoolChange = (newSchoolId: string) => {
    setSchoolId(newSchoolId);
    setSelectedMonthDate(null);
    const newSchool = getSchool(newSchoolId);
    const newWeeksByMonday = new Map<string, string[]>();
    for (const menu of menusForProgram(newSchool.programId)) {
      for (const week of buildWeeks(menu.month)) newWeeksByMonday.set(week[0], week);
    }
    const newWeeks = Array.from(newWeeksByMonday.values()).sort((a, b) => a[0].localeCompare(b[0]));
    const newMatching = newWeeks.findIndex((week) => week.includes(relevantSchoolDate));
    setWeekIndex(newMatching >= 0 ? newMatching : relevantSchoolDate < newWeeks[0][0] ? 0 : newWeeks.length - 1);
  };

  const changeView = (value: "week" | "month") => {
    setView(value);
    setSelectedMonthDate(null);
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

  const firstMenuMonth = availableMenus[0].month;
  const lastMenuMonth = availableMenus.at(-1)?.month ?? firstMenuMonth;
  const monthLabel = view === "month" && firstMenuMonth !== lastMenuMonth
    ? `${formatMonth(firstMenuMonth)} – ${formatMonth(lastMenuMonth)}`
    : formatMonth(activeMenu.month);
  const currentMonthKey = today.slice(0, 7);
  const isFutureMonthUnavailable = currentMonthKey > lastMenuMonth;

  const selectedMobileMeal = mealsByDate.get(selectedMobileDate);
  const selectedMobileMealFiltered = selectedMobileMeal
    ? { ...selectedMobileMeal, choices: visibleChoices(selectedMobileMeal) }
    : undefined;
  const selectedMonthMeal = selectedMonthDate ? mealsByDate.get(selectedMonthDate) : undefined;

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
    <main id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lunchbox SMFC home">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span>Lunchbox <em>SMFC</em></span>
        </a>
        <div className="school-selector-wrap">
          <span className="school-caption">Your school</span>
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
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </header>

      {isFutureMonthUnavailable && <div className="freshness-bar-container is-warning">
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
      </div>}

      <section className="hero">
        <div className="hero-copy">
          <h1>What’s for lunch?</h1>
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
                <div className="lunch-heading">
                  <h2>{selectedMobileDate === today ? "Today’s lunch" : `${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${selectedMobileDate}T12:00:00Z`))}’s lunch`}<span aria-hidden="true">.</span></h2>
                </div>
                <MealCard
                  meal={selectedMobileMealFiltered ?? { date: selectedMobileDate, status: "service", choices: [] }}
                  today={selectedMobileDate === today}
                  outsideMonth={!mealsByDate.has(selectedMobileDate)}
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
                    outsideMonth={!mealsByDate.has(date)}
                    key={date}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <>
          <div
            id="panel-range-month"
            role="tabpanel"
            aria-labelledby="tab-range-month"
            className="calendar"
            aria-label={`${monthLabel} lunch calendar`}
          >
            <h2 className="calendar-mobile-title">{monthLabel}</h2>
            {(["Mon", "Tue", "Wed", "Thu", "Fri"] as const).map((day) => (
              <div className="calendar-heading" key={day} aria-hidden="true">{day}</div>
            ))}
            {weeks.flat().map((date) => {
              const meal = mealsByDate.get(date);
              const choices = meal ? visibleChoices(meal).slice().sort((a, b) => Number(a.vegetarian) - Number(b.vegetarian)) : [];
              const outside = !mealsByDate.has(date);
              return (
                <article
                  className={`calendar-cell ${outside ? "outside" : ""} ${date === today ? "current" : ""} ${meal?.status === "no-school" ? "closed" : ""}`}
                  key={date}
                  ref={date === today ? todayCalendarRef : undefined}
                  tabIndex={0}
                  aria-label={`${date}: ${outside ? "outside menu month" : meal?.status === "no-school" ? "no school" : choices.map((c) => cleanMealName(c.name)).join(", ")}`}
                >
                  {!outside && <button className="calendar-day-pick" type="button" onClick={() => setSelectedMonthDate(date)} aria-label={`View ${date} lunch menu`}>
                    <strong>{dateParts(date).day === 1 && <small>{formatMonth(date.slice(0, 7)).slice(0, 3)} </small>}{dateParts(date).day}</strong>
                    <span className="calendar-menu-mark" aria-hidden="true" />
                  </button>}
                  <div className="calendar-date">
                    <strong>{dateParts(date).day}</strong>
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
          <p className="calendar-grid-hint">Tap a date to see lunch. A red dash means no school.</p>
          {selectedMonthDate && selectedMonthMeal && (
            <div className="calendar-dialog-backdrop" onClick={() => setSelectedMonthDate(null)}>
              <section className="calendar-dialog" role="dialog" aria-modal="true" aria-label={`${selectedMonthDate} lunch menu`} onClick={(event) => event.stopPropagation()}>
                <button className="calendar-dialog-close" type="button" autoFocus onClick={() => setSelectedMonthDate(null)} aria-label="Close day menu">×</button>
                <h2>{dateParts(selectedMonthDate).weekday}, {formatMonth(selectedMonthDate.slice(0, 7)).split(" ")[0]} {dateParts(selectedMonthDate).day}</h2>
                {selectedMonthMeal.status === "no-school" ? (
                  <p className="calendar-dialog-closed">No school · No lunch service</p>
                ) : visibleChoices(selectedMonthMeal).length ? (
                  <div className="calendar-dialog-choices">
                    {visibleChoices(selectedMonthMeal).map((choice) => (
                      <p className={choice.vegetarian ? "calendar-veg" : ""} key={choice.name}>
                        {cleanMealName(choice.name)}
                        {choice.vegetarian && <a className="veg-icon" href="#vegetarian-note" aria-label="District-marked vegetarian choice">V</a>}
                      </p>
                    ))}
                  </div>
                ) : <p>No vegetarian choices listed.</p>}
              </section>
            </div>
          )}
          </>
        )}

        <p className="menu-legend" id="vegetarian-note"><span className="veg-key" aria-hidden="true">V</span> Vegetarian options in green</p>
      </section>

      <div className="quiet-footer">
      <details className="menu-details">
        <summary>About, allergies &amp; original menus</summary>
        <p>An unofficial guide to SMFCSD lunch.</p>
        <p><strong>Daily options:</strong> {activeMenu.dailyNote}</p>
        <p>
          <strong>Allergy note:</strong> This is an unofficial transcription, not allergy guidance. Ingredients and substitutions can change; contact your school or Child Nutrition Services before relying on it for an allergy.
        </p>
        <p><strong>Original district menus:</strong></p>
        {availableMenus.map((menu) => (
          <p key={menu.month}><a href={`${import.meta.env.BASE_URL}${menu.sourceImagePath}`} target="_blank" rel="noreferrer">
            View {formatMonth(menu.month)} menu ↗
          </a> · Checked {formatCheckedAt(menu.checkedAt)}</p>
        ))}
      </details>

      {!isStandalone && (
        <div className="install-banner-wrap">
          <button
            type="button"
            className="save-app-btn bottom"
            onClick={handleOpenInstall}
            aria-label={isMobile ? "Add Lunchbox shortcut to your phone home screen" : "Add Lunchbox shortcut to your computer desktop"}
          >
            <span className="save-label">Save to home screen ↗</span>
          </button>
        </div>
      )}

      </div>

      <InstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        isMobile={isMobile}
      />
    </main>
  );
}
