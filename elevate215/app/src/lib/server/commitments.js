/**
 * Read Renée's grant commitments file into one row per grant per month.
 *
 * Expected layout, first sheet (ASSUMED, confirm with Renée):
 *
 *   Row 1:   Grant      | Funder     | Department   | Restricted | Jul 2025 | Aug 2025 | ...
 *   Row 2+:  Grant name | Funder name | Department 1 | Yes        | 5000     |          | ...
 *
 * Month headers can be real dates or text like "Jul 2025" (same rules as the forecast workbook).
 * A blank amount means nothing is committed that month and is saved as blank.
 * Blank rows and rows whose Grant starts with "Total" are skipped, like Part 1.
 *
 * Any problem throws a WorkbookError on the spot, so a bad file is never half-read.
 */
import ExcelJS from 'exceljs';
import { cellValue, isBlank, parseMonth, readAmount, text, WorkbookError } from './workbook.js';

/** The four label columns, A to D, in order. */
const LABEL_HEADERS = ['Grant', 'Funder', 'Department', 'Restricted'];
/** Months start in column E. */
const FIRST_MONTH_COL = LABEL_HEADERS.length + 1;

/**
 * @param {ArrayBuffer | Buffer} data  the uploaded .xlsx file
 * @returns {Promise<import('./store/index.js').CommitmentRow[]>}
 */
export async function readCommitments(data) {
	// 1. Open the file. If ExcelJS can't read it, it isn't a real .xlsx.
	const wb = new ExcelJS.Workbook();
	try {
		await wb.xlsx.load(data);
	} catch {
		throw new WorkbookError('This is not a readable .xlsx file.');
	}

	const sheet = wb.worksheets[0];
	if (!sheet) throw new WorkbookError('The workbook has no sheets.');

	// 2. Check the header row and find the month columns.
	const headerRow = sheet.getRow(1);
	LABEL_HEADERS.forEach((expected, i) => {
		const cell = headerRow.getCell(i + 1);
		if (text(cellValue(cell)).toLowerCase() !== expected.toLowerCase()) {
			throw new WorkbookError(`Cell ${cell.address} must say "${expected}".`);
		}
	});

	/** @type {{ col: number, month: string }[]} */
	const monthColumns = [];
	for (let c = FIRST_MONTH_COL; c <= sheet.columnCount; c++) {
		const cell = headerRow.getCell(c);
		const label = cellValue(cell);
		if (isBlank(label)) break; // first blank header = end of the month columns
		monthColumns.push({ col: c, month: parseMonth(label, cell.address) });
	}
	if (monthColumns.length === 0) {
		throw new WorkbookError('Row 1 must list the months, starting in column E.');
	}

	// 3. Read each grant row.
	/** @type {import('./store/index.js').CommitmentRow[]} */
	const rows = [];
	/** @type {Map<string, number>} grant -> row it first appeared on */
	const seenOn = new Map();

	for (let r = 2; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const grant = text(cellValue(row.getCell(1)));
		const funder = text(cellValue(row.getCell(2)));
		const department = text(cellValue(row.getCell(3)));
		const restrictedText = text(cellValue(row.getCell(4)));

		// Skip rows that are completely empty (labels and amounts).
		const hasAnything =
			grant || funder || department || restrictedText ||
			monthColumns.some(({ col }) => !isBlank(cellValue(row.getCell(col))));
		if (!hasAnything) continue;
		if (/^total\b/i.test(grant)) continue;

		// The label columns must all be filled in.
		if (!grant) throw new WorkbookError(`Row ${r}: grant name is missing.`);
		if (!funder) throw new WorkbookError(`Row ${r}: funder is missing for ${grant}.`);
		if (!department) throw new WorkbookError(`Row ${r}: department is missing for ${grant}.`);

		// Restricted must be Yes or No (any capitalization).
		const yesNo = restrictedText.toLowerCase();
		if (yesNo !== 'yes' && yesNo !== 'no') {
			throw new WorkbookError(
				`Cell ${row.getCell(4).address}: Restricted must be Yes or No, not "${restrictedText}".`
			);
		}
		const restricted = yesNo === 'yes';

		// The same grant twice would double-count its money.
		if (seenOn.has(grant)) {
			throw new WorkbookError(`Row ${r}: ${grant} already appears on row ${seenOn.get(grant)}.`);
		}
		seenOn.set(grant, r);

		// One output row per month. readAmount throws if a cell isn't a number.
		for (const { col, month } of monthColumns) {
			rows.push({
				grant_name: grant,
				funder,
				department,
				restricted,
				month,
				committed: readAmount(row.getCell(col))
			});
		}
	}

	if (seenOn.size === 0) throw new WorkbookError('The file has no grants in it.');
	return rows;
}
