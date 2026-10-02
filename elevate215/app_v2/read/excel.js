/**
 * Shared Excel helpers. Both read/forecast.js and read/commitments.js use these,
 * so each one is written only once.
 */
import ExcelJS from 'exceljs';

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_MONTH_NAMES = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];

/** The file is broken. The message says why and is shown to the person uploading. */
export class UploadError extends Error {
	name = 'UploadError';
}

/**
 * Open an .xlsx file and return its first sheet.
 * @param {Buffer | ArrayBuffer} file
 */
export async function openFirstSheet(file) {
	const workbook = new ExcelJS.Workbook();
	try {
		await workbook.xlsx.load(file);
	} catch {
		throw new UploadError('This is not a readable .xlsx file.');
	}
	const sheet = workbook.worksheets[0];
	if (!sheet) throw new UploadError('The workbook has no sheets.');
	return sheet;
}

/**
 * The plain value of a cell: unwraps formulas, styled text and links.
 * @param {import('exceljs').Cell} cell
 * @returns {unknown}
 */
export function cellValue(cell) {
	let v = cell.value;
	if (v && typeof v === 'object' && 'result' in v) v = /** @type {any} */ (v.result);
	if (v && typeof v === 'object' && !(v instanceof Date)) {
		if ('error' in v) throw new UploadError(`Cell ${cell.address}: contains the error ${v.error}.`);
		if ('formula' in v || 'sharedFormula' in v) return null; // formula with no saved result
		if ('richText' in v) return v.richText.map((t) => t.text).join('');
		if ('text' in v) return v.text;
	}
	return v;
}

/** @param {unknown} v */
export const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** @param {unknown} v */
export const text = (v) => (isBlank(v) ? '' : String(v).trim());

/**
 * Turn a month header into "YYYY-MM". Accepts real dates, "Jul 2025", "July 2025",
 * "Jul-25", "2025-07" and "07/2025".
 * @param {unknown} value
 * @param {string} address  cell address, used in the error message
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
	throw new UploadError(`Cell ${address}: "${text(value)}" is not a month.`);
}

/**
 * Turn a cell into a dollar amount rounded to cents, or null if blank.
 * Accepts numbers and text like "$1,250.00" or "(1,250.00)" (negative).
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
		throw new UploadError(`Cell ${cell.address}: "${text(value)}" is not a number.`);
	}
	return round(negative ? -n : n);
}

/** @param {number} n */
const round = (n) => Math.round(n * 100) / 100;
/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');
