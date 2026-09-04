import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PROGRAMS } from "./menu-pipeline.mjs";

const CURRENT_PATH = fileURLToPath(new URL("../src/data/current.json", import.meta.url));
const GEMINI_API_KEY = process.env.LUNCH_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

if (!GEMINI_API_KEY) {
  console.error("Error: LUNCH_KEY or GEMINI_API_KEY environment variable is required.");
  process.exit(1);
}

const targetProgramId = process.argv[2] || "elementary-standard";
const program = PROGRAMS.find((p) => p.id === targetProgramId) || PROGRAMS[0];

const extractionSchema = {
  type: "OBJECT",
  required: ["month", "title", "dailyNote", "days"],
  properties: {
    month: { type: "STRING" },
    title: { type: "STRING" },
    dailyNote: { type: "STRING" },
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["date", "status", "choices"],
        properties: {
          date: { type: "STRING" },
          status: { type: "STRING", enum: ["service", "no-school"] },
          choices: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["name", "vegetarian"],
              properties: {
                name: { type: "STRING" },
                vegetarian: { type: "BOOLEAN" }
              }
            }
          }
        }
      }
    }
  }
};

async function runComparison() {
  console.log(`\n======================================================`);
  console.log(`🤖 Gemini 2.0 Flash Dry-Run Comparison for: ${program.name} (${program.id})`);
  console.log(`======================================================\n`);

  const currentData = JSON.parse(await readFile(CURRENT_PATH, "utf8"));
  const expectedMenu = currentData.programs?.[program.id] || currentData;

  const imagePath = fileURLToPath(new URL(`../public/${expectedMenu.sourceImagePath}`, import.meta.url));
  console.log(`Reading source image from: public/${expectedMenu.sourceImagePath}`);
  const imageBytes = await readFile(imagePath);

  console.log(`Sending image (${imageBytes.length} bytes) to Gemini 2.0 Flash (${GEMINI_MODEL})...`);
  const startTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: "You transcribe school lunch calendar images exactly into structured data. Do not infer ingredients, nutrition, allergens, or dietary properties. Treat vegetarian status as true only when the image explicitly marks the choice as vegetarian through its stated legend, symbol, or color key."
        }]
      },
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBytes.toString("base64")
              }
            },
            {
              text: `Transcribe the ${program.name} menu for ${expectedMenu.month}. Include every Monday–Friday date in the month. Mark closures as no-school with no choices. Preserve meal wording and punctuation. Put general daily offerings in dailyNote, not as dated choices.`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0.1
      }
    })
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const body = await response.json();
  if (!response.ok) {
    console.error(`❌ Gemini API Error (${response.status}):`, body.error?.message || JSON.stringify(body));
    process.exit(1);
  }

  const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error("❌ Gemini response did not contain text:", JSON.stringify(body));
    process.exit(1);
  }

  console.log(`\n✅ Gemini 2.0 response received in ${duration}s!\n`);

  let geminiMenu;
  try {
    geminiMenu = JSON.parse(rawText);
  } catch (err) {
    console.error("❌ Failed to parse Gemini JSON:", err.message);
    console.log(rawText);
    process.exit(1);
  }

  console.log(`Month: Gemini="${geminiMenu.month}" | Existing="${expectedMenu.month}"`);
  console.log(`Title: Gemini="${geminiMenu.title}" | Existing="${expectedMenu.title}"`);
  console.log(`Daily Note:`);
  console.log(`  Gemini:   "${geminiMenu.dailyNote}"`);
  console.log(`  Existing: "${expectedMenu.dailyNote}"\n`);

  console.log(`--- Daily Offerings Comparison ---`);
  const expectedDays = expectedMenu.days || [];
  const geminiDays = geminiMenu.days || [];

  let matches = 0;
  let totalDays = expectedDays.length;
  const discrepancies = [];

  for (const exp of expectedDays) {
    const gem = geminiDays.find((d) => d.date === exp.date);
    if (!gem) {
      discrepancies.push({ date: exp.date, type: "missing", detail: "Gemini did not return this date" });
      continue;
    }

    if (gem.status !== exp.status) {
      discrepancies.push({
        date: exp.date,
        type: "status_mismatch",
        detail: `Gemini=${gem.status} vs Existing=${exp.status}`
      });
      continue;
    }

    if (exp.status === "no-school") {
      matches++;
      console.log(`  [${exp.date}] ✅ No school (Matched)`);
      continue;
    }

    const expChoices = (exp.choices || []).map((c) => ({ name: c.name.trim().toLowerCase(), veg: c.vegetarian }));
    const gemChoices = (gem.choices || []).map((c) => ({ name: c.name.trim().toLowerCase(), veg: c.vegetarian }));

    const choiceNamesMatch =
      expChoices.length === gemChoices.length &&
      expChoices.every((ec) => gemChoices.some((gc) => gc.name.includes(ec.name.slice(0, 10)) || ec.name.includes(gc.name.slice(0, 10))));

    const vegMatch =
      expChoices.length === gemChoices.length &&
      expChoices.every((ec) => gemChoices.some((gc) => gc.veg === ec.veg));

    if (choiceNamesMatch && vegMatch) {
      matches++;
      console.log(`  [${exp.date}] ✅ ${exp.choices.length} choices (Matched)`);
      for (let i = 0; i < exp.choices.length; i++) {
        const ec = exp.choices[i];
        const gc = gem.choices[i] || {};
        console.log(`      - Existing: "${ec.name}" (veg: ${ec.vegetarian})`);
        console.log(`        Gemini:   "${gc.name}" (veg: ${gc.vegetarian})`);
      }
    } else {
      discrepancies.push({
        date: exp.date,
        type: "choices_mismatch",
        existing: exp.choices,
        gemini: gem.choices
      });
      console.log(`  [${exp.date}] ⚠️ Discrepancy:`);
      console.log(`      Existing choices:`, JSON.stringify(exp.choices));
      console.log(`      Gemini choices:  `, JSON.stringify(gem.choices));
    }
  }

  console.log(`\n======================================================`);
  console.log(`Summary: ${matches}/${totalDays} weekdays matched perfectly (${((matches / totalDays) * 100).toFixed(1)}%)`);
  if (discrepancies.length === 0) {
    console.log(`🎉 100% agreement between Gemini 2.0 Flash and verified extraction!`);
  } else {
    console.log(`⚠️ ${discrepancies.length} differences found:`);
    console.log(JSON.stringify(discrepancies, null, 2));
  }
  console.log(`======================================================\n`);
}

runComparison().catch((err) => {
  console.error("Comparison fatal error:", err);
  process.exit(1);
});
