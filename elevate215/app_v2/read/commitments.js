/**
 * Read Renée's grant commitments file into one row per grant per month.
 *
 * Expected layout, first sheet:
 *
 *   Row 1:   Grant      | Funder      | Department | Restricted | Jul 2025 | Aug 2025 | ...
 *   Row 2+:  Grant name | Funder name | Dept name  | Yes        | 5000     |          | ...
 *
 * A blank amount means nothing is committed that month.
 * Blank rows and "Total" rows are skipped. Any problem throws an UploadError.
 */
import { cellValue, isBlank, openFirstSheet, parseMonth, readAmount, text, UploadError } from './excel.js';

/** The four label columns, A to D, in order. Months start in column E. */
const LABEL_HEADERS = ['Grant', 'Funder', 'Department', 'Restricted'];
const FIRST_MONTH_COL = LABEL_HEADERS.length + 1;

/**
 * "grant_name" instead of "grant" because GRANT is a reserved word in databases.
 * @typedef {{
 *   grant_name: string, funder: string, department: string,
 *   restricted: boolean, month: string, committed: number|null
 * }} CommitmentRow
 */

/**
 * @param {Buffer | ArrayBuffer} file  the .xlsx file
 * @returns {Promise<CommitmentRow[]>}
 */
export async function readCommitments(file) {
	const sheet = await openFirstSheet(file);
	const headerRow = sheet.getRow(1);

	LABEL_HEADERS.forEach((expected, i) => {
		const cell = headerRow.getCell(i + 1);
		if (text(cellValue(cell)).toLowerCase() !== expected.toLowerCase()) {
			throw new UploadError(`Cell ${cell.address} must say "${expected}".`);
		}
	});

	/** @type {{ col: number, month: string }[]} */
	const monthColumns = [];
	for (let c = FIRST_MONTH_COL; c <= sheet.columnCount; c++) {
		const cell = headerRow.getCell(c);
		const label = cellValue(cell);
		if (isBlank(label)) break; // end of the month columns
		monthColumns.push({ col: c, month: parseMonth(label, cell.address) });
	}
	if (monthColumns.length === 0) throw new UploadError('Row 1 must list the months, starting in column E.');

	/** @type {CommitmentRow[]} */
	const rows = [];
	/** @type {Map<string, number>} grant -> row it first appeared on */
	const seenOn = new Map();

	for (let r = 2; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const [grant, funder, department, restrictedText] = [1, 2, 3, 4].map((c) => text(cellValue(row.getCell(c))));

		const hasAnything =
			grant || funder || department || restrictedText ||
			monthColumns.some(({ col }) => !isBlank(cellValue(row.getCell(col))));
		if (!hasAnything) continue;
		if (/^total\b/i.test(grant)) continue;

		if (!grant) throw new UploadError(`Row ${r}: grant name is missing.`);
		if (!funder) throw new UploadError(`Row ${r}: funder is missing for ${grant}.`);
		if (!department) throw new UploadError(`Row ${r}: department is missing for ${grant}.`);

		const yesNo = restrictedText.toLowerCase();
		if (yesNo !== 'yes' && yesNo !== 'no') {
			throw new UploadError(`Cell ${row.getCell(4).address}: Restricted must be Yes or No, not "${restrictedText}".`);
		}

		// The same grant twice would double-count its money.
		if (seenOn.has(grant)) {
			throw new UploadError(`Row ${r}: ${grant} already appears on row ${seenOn.get(grant)}.`);
		}
		seenOn.set(grant, r);

		for (const { col, month } of monthColumns) {
			rows.push({
				grant_name: grant,
				funder,
				department,
				restricted: yesNo === 'yes',
				month,
				committed: readAmount(row.getCell(col))
			});
		}
	}

	if (seenOn.size === 0) throw new UploadError('The file has no grants in it.');
	return rows;
}
