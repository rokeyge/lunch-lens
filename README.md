# School Lunch SMFC

An unofficial, readable view of the San Mateo–Foster City School District lunch menus.

Live site: https://school-lunch.rokey.ge/

## Features

- **Complete District Coverage**:
  - Standard elementary schools
  - Bayside Academy (K–5)
  - District middle schools (Abbott, Borel, Bowditch, Bayside 6–8)
  - Special 6–8 programs (Fiesta Gardens, North Shoreview, Parkside)
  - Preschool (Turnbull Child Development Center)
- **School Selector**: Choosing a school switches the menu to the accurate district program, persists across visits, and updates the shareable `school` URL parameter.
- **Modern Mobile & Desktop Layout**:
  - Phone: Compact 5-day pill row with the selected day expanded below (zero horizontal scrolling!).
  - Desktop: Full 5-day week row side-by-side.
  - Automatically selects today (or the next school service day if today has no school).
  - Quick "Today" jump button.
- **Truthful Local Preferences**:
  - Selected school, vegetarian filter, and week/month view saved in `localStorage`.
  - Never traps parents on an old historical week.
- **Visible Freshness & Failure Handling**:
  - Freshness line with checked date and link to the archived district source image.
  - Clean warning banner if a future month is not yet published.
  - Fail-closed ingestion pipeline that never overwrites valid data on error.

## Local development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

## Menu pipeline

The website reads `src/data/current.json`. It maintains all district lunch programs for the active month, source links, source-image hashes, daily notes, and verified meal choices for every weekday. Original menu graphics are retained under `public/menu-sources/`, and automated month archives are written under `src/data/menus/`.

Useful local checks:

```bash
npm run menu:discover
npm run menu:validate
npm test
npm run build
```

`menu:discover` checks the live district page without calling an LLM. `menu:update` processes new or forced updates, downloads the source image, runs structured extraction, verifies via an independent review pass, and fails closed if anything fails validation.

The pipeline deliberately does not extract or infer allergens, ingredients, or nutrition. Vegetarian status is allowed only when the district image explicitly marks it through its legend, symbol, or color key.

## Automatic monthly updates

`.github/workflows/update-menu.yml` runs daily on schedule (`17 13 * * *`) and can also be triggered manually (`workflow_dispatch`). It:

1. Discovers the newest menu posts and lunch graphics across all district programs.
2. Archives the original graphics and skips LLM processing when hashes have not changed.
3. Extracts and verifies strict JSON only when updates are detected.
4. If ingestion fails, automatically opens or updates a GitHub issue for visibility.
5. When resolved, automatically closes the tracking issue.
6. Commits verified menus, archives images, and triggers GitHub Pages deployment.

Add your Gemini API key (Google AI Studio) as an Actions secret named `LUNCH_KEY` under **Repository settings → Secrets and variables → Actions → Secrets**.

## GitHub Pages

### Recovery and diagnostics

Programs publish independently: a failed program retains its previous menu while
successful programs are committed even if the batch exits with an error. The
deployment dispatch requires a successful commit. Only a successful full batch
can resolve the shared failure issue; a targeted success cannot clear it.

Before parsing, downloaded image bytes and source metadata are retained in
`.menu-state/` as JSON with a base64 image. Successful model calls are checkpointed
by the exact image, prompt, schema, and model configuration. A rerun reuses completed
calls; rejected reviews are retained for diagnosis but reviewed again. Changed
inputs invalidate checkpoints, and `force=true` bypasses them. Images are still
downloaded each run so edits at an existing URL can be detected.

Actions restores/saves these checkpoints with a branch-scoped cache, including
after pipeline failure. Caches may be evicted, so this saves API calls but is not
the durable source of published data. The `menu-diagnostics` artifact retains
source snapshots, model results, and per-program outcomes for 30 days. Neither
cache nor artifact contains the API key. Published data remains in Git.

Missing weekdays and empty service placeholders intentionally become `no-school`.
This is a menu availability convention, not independently verified attendance data.
The district publishes a [2026–27 school calendar](https://www.smfcsd.net/our-district/calendar),
but calendar ingestion is not implemented and program-specific applicability has
not been verified. The source menu remains authoritative for this application.

Tests in `tests/menu-state.test.mjs` simulate recovery and partial failure without
network access or Gemini quota. Run with `node --test tests/menu-state.test.mjs`.

`.github/workflows/pages.yml` builds and publishes the static site whenever a commit reaches `main`.

To choose the design for the whole site, set the repository Actions variable `SITE_DESIGN` to `playful` or `classic` under **Settings → Secrets and variables → Actions → Variables**. If it is unset, the playful design is used. After changing it, open **Actions → Deploy to GitHub Pages → Run workflow** to rebuild and publish the site. This is a site-wide build setting, not a URL parameter or a visitor preference.

Build the static output locally with:

```bash
npm run build
```

To preview the other design locally, run `VITE_SITE_DESIGN=classic npm run dev` (or use `playful`).
