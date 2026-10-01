import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readCommitments } from './commitments.js';
import { buildCommitmentsSample, readSchoolNames } from '../../../scripts/make-commitments-sample.js';

/** @param {import('exceljs').Workbook} wb */
const toBuffer = async (wb) => /** @type {Buffer} */ (await wb.xlsx.writeBuffer());

// Fixed grant names so these tests don't depend on data/ (it's git-ignored and may be missing).
const GRANTS = Array.from({ length: 12 }, (_, i) => `School ${i + 1}`);
const sample = () => buildCommitmentsSample({ grants: GRANTS });

const ROLLUP_CSV = fileURLToPath(
	new URL(
		'../../../../data/Elevate215-School-Data - PHL School Performance Model.xlsx - School Rollup.csv',
		import.meta.url
	)
);

describe('readCommitments', () => {
	it('reads the sample into one row per grant per month', async () => {
		const rows = await readCommitments(await toBuffer(sample()));
		expect(rows).toHaveLength(12 * 12);
		expect(rows[0]).toEqual({
			grant_name: 'School 1',
			funder: expect.any(String),
			department: 'Department 1',
			restricted: expect.any(Boolean),
			month: '2025-07',
			committed: rows[0].committed === null ? null : expect.any(Number)
		});
		expect(Object.keys(rows[0])).toEqual(['grant_name', 'funder', 'department', 'restricted', 'month', 'committed']);
		expect(rows.at(-1)?.month).toBe('2026-06');
	});

	it('keeps a blank amount as null', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(2, 5).value = null;
		const rows = await readCommitments(await toBuffer(wb));
		expect(rows[0].committed).toBeNull();
	});

	it('skips blank and Total rows', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(15, 1).value = 'Total';
		wb.worksheets[0].getCell(15, 5).value = 999;
		expect(await readCommitments(await toBuffer(wb))).toHaveLength(144);
	});

	it('accepts text month headers and text amounts', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(1, 5).value = 'July 2025';
		wb.worksheets[0].getCell(2, 5).value = '$1,250.50';
		const rows = await readCommitments(await toBuffer(wb));
		expect(rows[0]).toMatchObject({ month: '2025-07', committed: 1250.5 });
	});

	it('rejects a file that is not an xlsx', async () => {
		await expect(readCommitments(Buffer.from('not a workbook'))).rejects.toThrow('This is not a readable .xlsx file.');
	});

	it('rejects a wrong header in A1–D1', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(1, 2).value = 'Donor';
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Cell B1 must say "Funder".');
	});

	it('rejects a file with no month columns', async () => {
		const wb = sample();
		wb.worksheets[0].spliceColumns(5, 12);
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow(
			'Row 1 must list the months, starting in column E.'
		);
	});

	it('rejects a bad month header', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(1, 6).value = 'Q3';
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Cell F1: "Q3" is not a month.');
	});

	it('rejects a missing grant name', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(3, 1).value = null;
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Row 3: grant name is missing.');
	});

	it('rejects a missing funder', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(3, 2).value = null;
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Row 3: funder is missing for School 2.');
	});

	it('rejects a missing department', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(3, 3).value = null;
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Row 3: department is missing for School 2.');
	});

	it('rejects a Restricted value that is not Yes or No', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(4, 4).value = 'Maybe';
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow(
			'Cell D4: Restricted must be Yes or No, not "Maybe".'
		);
	});

	it('rejects text in an amount cell', async () => {
		const wb = sample();
		wb.worksheets[0].getCell(5, 7).value = 'TBD';
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Cell G5: "TBD" is not a number.');
	});

	it('rejects a duplicate grant', async () => {
		const wb = buildCommitmentsSample({ grants: [...GRANTS.slice(0, 11), 'School 1'] });
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('Row 13: School 1 already appears on row 2.');
	});

	it('rejects a file with no grants', async () => {
		const wb = buildCommitmentsSample({ grants: [] });
		await expect(readCommitments(await toBuffer(wb))).rejects.toThrow('The file has no grants in it.');
	});
});

describe('readSchoolNames', () => {
	// Only runs when the real roll-up CSV is on this machine.
	it.skipIf(!fs.existsSync(ROLLUP_CSV))('reads the first 12 school names', () => {
		const names = readSchoolNames();
		expect(names).toHaveLength(12);
		expect(names[0]).toBe('AD PRIMA CS');
	});
});
