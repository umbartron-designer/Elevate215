import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createUploads } from '../upload.js';
import { forecastGrid } from '../mock-data/forecast.js';
import { toXlsx } from '../mock-data/xlsx.js';

/** @type {string} */
let folder;
/** @type {ReturnType<typeof createUploads>} */
let uploads;
const info = { uploadedBy: 'Priya', filename: 'forecast.xlsx' };

beforeEach(async () => {
	folder = await fs.mkdtemp(path.join(os.tmpdir(), 'forecast-test-'));
	uploads = createUploads(folder);
});
afterEach(() => fs.rm(folder, { recursive: true, force: true }));

describe('good forecast workbook', () => {
	test('is saved as version 1 with 108 rows', async () => {
		const result = await uploads.uploadForecast(await toXlsx(forecastGrid()), info);
		expect(result).toEqual({ saved: true, id: 1, rowCount: 108 });
	});

	test('can be read back', async () => {
		await uploads.uploadForecast(await toXlsx(forecastGrid()), info);

		const rows = await uploads.forecastStore.readVersion(1);
		expect(rows).toHaveLength(108);
		expect(rows[0]).toEqual({ department: 'Operations', month: '2025-07', budget: 10000, actual: 9750, forecast: 10000 });
		expect(rows[11].actual).toBeNull(); // Jun 2026 hasn't closed, so actual is blank

		const [version] = await uploads.forecastStore.listVersions();
		expect(version).toMatchObject({ id: 1, uploadedBy: 'Priya', filename: 'forecast.xlsx' });
	});

	test('saving again makes version 2 and leaves version 1 alone', async () => {
		await uploads.uploadForecast(await toXlsx(forecastGrid()), info);
		const before = await uploads.forecastStore.readVersion(1);

		const result = await uploads.uploadForecast(await toXlsx(forecastGrid()), info);
		expect(result).toMatchObject({ saved: true, id: 2 });
		expect(await uploads.forecastStore.readVersion(1)).toEqual(before);
	});
});

describe('broken forecast workbook is not saved and says why', () => {
	/**
	 * Upload a file, expect it rejected with this reason, and expect nothing saved.
	 * @param {Buffer} file
	 * @param {string} reason
	 */
	async function expectRejected(file, reason) {
		expect(await uploads.uploadForecast(file, info)).toEqual({ saved: false, reason });
		expect(await uploads.forecastStore.listVersions()).toEqual([]);
	}

	test('not an .xlsx file', async () => {
		await expectRejected(Buffer.from('just some text'), 'This is not a readable .xlsx file.');
	});

	test('only 8 departments', async () => {
		const grid = forecastGrid();
		grid.pop();
		await expectRejected(await toXlsx(grid), 'Expected 9 departments, found 8.');
	});

	test('same department twice', async () => {
		const grid = forecastGrid();
		grid[10] = [...grid[2]]; // row 11 becomes a copy of Operations on row 3
		await expectRejected(await toXlsx(grid), 'Row 11: Operations already appears on row 3.');
	});

	test('wrong header', async () => {
		const grid = forecastGrid();
		grid[1][0] = 'Dept';
		await expectRejected(await toXlsx(grid), 'Cell A2 must say "Department".');
	});

	test('text in an amount cell', async () => {
		const grid = forecastGrid();
		grid[2][1] = 'abc';
		await expectRejected(await toXlsx(grid), 'Cell B3: "abc" is not a number.');
	});
});
