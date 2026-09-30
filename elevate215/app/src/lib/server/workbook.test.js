import { describe, expect, it } from 'vitest';
import { readWorkbook } from './workbook.js';
import { buildSample, DEPARTMENTS } from '../../../scripts/make-sample.js';

/** @param {import('exceljs').Workbook} wb */
const toBuffer = async (wb) => /** @type {Buffer} */ (await wb.xlsx.writeBuffer());

describe('readWorkbook', () => {
	it('reads the sample into one row per department per month', async () => {
		const rows = await readWorkbook(await toBuffer(buildSample()));
		expect(rows).toHaveLength(9 * 12);
		expect(rows[0]).toEqual({
			department: 'Department 1',
			month: '2025-07',
			budget: expect.any(Number),
			actual: expect.any(Number),
			forecast: expect.any(Number)
		});
		expect(Object.keys(rows[0])).toEqual(['department', 'month', 'budget', 'actual', 'forecast']);
		expect(rows.find((r) => r.month === '2026-06')?.actual).toBeNull();
	});

	it('skips blank and Total rows', async () => {
		const wb = buildSample();
		wb.worksheets[0].getCell(13, 1).value = 'Total';
		wb.worksheets[0].getCell(13, 2).value = 999;
		expect(await readWorkbook(await toBuffer(wb))).toHaveLength(108);
	});

	it('rejects a file that is not an xlsx', async () => {
		await expect(readWorkbook(Buffer.from('not a workbook'))).rejects.toThrow('This is not a readable .xlsx file.');
	});

	it('rejects the wrong number of departments', async () => {
		const wb = buildSample({ departments: DEPARTMENTS.slice(0, 8) });
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow('Expected 9 departments, found 8.');
	});

	it('rejects a duplicate department', async () => {
		const wb = buildSample({ departments: [...DEPARTMENTS.slice(0, 8), 'Department 1'] });
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow('Row 11: Department 1 already appears on row 3.');
	});

	it('rejects a month missing its Forecast column', async () => {
		const wb = buildSample();
		wb.worksheets[0].getCell(2, 4).value = 'Budget';
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow('Cell D2: Jul 2025 already has a Budget column.');
	});

	it('rejects an unknown measure', async () => {
		const wb = buildSample();
		wb.worksheets[0].getCell(2, 4).value = 'Variance';
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow(
			'Cell D2: must be Budget, Actual or Forecast, not "Variance".'
		);
	});

	it('rejects a bad month header', async () => {
		const wb = buildSample();
		wb.worksheets[0].unMergeCells(1, 5, 1, 7);
		wb.worksheets[0].getCell(1, 5).value = 'Q3';
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow('Cell E1: "Q3" is not a month.');
	});

	it('accepts text month headers and text amounts', async () => {
		const wb = buildSample();
		const ws = wb.worksheets[0];
		ws.unMergeCells(1, 2, 1, 4);
		ws.getCell(1, 2).value = 'July 2025';
		ws.getCell(3, 2).value = '$1,250.50';
		ws.getCell(3, 3).value = '(100)';
		const rows = await readWorkbook(await toBuffer(wb));
		expect(rows[0]).toMatchObject({ month: '2025-07', budget: 1250.5, actual: -100 });
	});

	it('rejects text in an amount cell', async () => {
		const wb = buildSample();
		wb.worksheets[0].getCell(5, 3).value = 'TBD';
		await expect(readWorkbook(await toBuffer(wb))).rejects.toThrow('Cell C5: "TBD" is not a number.');
	});
});
