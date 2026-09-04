# Lunchbox SMFC

An unofficial, readable view of the San Mateo–Foster City School District standard elementary lunch menu.

Live site: https://rokeyge.github.io/lunch-lens/

## Local development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Week/Month view, selected week, and the vegetarian filter are stored only in the browser's local storage. There is no account or application backend.

## Menu data

The website reads `src/data/current.json`. It contains the displayed month, source links, source-image hash, processing details, daily offerings, and one record for every weekday. Original menu images are retained under `public/menu-sources/`, and automated month archives are written under `src/data/menus/`.

Useful local checks:

```bash
npm run menu:discover
npm run menu:validate
npm test
npm run build
```

`menu:discover` checks the live district page without calling an LLM. `menu:update` requires `OPENAI_API_KEY`; it calls the Responses API with the menu image, validates the structured transcription, has a second independent pass compare it with the image, and retries once with the review discrepancies before failing closed.

The pipeline deliberately does not extract or infer allergens, ingredients, or nutrition. Vegetarian status is allowed only when the district image explicitly marks it through its legend, symbol, or color key.

## Automatic monthly updates

`.github/workflows/update-menu.yml` runs daily and can also be started manually. It:

1. Finds the newest standard elementary menu post and full-size lunch image.
2. Archives the original image and skips LLM processing when its hash has not changed.
3. Extracts strict JSON from the image.
4. Checks every weekday and meal record structurally.
5. Runs an independent image-versus-JSON review.
6. Writes the current file, month archive, and source image only after approval.
7. Commits the data and starts the Pages deployment.

Add the OpenAI API key as an Actions secret named `APIKEY` under **Repository settings → Secrets and variables → Actions → Secrets**. The workflow passes it to the updater without exposing it to the website. The default model is `gpt-5.5`; set an optional Actions variable named `OPENAI_MODEL` to override it.

## GitHub Pages

`.github/workflows/pages.yml` builds and publishes the static site whenever a normal commit reaches `main`, or when the menu updater dispatches it after an automated commit.

The production build is written to `dist/`:

```bash
npm run build
```
