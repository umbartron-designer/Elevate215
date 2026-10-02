/**
 * Read Priya's forecast workbook into one row per department per month.
 *
 * Expected layout, first sheet:
 *
 *   Row 1:              | Jul 2025                  | Aug 2025                  | ...
 *   Row 2:  Department  | Budget | Actual | Forecast | Budget | Actual | Forecast | ...
 *   Row 3+: Dept name   | 25000  | 24310  | 25000    | 25000  |        | 25000    | ...
 *
 * Blank amounts are allowed (e.g. Actual for a month that hasn't closed).
 * Blank rows and "Total" rows are skipped. Any problem throws an UploadError.
 */
import { cellValue, isBlank, openFirstSheet, parseMonth, readAmount, text, UploadError } from './excel.js';

export const EXPECTED_DEPARTMENTS = 9;
const MEASURES = ['budget', 'actual', 'forecast'];

/**
 * @typedef {{ department: string, month: string, budget: number|null, actual: number|null, forecast: number|null }} ForecastRow
 */

/**
 * @param {Buffer | ArrayBuffer} file  the .xlsx file
 * @returns {Promise<ForecastRow[]>}
 */
export async function readForecast(file) {
	const sheet = await openFirstSheet(file);
	const columns = readHeader(sheet);

	/** @type {ForecastRow[]} */
	const rows = [];
	/** @type {Map<string, number>} department -> row it first appeared on */
	const seenOn = new Map();

	for (let r = 3; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const department = text(cellValue(row.getCell(1)));
		const hasAmounts = [...columns.values()].some((cols) =>
			MEASURES.some((m) => !isBlank(cellValue(row.getCell(cols[m]))))
		);

		if (!department && !hasAmounts) continue;
		if (/^total\b/i.test(department)) continue;
		if (!department) throw new UploadError('cell', `Row ${r}: department name is missing.`);
		if (seenOn.has(department)) {
			throw new UploadError('duplicate', `Row ${r}: ${department} already appears on row ${seenOn.get(department)}.`);
		}
		seenOn.set(department, r);

		for (const [month, cols] of columns) {
			rows.push({
				department,
				month,
				budget: readAmount(row.getCell(cols.budget)),
				actual: readAmount(row.getCell(cols.actual)),
				forecast: readAmount(row.getCell(cols.forecast))
			});
		}
	}

	if (seenOn.size !== EXPECTED_DEPARTMENTS) {
		throw new UploadError('count', `Expected ${EXPECTED_DEPARTMENTS} departments, found ${seenOn.size}.`);
	}
	return rows;
}

/**
 * Read rows 1–2 into month -> { budget: col, actual: col, forecast: col }, in sheet order.
 * @param {import('exceljs').Worksheet} sheet
 */
function readHeader(sheet) {
	const monthRow = sheet.getRow(1);
	const measureRow = sheet.getRow(2);

	if (text(cellValue(measureRow.getCell(1))).toLowerCase() !== 'department') {
		throw new UploadError('header', 'Cell A2 must say "Department".');
	}

	/** @type {Map<string, Record<string, number>>} */
	const columns = new Map();
	let month = '';

	for (let c = 2; c <= sheet.columnCount; c++) {
		const monthCell = monthRow.getCell(c);
		const measureCell = measureRow.getCell(c);
		const label = cellValue(monthCell);
		const measure = text(cellValue(measureCell)).toLowerCase();

		if (isBlank(label) && !measure) break; // end of the month columns
		// A month label can be merged across its three columns, so a blank label means "same month".
		if (!isBlank(label)) month = parseMonth(label, monthCell.address);
		if (!month) throw new UploadError('header', `Cell ${monthCell.address}: month label is missing.`);
		if (!MEASURES.includes(measure)) {
			throw new UploadError('header',
				`Cell ${measureCell.address}: must be Budget, Actual or Forecast, not "${text(cellValue(measureCell))}".`
			);
		}

		const cols = columns.get(month) ?? {};
		if (cols[measure]) {
			throw new UploadError('header', `Cell ${measureCell.address}: ${month} already has a ${measure} column.`);
		}
		cols[measure] = c;
		columns.set(month, cols);
	}

	if (columns.size === 0) throw new UploadError('header', 'Row 1 must list the months, starting in column B.');
	for (const [m, cols] of columns) {
		const missing = MEASURES.filter((x) => !cols[x]);
		if (missing.length) throw new UploadError('header', `${m} is missing its ${missing.join(', ')} column.`);
	}
	return columns;
}
