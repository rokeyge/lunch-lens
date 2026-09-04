import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const MENU_PAGE_URL = "https://www.smfcsd.net/district-departments/business-services/child-nutrition-services/menu";
const CURRENT_MENU_PATH = fileURLToPath(new URL("../src/data/current.json", import.meta.url));
const ARCHIVE_DIRECTORY = fileURLToPath(new URL("../src/data/menus", import.meta.url));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["month", "title", "dailyNote", "days"],
  properties: {
    month: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}$" },
    title: { type: "string", minLength: 1 },
    dailyNote: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "status", "choices"],
        properties: {
          date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
          status: { type: "string", enum: ["service", "no-school"] },
          choices: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "vegetarian"],
              properties: {
                name: { type: "string", minLength: 1 },
                vegetarian: { type: "boolean" }
              }
            }
          }
        }
      }
    }
  }
};

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["approved", "discrepancies", "notes"],
  properties: {
    approved: { type: "boolean" },
    discrepancies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "kind", "message"],
        properties: {
          date: { type: "string" },
          kind: { type: "string", enum: ["date", "meal-text", "vegetarian", "closure", "daily-note", "other"] },
          message: { type: "string" }
        }
      }
    },
    notes: { type: "array", items: { type: "string" } }
  }
};

const decodeHtml = (value) => value
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'")
  .replaceAll("&amp;", "&")
  .replaceAll("&nbsp;", " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const targetYearForMonth = (postDate, targetMonthIndex) => {
  const postedMonth = postDate.getUTCMonth();
  let year = postDate.getUTCFullYear();
  if (targetMonthIndex < postedMonth - 6) year += 1;
  if (targetMonthIndex > postedMonth + 6) year -= 1;
  return year;
};

export function discoverElementaryPost(html) {
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  const candidates = [];

  for (const article of articles) {
    const titleMatch = article.match(/<div class="fsTitle[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title = decodeHtml(titleMatch[2]);
    if (!/ELEMENTARY SCHOOL MENUS?/i.test(title) || /BAYSIDE|6-8|MIDDLE|PRESCHOOL/i.test(title)) continue;

    const monthIndex = MONTHS.findIndex((month) => new RegExp(`\\b${month}\\b`, "i").test(title));
    const dateMatch = article.match(/<time[^>]+datetime="([^"]+)"/i);
    if (monthIndex < 0 || !dateMatch) continue;
    const postedAt = new Date(dateMatch[1]);
    const year = targetYearForMonth(postedAt, monthIndex);
    candidates.push({
      title,
      postUrl: new URL(titleMatch[1], MENU_PAGE_URL).href,
      postedAt: postedAt.toISOString(),
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`
    });
  }

  if (!candidates.length) throw new Error("Could not find the standard elementary lunch menu post.");
  return candidates.sort((a, b) => b.postedAt.localeCompare(a.postedAt))[0];
}

export function discoverLunchImage(postHtml) {
  const decoded = postHtml.replaceAll("&quot;", '"').replaceAll("%22", '"').replaceAll("&amp;", "&");
  const urls = [...decoded.matchAll(/https:\/\/resources\.finalsite\.net\/images\/[^"'&<>\s]+?\.(?:png|jpe?g|webp)/gi)]
    .map((match) => match[0].replace(/,t_image_size_\d+/g, ""));
  const candidates = [...new Set(urls)]
    .filter((url) => /lunch/i.test(url) && !/breakfast|middle|turnbull|bayside/i.test(url))
    .sort((a, b) => {
      const aVersion = Number(a.match(/\/v(\d+)\//)?.[1] || 0);
      const bVersion = Number(b.match(/\/v(\d+)\//)?.[1] || 0);
      return bVersion - aVersion;
    });

  if (!candidates.length) throw new Error("Could not find the full-size elementary lunch image in the district post.");
  return candidates[0];
}

const fetchBytes = async (url) => {
  const response = await fetch(url, { headers: { "user-agent": "Lunchbox-SMFC/1.0 (+https://github.com/rokeyge/lunch-lens)" } });
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") || "image/jpeg" };
};

export async function discoverSource() {
  const page = await fetch(MENU_PAGE_URL).then((response) => {
    if (!response.ok) throw new Error(`District menu page returned ${response.status}.`);
    return response.text();
  });
  const post = discoverElementaryPost(page);
  const postHtml = await fetch(post.postUrl).then((response) => {
    if (!response.ok) throw new Error(`District menu post returned ${response.status}.`);
    return response.text();
  });
  const imageUrl = discoverLunchImage(postHtml);
  const image = await fetchBytes(imageUrl);
  return {
    ...post,
    imageUrl,
    imageSha256: createHash("sha256").update(image.bytes).digest("hex"),
    imageBytes: image.bytes,
    imageContentType: image.contentType
  };
}

const expectedWeekdays = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const dates = [];
  for (let day = 1; day <= new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); day += 1) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    if (date.getUTCDay() >= 1 && date.getUTCDay() <= 5) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};

export function validateMenu(menu, expectedMonth = menu.month) {
  const errors = [];
  if (!/^\d{4}-\d{2}$/.test(menu.month || "")) errors.push("month must use YYYY-MM");
  if (menu.month !== expectedMonth) errors.push(`menu month ${menu.month} does not match discovered month ${expectedMonth}`);
  if (!Array.isArray(menu.days)) errors.push("days must be an array");
  if (errors.length) return errors;

  const expected = expectedWeekdays(menu.month);
  const dates = menu.days.map((day) => day.date);
  const actual = new Set(dates);
  if (actual.size !== dates.length) errors.push("dates must be unique");
  for (const date of expected) if (!actual.has(date)) errors.push(`missing weekday ${date}`);
  for (const date of dates) if (!expected.includes(date)) errors.push(`unexpected or non-weekday date ${date}`);

  for (const day of menu.days) {
    if (!['service', 'no-school'].includes(day.status)) errors.push(`${day.date}: invalid status`);
    if (!Array.isArray(day.choices)) {
      errors.push(`${day.date}: choices must be an array`);
      continue;
    }
    if (day.status === "no-school" && day.choices.length) errors.push(`${day.date}: no-school day has meal choices`);
    if (day.status === "service" && (day.choices.length < 1 || day.choices.length > 5)) errors.push(`${day.date}: service day needs 1–5 choices`);
    const names = new Set();
    for (const choice of day.choices) {
      if (typeof choice.name !== "string" || choice.name.trim().length < 2 || choice.name.length > 180) errors.push(`${day.date}: invalid meal name`);
      if (typeof choice.vegetarian !== "boolean") errors.push(`${day.date}: vegetarian must be true or false`);
      const normalized = String(choice.name).trim().toLowerCase();
      if (names.has(normalized)) errors.push(`${day.date}: duplicate meal choice ${choice.name}`);
      names.add(normalized);
    }
  }
  return errors;
}

const outputText = (response) => {
  for (const item of response.output || []) {
    for (const content of item.content || []) if (content.type === "output_text") return content.text;
  }
  throw new Error(`OpenAI response did not contain output text (status: ${response.status || "unknown"}).`);
};

const callStructured = async ({ name, schema, instructions, prompt, imageDataUrl }) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      instructions,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl, detail: "high" }
        ]
      }],
      text: { format: { type: "json_schema", name, strict: true, schema } }
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${body.error?.message || JSON.stringify(body)}`);
  return JSON.parse(outputText(body));
};

const extract = (imageDataUrl, month, correction = "") => callStructured({
  name: "elementary_lunch_menu",
  schema: extractionSchema,
  imageDataUrl,
  instructions: "You transcribe school lunch calendar images exactly into structured data. Do not infer ingredients, nutrition, allergens, or dietary properties. Treat vegetarian status as true only when the image explicitly marks the choice as vegetarian through its stated legend, symbol, or color key.",
  prompt: `Transcribe the standard elementary LUNCH menu for ${month}. Include every Monday–Friday date in the month. Mark closures as no-school with no choices. Preserve meal wording and punctuation. Put general daily offerings in dailyNote, not as dated choices.${correction}`
});

const review = (imageDataUrl, candidate) => callStructured({
  name: "elementary_lunch_review",
  schema: reviewSchema,
  imageDataUrl,
  instructions: "You are an independent transcription verifier. Compare the supplied JSON against the image character by character. Do not add or infer allergens, nutrition, ingredients, or dietary claims. Vegetarian is correct only when supported by the image's explicit legend, symbol, or color key.",
  prompt: `Review this proposed transcription. Approve only when every weekday, closure, meal choice, vegetarian marking, and daily note matches the image.\n\n${JSON.stringify(candidate, null, 2)}`
});

const readCurrent = async () => JSON.parse(await readFile(CURRENT_MENU_PATH, "utf8"));

export async function updateMenu() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for menu extraction.");
  const source = await discoverSource();
  const current = await readCurrent();
  if (current.sourceSha256 === source.imageSha256 && process.env.FORCE_MENU_UPDATE !== "true") {
    console.log(`No change: ${source.title} has the same image hash.`);
    return false;
  }
  if (source.month < current.month) {
    console.log(`No change: newest discovered menu ${source.month} is older than published menu ${current.month}.`);
    return false;
  }

  const imageDataUrl = `data:${source.imageContentType};base64,${source.imageBytes.toString("base64")}`;
  let candidate = await extract(imageDataUrl, source.month);
  let validationErrors = validateMenu(candidate, source.month);
  if (validationErrors.length) throw new Error(`Extraction failed validation:\n- ${validationErrors.join("\n- ")}`);

  let verdict = await review(imageDataUrl, candidate);
  if (!verdict.approved || verdict.discrepancies.length) {
    const correction = `\n\nA verifier found these possible errors in an earlier attempt. Re-read the image and produce a corrected full transcription:\n${JSON.stringify(verdict.discrepancies, null, 2)}`;
    candidate = await extract(imageDataUrl, source.month, correction);
    validationErrors = validateMenu(candidate, source.month);
    if (validationErrors.length) throw new Error(`Corrected extraction failed validation:\n- ${validationErrors.join("\n- ")}`);
    verdict = await review(imageDataUrl, candidate);
  }
  if (!verdict.approved || verdict.discrepancies.length) {
    throw new Error(`Independent review did not approve publication:\n${JSON.stringify(verdict, null, 2)}`);
  }

  const checkedAt = new Date().toISOString();
  const published = {
    schemaVersion: 1,
    menuType: "elementary-lunch",
    month: candidate.month,
    title: candidate.title,
    sourcePageUrl: source.postUrl,
    sourceImageUrl: source.imageUrl,
    sourceSha256: source.imageSha256,
    checkedAt,
    automated: true,
    model: MODEL,
    dailyNote: candidate.dailyNote,
    days: candidate.days.sort((a, b) => a.date.localeCompare(b.date))
  };
  const serialized = `${JSON.stringify(published, null, 2)}\n`;
  await mkdir(ARCHIVE_DIRECTORY, { recursive: true });
  await writeFile(`${ARCHIVE_DIRECTORY}/${published.month}.json`, serialized);
  await writeFile(CURRENT_MENU_PATH, serialized);
  console.log(`Published ${published.title} from ${source.imageUrl}`);
  return true;
}

const command = process.argv[2];
if (command === "discover") {
  const source = await discoverSource();
  console.log(JSON.stringify({ ...source, imageBytes: undefined }, null, 2));
} else if (command === "validate") {
  const path = process.argv[3] || CURRENT_MENU_PATH;
  const menu = JSON.parse(await readFile(path, "utf8"));
  const errors = validateMenu(menu);
  if (errors.length) throw new Error(`Menu validation failed:\n- ${errors.join("\n- ")}`);
  console.log(`Valid menu: ${menu.month} with ${menu.days.length} weekdays.`);
} else if (command === "update") {
  await updateMenu();
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.error("Usage: node scripts/menu-pipeline.mjs <discover|validate|update> [file]");
  process.exitCode = 1;
}
