export type Choice = { name: string; vegetarian: boolean };
export type MenuDay = { date: string; status: "service" | "no-school"; choices: Choice[] };

export const cleanMealName = (name: string): string => {
  return name
    .replace(/\s*\([vV]\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const dateParts = (date: string) => ({
  weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
  day: Number(date.slice(-2)),
});

export const localDateKey = (now = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addUtcDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
};

export const utcDateKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Maps any date to the most relevant school day for display.
 * On weekends (Saturday or Sunday), advances to the upcoming Monday (+2 for Sat, +1 for Sun).
 * On weekdays (Monday–Friday), returns the date unchanged.
 */
export const getRelevantSchoolDate = (todayStr: string): string => {
  const [year, month, day] = todayStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 6) {
    return utcDateKey(addUtcDays(date, 2)); // Saturday -> upcoming Monday
  }
  if (dayOfWeek === 0) {
    return utcDateKey(addUtcDays(date, 1)); // Sunday -> upcoming Monday
  }
  return todayStr;
};

export const buildWeeks = (month: string): string[][] => {
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

export const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
};

export const formatCheckedAt = (date: string) => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
}).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));

export const formatWeek = (dates: string[]) => {
  const first = new Date(`${dates[0]}T12:00:00Z`);
  const last = new Date(`${dates.at(-1)}T12:00:00Z`);
  const firstLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(first);
  const lastLabel = new Intl.DateTimeFormat("en-US", { month: first.getUTCMonth() === last.getUTCMonth() ? undefined : "short", day: "numeric", timeZone: "UTC" }).format(last);
  return `${firstLabel}–${lastLabel}`;
};

export const isServiceDay = (dateStr: string, mealsMap: Map<string, MenuDay>) => {
  const meal = mealsMap.get(dateStr);
  return meal?.status === "service";
};

export const getInitialDayForWeek = (weekDates: string[], targetDateStr: string, mealsMap: Map<string, MenuDay>) => {
  if (weekDates.includes(targetDateStr)) {
    if (isServiceDay(targetDateStr, mealsMap)) return targetDateStr;
    const targetIndex = weekDates.indexOf(targetDateStr);
    for (let i = targetIndex + 1; i < weekDates.length; i++) {
      if (isServiceDay(weekDates[i], mealsMap)) return weekDates[i];
    }
    return targetDateStr;
  }
  for (const d of weekDates) {
    if (isServiceDay(d, mealsMap)) return d;
  }
  return weekDates[0];
};
