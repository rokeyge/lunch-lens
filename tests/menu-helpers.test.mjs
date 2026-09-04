import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanMealName,
  getRelevantSchoolDate,
  buildWeeks,
  getInitialDayForWeek,
  isServiceDay
} from "../src/utils/menu-helpers.ts";

test("cleanMealName strips literal (V) and (v) without distorting surrounding text", () => {
  assert.equal(cleanMealName("Bean, rice & cheese burrito (V)"), "Bean, rice & cheese burrito");
  assert.equal(cleanMealName("Cheese bites (V) w/ marinara sauce"), "Cheese bites w/ marinara sauce");
  assert.equal(cleanMealName("NEW - Creamy tomato curry tortellini with garlic toast (V)"), "NEW - Creamy tomato curry tortellini with garlic toast");
  assert.equal(cleanMealName("Veggie nuggets, French fries & crackers (v)"), "Veggie nuggets, French fries & crackers");
  assert.equal(cleanMealName("Pepperoni pizza"), "Pepperoni pizza");
  assert.equal(cleanMealName("  Grilled cheese (V)  "), "Grilled cheese");
});

test("getRelevantSchoolDate maps weekends to upcoming Monday and preserves weekdays", () => {
  // Weekdays (Monday - Friday) unchanged
  assert.equal(getRelevantSchoolDate("2026-09-07"), "2026-09-07"); // Monday
  assert.equal(getRelevantSchoolDate("2026-09-08"), "2026-09-08"); // Tuesday
  assert.equal(getRelevantSchoolDate("2026-09-09"), "2026-09-09"); // Wednesday
  assert.equal(getRelevantSchoolDate("2026-09-10"), "2026-09-10"); // Thursday
  assert.equal(getRelevantSchoolDate("2026-09-11"), "2026-09-11"); // Friday

  // Weekend (Saturday -> Monday +2, Sunday -> Monday +1)
  assert.equal(getRelevantSchoolDate("2026-09-05"), "2026-09-07"); // Saturday -> Monday
  assert.equal(getRelevantSchoolDate("2026-09-06"), "2026-09-07"); // Sunday -> Monday

  // Month boundary weekends
  assert.equal(getRelevantSchoolDate("2026-08-29"), "2026-08-31"); // Saturday -> Monday
  assert.equal(getRelevantSchoolDate("2026-08-30"), "2026-08-31"); // Sunday -> Monday
  assert.equal(getRelevantSchoolDate("2026-10-31"), "2026-11-02"); // Saturday -> Monday
  assert.equal(getRelevantSchoolDate("2026-11-01"), "2026-11-02"); // Sunday -> Monday
});

test("getInitialDayForWeek selects relevant service day or advances past closures", () => {
  const mockMeals = new Map([
    ["2026-09-07", { date: "2026-09-07", status: "no-school", choices: [] }], // Labor Day
    ["2026-09-08", { date: "2026-09-08", status: "service", choices: [{ name: "Tacos", vegetarian: false }] }],
    ["2026-09-09", { date: "2026-09-09", status: "service", choices: [] }],
    ["2026-09-10", { date: "2026-09-10", status: "service", choices: [] }],
    ["2026-09-11", { date: "2026-09-11", status: "service", choices: [] }],
  ]);

  const week1 = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"];

  // When relevant date is Monday Labor Day (closure), advance to Tuesday service day
  const initialForClosure = getInitialDayForWeek(week1, "2026-09-07", mockMeals);
  assert.equal(initialForClosure, "2026-09-08");

  // When relevant date is Tuesday (service day), stay on Tuesday
  const initialForService = getInitialDayForWeek(week1, "2026-09-08", mockMeals);
  assert.equal(initialForService, "2026-09-08");

  // When relevant date is not in this week, select first service day of that week
  const initialOtherWeek = getInitialDayForWeek(week1, "2026-09-15", mockMeals);
  assert.equal(initialOtherWeek, "2026-09-08");
});

test("buildWeeks correctly structures 5-day school weeks for month", () => {
  const weeks = buildWeeks("2026-09");
  assert.ok(weeks.length >= 4);
  for (const week of weeks) {
    assert.equal(week.length, 5);
  }
  // First week of Sept 2026 starts on Monday 2026-08-31
  assert.equal(weeks[0][0], "2026-08-31");
  assert.equal(weeks[0][1], "2026-09-01");
});

test("menu-pipeline exports cleanMealName for ingestion normalization", async () => {
  const { cleanMealName: pipelineClean } = await import("../scripts/menu-pipeline.mjs");
  assert.equal(pipelineClean("Cheese bites (V) w/ marinara sauce"), "Cheese bites w/ marinara sauce");
  assert.equal(pipelineClean("Bean, rice & cheese burrito (V)"), "Bean, rice & cheese burrito");
});

