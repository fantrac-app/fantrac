# FanTrac (prototype) — DEMO, fake data only
Private incident log for game officials and school/league admins. Installable offline PWA; data stays on the device (IndexedDB). No backend, no accounts.

    npm ci && npm run build && npm run preview   # http://127.0.0.1:4321/fantrac/
    npx playwright test                           # Chromium + WebKit e2e
    node scripts/screenshots.mjs                  # with preview running

## Hosting (GitHub Pages)
`.github/workflows/pages.yml` builds and deploys on push to `main`. In the repo: Settings → Pages → Source: **GitHub Actions**.
The base path defaults to `/fantrac/` (repo named `fantrac`). If the repo has a different name, set a repository variable `BASE_PATH` (e.g. `/other-name/`). The org name does not affect the path.
