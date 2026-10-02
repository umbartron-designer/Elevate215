# Elevate 215 — Uploads Spec

## Part 1 — Forecast workbook
Input: Priya uploads the forecast workbook (.xlsx).
Output: The program saves it as a new version, with one row per department per month holding budget, actual and forecast. A broken file is not saved and the program says why.
Done when: The backend is coded and tests that upload mock workbooks pass, both good ones (saved and readable) and broken ones (rejected with a reason).

## Part 2 — Grant commitments
Input: Renée uploads the grant commitments file (.xlsx).
Output: The program saves it as a new version, with one row per grant per month holding funder, department, restricted and amount. A broken file is not saved and the program says why.
Done when: The backend is coded and tests that upload mock commitment files pass, both good ones (saved and readable) and broken ones (rejected with a reason).
