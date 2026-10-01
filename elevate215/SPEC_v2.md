# Elevate 215 — Live Financial Dashboard Spec

## Assumptions
- Renée owns the grant commitments file and uploads it twice a year, when grants go out.
- The grant commitments file uses the same 9 department names as the forecast workbook, so the two can be lined up by department and month later.

---

## Part 2 — Grant commitments upload

### What it does
Renée uploads the grant commitments file, and the dashboard saves its numbers as a new dated version.

### Inputs
One Excel file: the grant commitments file, with one grant per row, showing its funder, department and whether it is restricted, and the amount committed in each month across.

### Outputs
A saved version with one row per grant per month, holding its funder, department, whether it is restricted, and the committed amount. If the file is broken, nothing is saved and an error names the problem.

### Done when
When the code can save the file.
