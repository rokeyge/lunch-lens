import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { discoverElementaryPost, discoverLunchImage, validateMenu } from "../scripts/menu-pipeline.mjs";

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

test("chooses the newest full-size lunch image", () => {
  const html = `
    https://resources.finalsite.net/images/f_auto,q_auto/v1654639596/smfcsdnet/old/English-Whatsforlunch-Elementary.png
    https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1788453923/smfcsdnet/new/ESLUNCHMENU_1.png
    https://resources.finalsite.net/images/f_auto,q_auto/v1788453857/smfcsdnet/new/ESBREAKFAST.png`;
  assert.equal(discoverLunchImage(html), "https://resources.finalsite.net/images/f_auto,q_auto/v1788453923/smfcsdnet/new/ESLUNCHMENU_1.png");
});

test("current menu passes structural validation", async () => {
  const menu = JSON.parse(await readFile(new URL("../src/data/current.json", import.meta.url), "utf8"));
  assert.deepEqual(validateMenu(menu), []);
});
