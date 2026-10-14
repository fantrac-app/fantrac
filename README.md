# FanTrac (prototype) — DEMO, fake data only
Private incident log for game officials and school/league admins. Installable offline PWA; data stays on the device (IndexedDB). No backend, no accounts.

    npm ci && npm run build && npm run preview   # http://127.0.0.1:4321/fantrac/
    npx playwright test                           # Chromium + WebKit e2e
    node scripts/screenshots.mjs                  # with preview running

## Hosting (GitHub Pages)
`.github/workflows/pages.yml` builds and deploys on push to `main`. In the repo: Settings → Pages → Source: **GitHub Actions**.
The base path defaults to `/fantrac/` (repo named `fantrac`). If the repo has a different name, set a repository variable `BASE_PATH` (e.g. `/other-name/`). The org name does not affect the path.

## Features added (demo)
- **Admin ID scan** when recording a ban: photographs the back of a license and decodes the PDF417 barcode **on the device** with zxing-wasm (the `.wasm` file is bundled with the app, nothing goes to a server). Manual entry fallback. Keeps name, DOB, state, last 4 of ID + one-way hash. Consent/legal note shown.
- **Check-in**: scan an ID or type a name; an active, admin-approved ban shows "Banned – call admin, do not confront" and creates an admin alert.
- **Police report packet** PDF from an approved incident (details, fingerprint, photo, witnesses, audit trail, ID summary). The user shares or downloads it; nothing is sent automatically.
- **League-shared bans** (simulated on one device): set in Privacy tab (admin).
- Test fixture `tests/fixtures/fake-license-pdf417.png` is FAKE data (state "ZZ"); regenerate with `node scripts/make-test-barcode.mjs`.
