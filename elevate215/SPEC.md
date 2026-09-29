# Elevate 215 — Live Financial Dashboard Spec

## Assumptions
- The firm's forecast workbook already maps QuickBooks codes to departments, so we load the workbook, not QuickBooks.
- Priya uploads the workbook monthly and whenever QuickBooks changes. Renée uploads the grant commitments file twice a year.

---

## Part 1 — Financials upload

### What it does
Priya uploads the firm's forecast workbook, and the dashboard saves its numbers as a new dated version.

### Inputs
One Excel file: the forecast workbook, with 9 departments down the side and months across, showing budget, actual and forecast.

### Outputs
A saved version with one row per department per month, holding budget, actual and forecast. If the file is broken, nothing is saved and an error names the problem.

### Done when
Can Priya successfully upload the forecast workbook? **Yes / No**
