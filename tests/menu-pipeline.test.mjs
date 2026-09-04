import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROGRAMS,
  discoverElementaryPost,
  discoverLunchImage,
  discoverPostForProgram,
  discoverLunchImageForProgram,
  validateMenu
} from "../scripts/menu-pipeline.mjs";

test("discovers the standard elementary post and ignores special menus", () => {
  const html = `
    <article><div class="fsTitle"><a href="/bayside">SEPTEMBER- BAYSIDE ELEMENTARY SCHOOL MENUS</a></div><time datetime="2026-08-31T09:00:00-07:00"></time></article>
    <article><div class="fsTitle"><a href="/standard">SEPTEMBER- ELEMENTARY SCHOOL MENUS</a></div><time datetime="2026-08-26T13:34:00-07:00"></time></article>`;
  assert.deepEqual(discoverElementaryPost(html), {
    title: "SEPTEMBER- ELEMENTARY SCHOOL MENUS",
    postUrl: "https://www.smfcsd.net/standard",
    postedAt: "2026-08-26T20:34:00.000Z",
    month: "2026-09"
  });
});

test("discovers posts for all 5 programs", () => {
  const html = `
    <article><div class="fsTitle"><a href="/standard">SEPTEMBER- ELEMENTARY SCHOOL MENUS</a></div><time datetime="2026-08-26T13:34:00-07:00"></time></article>
    <article><div class="fsTitle"><a href="/bayside">SEPTEMBER- BAYSIDE ELEMENTARY SCHOOL MENUS</a></div><time datetime="2026-08-31T09:13:00-07:00"></time></article>
    <article><div class="fsTitle"><a href="/middle">SEPTEMBER- MIDDLE SCHOOL MENUS</a></div><time datetime="2026-08-31T09:26:00-07:00"></time></article>
    <article><div class="fsTitle"><a href="/6-8">SEPTEMBER- 6-8 MENUS- PARKSIDE, FIESTA GARDENS, NORTH SHOREVIEW</a></div><time datetime="2026-08-31T09:37:00-07:00"></time></article>
    <article><div class="fsTitle"><a href="/preschool">SEPTEMBER- PRESCHOOL MENUS</a></div><time datetime="2026-08-25T09:06:00-07:00"></time></article>
  `;

  for (const prog of PROGRAMS) {
    const post = discoverPostForProgram(html, prog);
    assert.ok(post, `Should discover post for ${prog.id}`);
    assert.equal(post.month, "2026-09");
  }
});

test("chooses the newest full-size lunch image", () => {
  const html = `
    https://resources.finalsite.net/images/f_auto,q_auto/v1654639596/smfcsdnet/old/English-Whatsforlunch-Elementary.png
    https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1788453923/smfcsdnet/new/ESLUNCHMENU_1.png
    https://resources.finalsite.net/images/f_auto,q_auto/v1788453857/smfcsdnet/new/ESBREAKFAST.png`;
  assert.equal(discoverLunchImage(html), "https://resources.finalsite.net/images/f_auto,q_auto/v1788453923/smfcsdnet/new/ESLUNCHMENU_1.png");
});

test("chooses the correct lunch images for all programs", () => {
  const baysideHtml = `https://resources.finalsite.net/images/f_auto,q_auto/v1788454392/smfcsdnet/ebdl7ose2eeiqibducjf/SEPTBAYSIDELUNCHMENU.png
                       https://resources.finalsite.net/images/f_auto,q_auto/v1788454341/smfcsdnet/fl1yqcbpj1eovnsxeozf/SEPTBAYSIDEBREAKFASTMENU.png`;
  const baysideProg = PROGRAMS.find((p) => p.id === "elementary-bayside");
  assert.equal(discoverLunchImageForProgram(baysideHtml, baysideProg), "https://resources.finalsite.net/images/f_auto,q_auto/v1788454392/smfcsdnet/ebdl7ose2eeiqibducjf/SEPTBAYSIDELUNCHMENU.png");
});

test("current menu passes structural validation", async () => {
  const menu = JSON.parse(await readFile(new URL("../src/data/current.json", import.meta.url), "utf8"));
  assert.deepEqual(validateMenu(menu), []);
});

test("all program menus in current.json pass structural validation", async () => {
  const data = JSON.parse(await readFile(new URL("../src/data/current.json", import.meta.url), "utf8"));
  assert.ok(data.programs, "current.json should contain programs dictionary");
  assert.equal(Object.keys(data.programs).length, 5);
  for (const [id, progMenu] of Object.entries(data.programs)) {
    const errors = validateMenu(progMenu);
    assert.deepEqual(errors, [], `Validation errors for ${id}: ${errors.join(", ")}`);
  }
});
