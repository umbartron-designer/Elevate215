import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMMITMENTS_TABLE, createCsvStore, FINANCIALS_TABLE } from './csv.js';

/** @type {string} */
let dir;
beforeEach(async () => {
	dir = await fs.mkdtemp(path.join(os.tmpdir(), 'elevate215-store-'));
});
afterEach(async () => {
	await fs.rm(dir, { recursive: true, force: true });
});

describe('listVersions / readVersion', () => {
	it('returns [] before anything is saved, even with no storage folder', async () => {
		const store = createCsvStore(path.join(dir, 'does-not-exist'), FINANCIALS_TABLE);
		expect(await store.listVersions()).toEqual([]);
		expect(await store.readVersion(1)).toEqual([]);
	});

	it('lists versions newest first with uploader, filename and row count', async () => {
		const store = createCsvStore(dir, FINANCIALS_TABLE);
		const row = { department: 'Department 1', month: '2025-07', budget: 100, actual: null, forecast: 100 };
		await store.saveVersion([row], { uploadedBy: 'Priya', filename: 'first.xlsx' });
		await store.saveVersion([row, row], { uploadedBy: 'Smith, Jo', filename: 'second "final".xlsx' });

		const versions = await store.listVersions();
		expect(versions.map((v) => v.id)).toEqual([2, 1]);
		expect(versions[0]).toEqual({
			id: 2,
			uploadedAt: expect.any(String),
			uploadedBy: 'Smith, Jo',
			filename: 'second "final".xlsx',
			rowCount: 2
		});
		expect(versions[1].rowCount).toBe(1);
	});

	it('reads forecast rows back with numbers and blanks as number|null', async () => {
		const store = createCsvStore(dir, FINANCIALS_TABLE);
		const rows = [
			{ department: 'Dept, with comma', month: '2025-07', budget: 1250.5, actual: null, forecast: -20 }
		];
		const { id } = await store.saveVersion(rows, { uploadedBy: 'Priya', filename: 'f.xlsx' });
		expect(await store.readVersion(id)).toEqual(rows);
	});

	it('reads commitments back with restricted as a boolean', async () => {
		const store = createCsvStore(dir, COMMITMENTS_TABLE);
		const rows = [
			{ grant_name: 'A', funder: 'City Fund', department: 'Department 1', restricted: true, month: '2025-07', committed: 5000 },
			{ grant_name: 'B', funder: 'State', department: 'Department 2', restricted: false, month: '2025-07', committed: null }
		];
		const { id } = await store.saveVersion(rows, { uploadedBy: 'Renée', filename: 'c.xlsx' });
		expect(await store.readVersion(id)).toEqual(rows);
	});

	it('rejects an id that is not a whole number', async () => {
		const store = createCsvStore(dir, FINANCIALS_TABLE);
		for (const bad of [0, -1, 1.5, NaN, /** @type {any} */ ('../1')]) {
			await expect(store.readVersion(bad)).rejects.toThrow('Version id must be a whole number');
		}
	});
});
