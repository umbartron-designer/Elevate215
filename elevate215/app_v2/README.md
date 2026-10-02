# app_v2: Elevate 215 uploads (backend)

Built from [SPEC_v1_v2.md](../SPEC_v1_v2.md). Reads the forecast workbook and the grant commitments file (.xlsx), saves each upload as a new version, and rejects broken files with a reason.

## Files

| File / folder | What it is |
|---|---|
| `package.json` | Project settings: the libraries this app needs (`exceljs`, `vitest`) and the `npm test` command. Node requires this exact name. |
| `upload.js` | The front door. `uploadForecast` and `uploadCommitments` read a file and save it, or return why it's broken. |
| `read/excel.js` | Shared Excel helpers used by both readers: open a file, read a cell, a month or an amount. |
| `read/forecast.js` | Turns the forecast workbook into one row per department per month. |
| `read/commitments.js` | Turns the commitments file into one row per grant per month. |
| `save/csv-store.js` | Saves rows as numbered versions in CSV files and reads them back. |
| `mock-data/` | Fake files for the tests: a good forecast (9 departments × 12 months), a good commitments file (5 grants × 12 months), and `xlsx.js`, which turns them into real .xlsx files in memory. |
| `tests/` | Checks the spec's "Done when": good files save and read back, broken files are rejected with a reason. |
| `storage/` | Where real uploads get saved. Created on first upload. Kept off GitHub. |

## Run the tests

```
cd elevate215/app_v2
npm install     # downloads the libraries listed in package.json (one time)
npm test        # runs everything in tests/
```
