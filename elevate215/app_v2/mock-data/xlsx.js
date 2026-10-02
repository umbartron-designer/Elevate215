/**
 * Turn a grid (a list of rows, each a list of cell values) into an .xlsx file in memory.
 * Used by the mock data builders, so tests never need real files on disk.
 */
import ExcelJS from 'exceljs';

/**
 * @param {unknown[][]} grid
 * @returns {Promise<Buffer>}
 */
export async function toXlsx(grid) {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Sheet1');
	for (const row of grid) sheet.addRow(row);
	return Buffer.from(await workbook.xlsx.writeBuffer());
}
