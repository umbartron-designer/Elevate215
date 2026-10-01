/**
 * Read the firm's forecast workbook into one row per department per month.
 *
 * Expected layout, first sheet (confirm with Priya):
 *
 *   Row 1:              | Jul 2025                  | Aug 2025                  | ...
 *   Row 2:  Department  | Budget | Actual | Forecast | Budget | Actual | Forecast | ...
 *   Row 3+: Dept name   | 25000  | 24310  | 25000    | 25000  |        | 25000    | ...
 *
 * Month labels may be merged across their three columns. Blank amounts are allowed
 * (e.g. Actual for a month that hasn't closed). Blank rows and "Total" rows are skipped.
 *
 * Any problem throws a WorkbookError on the spot, so a bad file is never half-read.
 */
import ExcelJS from 'exceljs';

export const EXPECTED_DEPARTMENTS = 9;
const MEASURES = ['budget', 'actual', 'forecast'];
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_MONTH_NAMES = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

/** The workbook can't be loaded. The message is shown to the uploader. */
export class WorkbookError extends Error {
	name = 'WorkbookError';
}

/**
 * @typedef {{ department: string, month: string, budget: number|null, actual: number|null, forecast: number|null }} FinancialRow
 */

/**
 * @param {ArrayBuffer | Buffer} data  the uploaded .xlsx file
 * @returns {Promise<FinancialRow[]>}
 */
export async function readWorkbook(data) {
	const wb = new ExcelJS.Workbook();
	try {
		await wb.xlsx.load(data);
	} catch {
		throw new WorkbookError('This is not a readable .xlsx file.');
	}

	const sheet = wb.worksheets[0];
	if (!sheet) throw new WorkbookError('The workbook has no sheets.');

	const columns = readHeader(sheet);
	const months = [...columns.keys()];

	/** @type {Map<string, Record<string, number|null>[]>} department -> one entry per month */
	const departments = new Map();
	/** @type {Map<string, number>} department -> row it first appeared on */
	const seenOn = new Map();

	for (let r = 3; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const name = text(cellValue(row.getCell(1)));
		const amountCells = [...columns.values()].flatMap((c) => MEASURES.map((m) => row.getCell(c[m])));
		const hasAmounts = amountCells.some((c) => !isBlank(cellValue(c)));

		if (!name && !hasAmounts) continue;
		if (/^total\b/i.test(name)) continue;
		if (!name) throw new WorkbookError(`Row ${r}: department name is missing.`);
		if (seenOn.has(name)) {
			throw new WorkbookError(`Row ${r}: ${name} already appears on row ${seenOn.get(name)}.`);
		}
		seenOn.set(name, r);

		departments.set(
			name,
			months.map((month) => {
				const cols = /** @type {Record<string, number>} */ (columns.get(month));
				return Object.fromEntries(MEASURES.map((m) => [m, readAmount(row.getCell(cols[m]))]));
			})
		);
	}

	if (departments.size !== EXPECTED_DEPARTMENTS) {
		throw new WorkbookError(
			`Expected ${EXPECTED_DEPARTMENTS} departments, found ${departments.size}.`
		);
	}

	return [...departments].flatMap(([department, amounts]) =>
		months.map((month, i) => ({
			department,
			month,
			budget: amounts[i].budget,
			actual: amounts[i].actual,
			forecast: amounts[i].forecast
		}))
	);
}

/**
 * Read rows 1–2 into month -> { budget: col, actual: col, forecast: col }, in sheet order.
 * @param {import('exceljs').Worksheet} sheet
 */
function readHeader(sheet) {
	const monthRow = sheet.getRow(1);
	const measureRow = sheet.getRow(2);

	if (text(cellValue(measureRow.getCell(1))).toLowerCase() !== 'department') {
		throw new WorkbookError('Cell A2 must say "Department".');
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
		if (!isBlank(label)) month = parseMonth(label, monthCell.address);
		if (!month) throw new WorkbookError(`Cell ${monthCell.address}: month label is missing.`);
		if (!MEASURES.includes(measure)) {
			throw new WorkbookError(
				`Cell ${measureCell.address}: must be Budget, Actual or Forecast, not "${text(cellValue(measureCell))}".`
			);
		}

		const cols = columns.get(month) ?? {};
		if (cols[measure]) {
			throw new WorkbookError(`Cell ${measureCell.address}: ${monthLabel(month)} already has a ${title(measure)} column.`);
		}
		cols[measure] = c;
		columns.set(month, cols);
	}

	if (columns.size === 0) {
		throw new WorkbookError('Row 1 must list the months, starting in column B.');
	}
	for (const [m, cols] of columns) {
		const missing = MEASURES.filter((x) => !cols[x]).map(title);
		if (missing.length) {
			throw new WorkbookError(`${monthLabel(m)} is missing its ${missing.join(', ')} column.`);
		}
	}
	return columns;
}

// The helpers below are exported so commitments.js can read its file the same way.

/**
 * Turn a month header into "YYYY-MM". Accepts real dates, "Jul 2025", "July 2025",
 * "Jul-25", "2025-07" and "07/2025".
 * @param {unknown} value
 * @param {string} address
 */
export function parseMonth(value, address) {
	if (value instanceof Date && !isNaN(value.getTime())) {
		return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
	}
	const s = text(value).toLowerCase();
	let m;
	if ((m = s.match(/^([a-z]+)[\s\-']+(\d{2}|\d{4})$/))) {
		const i = MONTH_NAMES.indexOf(m[1].slice(0, 3));
		const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
		if (i >= 0 && (m[1].length === 3 || m[1] === 'sept' || FULL_MONTH_NAMES[i] === m[1])) {
			return `${year}-${pad(i + 1)}`;
		}
	}
	if ((m = s.match(/^(\d{4})-(\d{1,2})$/)) && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
		return `${m[1]}-${pad(Number(m[2]))}`;
	}
	if ((m = s.match(/^(\d{1,2})\/(\d{4})$/)) && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
		return `${m[2]}-${pad(Number(m[1]))}`;
	}
	throw new WorkbookError(`Cell ${address}: "${text(value)}" is not a month.`);
}

/**
 * Turn one cell into a dollar amount rounded to cents, or null if blank.
 * Accepts numbers and text like "$1,250.00" or "(1,250.00)".
 * @param {import('exceljs').Cell} cell
 */
export function readAmount(cell) {
	const value = cellValue(cell);
	if (isBlank(value)) return null;
	if (typeof value === 'number') return round(value);

	let s = text(value).replace(/[$,\s]/g, '');
	const negative = /^\(.*\)$/.test(s);
	if (negative) s = s.slice(1, -1);
	const n = s === '' ? NaN : Number(s);
	if (!Number.isFinite(n)) {
		throw new WorkbookError(`Cell ${cell.address}: "${text(value)}" is not a number.`);
	}
	return round(negative ? -n : n);
}

/**
 * The plain value of a cell: unwraps formulas, rich text and hyperlinks; errors throw.
 * @param {import('exceljs').Cell} cell
 * @returns {unknown}
 */
export function cellValue(cell) {
	let v = cell.value;
	if (v && typeof v === 'object' && 'result' in v) v = /** @type {any} */ (v.result);
	if (v && typeof v === 'object' && !(v instanceof Date)) {
		if ('error' in v) throw new WorkbookError(`Cell ${cell.address}: contains the error ${v.error}.`);
		if ('formula' in v || 'sharedFormula' in v) return null;
		if ('richText' in v) return v.richText.map((t) => t.text).join('');
		if ('text' in v) return v.text;
	}
	return v;
}

/** @param {unknown} v */
export const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
/** @param {unknown} v */
export const text = (v) => (isBlank(v) ? '' : String(v).trim());
/** @param {number} n */
const round = (n) => Math.round(n * 100) / 100;
/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');
/** @param {string} s */
const title = (s) => s[0].toUpperCase() + s.slice(1);
/** @param {string} ym "YYYY-MM" */
const monthLabel = (ym) => `${title(MONTH_NAMES[Number(ym.slice(5)) - 1])} ${ym.slice(0, 4)}`;
