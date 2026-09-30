/**
 * Build sample_forecast.xlsx for testing the upload. Department names and numbers are made up.
 * Run: npm run sample
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';

export const DEPARTMENTS = [
	'Department 1', 'Department 2', 'Department 3', 'Department 4', 'Department 5',
	'Department 6', 'Department 7', 'Department 8', 'Department 9'
];

/** Fiscal year July 2025 – June 2026, as real dates like the firm's workbook would use. */
export const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2025, 6 + i, 1)));

/** Months with closed books, so they have actuals. */
const CLOSED_MONTHS = 8;

/** A small seeded random number generator so the sample is the same every run. */
function seeded(seed) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 2 ** 32;
		return seed / 2 ** 32;
	};
}

/** @param {{ departments?: string[] }} [options] */
export function buildSample({ departments = DEPARTMENTS } = {}) {
	const random = seeded(215);
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Forecast');

	ws.getCell(2, 1).value = 'Department';
	MONTHS.forEach((month, i) => {
		const col = 2 + i * 3;
		ws.getCell(1, col).value = month;
		ws.getCell(1, col).numFmt = 'mmm yyyy';
		ws.mergeCells(1, col, 1, col + 2);
		['Budget', 'Actual', 'Forecast'].forEach((m, j) => (ws.getCell(2, col + j).value = m));
	});

	departments.forEach((name, d) => {
		const row = ws.getRow(3 + d);
		row.getCell(1).value = name;
		MONTHS.forEach((_, i) => {
			const col = 2 + i * 3;
			const budget = Math.round((10_000 + random() * 70_000) / 100) * 100;
			const actual = i < CLOSED_MONTHS ? Math.round(budget * (0.85 + random() * 0.25) * 100) / 100 : null;
			row.getCell(col).value = budget;
			row.getCell(col + 1).value = actual;
			row.getCell(col + 2).value = actual ?? budget;
		});
	});

	return wb;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await buildSample().xlsx.writeFile('sample_forecast.xlsx');
	console.log('Wrote sample_forecast.xlsx');
}
