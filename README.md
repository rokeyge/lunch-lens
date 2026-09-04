# Lunchbox SMFC

An unofficial, readable view of the San Mateo–Foster City School District elementary lunch menu.

## Local development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

The school, Week/Month view, selected week, and vegetarian filter are stored only in the browser's local storage. There is no account or backend.

## GitHub Pages

The repository includes a GitHub Actions workflow that builds and publishes the static site whenever `main` is updated.

1. Push this directory to a GitHub repository using `main` as its default branch.
2. Open **Settings → Pages** in that repository.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Push a change or run the **Deploy to GitHub Pages** workflow manually.

Build the Pages artifact locally with:

```bash
npm run build
```

The output is written to `dist/`.
