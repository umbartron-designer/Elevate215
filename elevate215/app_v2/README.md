# app_v2: Elevate 215 uploads

Built from [SPEC_v1_v2.md](../SPEC_v1_v2.md) (backend) and [SPEC_v2_v2.md](../SPEC_v2_v2.md) (upload page).
Priya uploads the forecast workbook and Renée uploads grant commitments (.xlsx). Each upload is saved as a new version, broken files are rejected with a reason and a tip, and every version can be downloaded again.

## Backend (reading and saving)

| File / folder | What it is |
|---|---|
| `upload.js` | The front door. `uploadForecast` and `uploadCommitments` read a file and save it, or return why it's broken (a `type` and a `reason`). |
| `read/excel.js` | Shared Excel helpers used by both readers: open a file, read a cell, a month or an amount. Also defines `UploadError`, which carries the problem type: `unreadable`, `header`, `cell`, `duplicate` or `count`. |
| `read/forecast.js` | Turns the forecast workbook into one row per department per month. |
| `read/commitments.js` | Turns the commitments file into one row per grant per month. |
| `save/csv-store.js` | Saves each upload as a numbered version: the rows (`rows.csv`), an exact copy of the uploaded file (`original.xlsx`) and a line in `versions.csv` (who, when, file, row count). Reads them back too. |
| `storage/` | Where real uploads get saved. Created on first upload. Kept off GitHub. |

## Website (SvelteKit)

SvelteKit decides some names itself: website code lives in `src/`, pages live in `src/routes/`, files starting with `+` are special page files, and a folder in `[brackets]` is a part of the web address that changes.

| File / folder | What it is |
|---|---|
| `svelte.config.js` | SvelteKit settings: run the finished site as a normal Node server. Name required by SvelteKit. |
| `vite.config.js` | Turns SvelteKit on, and tells the test runner the tests are in `tests/`. Name required by Vite. |
| `src/app.html` | The outer HTML shell of every page. Loads the Atkinson Hyperlegible font. |
| `src/routes/+page.svelte` | The upload page: top bar, heading, and the two tabs (Forecast workbook, Grant commitments). |
| `src/routes/+page.server.js` | The page's server side. `load` fetches both version lists; `actions.upload` takes the submitted form and runs the backend. |
| `src/routes/download/[kind]/[id]/+server.js` | The Download button. `/download/forecast/3` sends back the original .xlsx of forecast version 3. |
| `src/lib/UploadPanel.svelte` | One upload card: drop zone, name, Upload button, the saved / rejected message, and the version history table. Used once per tab. |
| `src/lib/KindIcon.svelte` | The small icon for each tab: bars for the forecast, a page for grants. |
| `src/lib/tips.js` | The "What to do" tip for each kind of problem. |
| `src/lib/server/uploads.js` | The one shared copy of the backend that the website uses. Code in `server/` never reaches the browser. |

## Tests and mock data

| File / folder | What it is |
|---|---|
| `mock-data/` | Fake files for the tests: a good forecast (9 departments × 12 months), a good commitments file (5 grants × 12 months), and `xlsx.js`, which turns them into real .xlsx files in memory. |
| `tests/forecast.test.js`, `tests/commitments.test.js` | Backend checks: good files save and read back, broken files are rejected with the right type and reason, the original file is kept. |
| `tests/page.test.js` | Website checks: uploading through the page form, rejected uploads, tips, the version history and Download. |

## Other

| File | What it is |
|---|---|
| `package.json` | Project settings: the libraries this app needs and the commands below. Node requires this exact name. Its `overrides` section forces safe versions of `cookie` (inside SvelteKit) and `uuid` (inside exceljs) to fix `npm audit` warnings. |
| `package-lock.json` | The exact library versions `npm install` downloaded. Written by npm; don't edit it. |

## Commands

```
cd elevate215/app_v2
npm install     # downloads the libraries in package.json (again after package.json changes)
npm run dev     # starts the website at http://localhost:5173
npm test        # runs everything in tests/
```
