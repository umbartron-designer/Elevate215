/**
 * Empty upload templates: just the header rows, in the exact layouts the readers expect
 * (see workbook.js and commitments.js). Same layout as scripts/make-sample.js.
 */
import ExcelJS from 'exceljs';

/** Fiscal year July 2025 – June 2026, as real dates like the firm's workbook uses. */
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2025, 6 + i, 1)));

/** Forecast workbook: months in row 1 (merged over 3 columns), Department + Budget/Actual/Forecast in row 2. */
export function buildForecastTemplate() {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Forecast');
	ws.getCell(2, 1).value = 'Department';
	ws.getColumn(1).width = 22;
	MONTHS.forEach((month, i) => {
		const col = 2 + i * 3;
		ws.getCell(1, col).value = month;
		ws.getCell(1, col).numFmt = 'mmm yyyy';
		ws.getCell(1, col).alignment = { horizontal: 'center' };
		ws.mergeCells(1, col, 1, col + 2);
		['Budget', 'Actual', 'Forecast'].forEach((m, j) => (ws.getCell(2, col + j).value = m));
	});
	ws.getRow(1).font = { bold: true };
	ws.getRow(2).font = { bold: true };
	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
	return wb;
}

/** Grant commitments: Grant, Funder, Department, Restricted, then one column per month, all in row 1. */
export function buildCommitmentsTemplate() {
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Commitments');
	['Grant', 'Funder', 'Department', 'Restricted'].forEach((h, i) => {
		ws.getCell(1, i + 1).value = h;
		ws.getColumn(i + 1).width = i === 3 ? 12 : 24;
	});
	MONTHS.forEach((month, i) => {
		const cell = ws.getCell(1, 5 + i);
		cell.value = month;
		cell.numFmt = 'mmm yyyy';
	});
	ws.getRow(1).font = { bold: true };
	ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
	return wb;
}

/**
 * Send a workbook as a file download.
 * @param {ExcelJS.Workbook} wb
 * @param {string} filename
 */
export async function xlsxResponse(wb, filename) {
	const body = await wb.xlsx.writeBuffer();
	return new Response(/** @type {ArrayBuffer} */ (body), {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
}
