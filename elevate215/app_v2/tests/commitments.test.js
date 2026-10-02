import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createUploads } from '../upload.js';
import { commitmentsGrid } from '../mock-data/commitments.js';
import { toXlsx } from '../mock-data/xlsx.js';

/** @type {string} */
let folder;
/** @type {ReturnType<typeof createUploads>} */
let uploads;
const info = { uploadedBy: 'Renée', filename: 'commitments.xlsx' };

beforeEach(async () => {
	folder = await fs.mkdtemp(path.join(os.tmpdir(), 'commitments-test-'));
	uploads = createUploads(folder);
});
afterEach(() => fs.rm(folder, { recursive: true, force: true }));

describe('good commitments file', () => {
	test('is saved as version 1 with 60 rows', async () => {
		const result = await uploads.uploadCommitments(await toXlsx(commitmentsGrid()), info);
		expect(result).toEqual({ saved: true, id: 1, rowCount: 60 });
	});

	test('can be read back', async () => {
		await uploads.uploadCommitments(await toXlsx(commitmentsGrid()), info);

		const rows = await uploads.commitmentsStore.readVersion(1);
		expect(rows).toHaveLength(60);
		expect(rows[1]).toEqual({
			grant_name: 'Youth Jobs', funder: 'City Fund', department: 'Youth Services',
			restricted: true, month: '2025-08', committed: 5000
		});
		expect(rows[0].committed).toBeNull(); // nothing committed that month
		expect(rows[24].restricted).toBe(false); // General Support is unrestricted

		const [version] = await uploads.commitmentsStore.listVersions();
		expect(version).toMatchObject({ id: 1, uploadedBy: 'Renée', filename: 'commitments.xlsx' });
	});

	test('saving again makes version 2 and leaves version 1 alone', async () => {
		await uploads.uploadCommitments(await toXlsx(commitmentsGrid()), info);
		const before = await uploads.commitmentsStore.readVersion(1);

		const result = await uploads.uploadCommitments(await toXlsx(commitmentsGrid()), info);
		expect(result).toMatchObject({ saved: true, id: 2 });
		expect(await uploads.commitmentsStore.readVersion(1)).toEqual(before);
	});
});

describe('broken commitments file is not saved and says why', () => {
	/**
	 * Upload a file, expect it rejected with this reason, and expect nothing saved.
	 * @param {Buffer} file
	 * @param {string} reason
	 */
	async function expectRejected(file, reason) {
		expect(await uploads.uploadCommitments(file, info)).toEqual({ saved: false, reason });
		expect(await uploads.commitmentsStore.listVersions()).toEqual([]);
	}

	test('not an .xlsx file', async () => {
		await expectRejected(Buffer.from('just some text'), 'This is not a readable .xlsx file.');
	});

	test('same grant twice', async () => {
		const grid = commitmentsGrid();
		grid[5][0] = 'Youth Jobs'; // row 6 now repeats the grant on row 2
		await expectRejected(await toXlsx(grid), 'Row 6: Youth Jobs already appears on row 2.');
	});

	test('wrong header', async () => {
		const grid = commitmentsGrid();
		grid[0][1] = 'Funders';
		await expectRejected(await toXlsx(grid), 'Cell B1 must say "Funder".');
	});

	test('Restricted is not Yes or No', async () => {
		const grid = commitmentsGrid();
		grid[1][3] = 'Maybe';
		await expectRejected(await toXlsx(grid), 'Cell D2: Restricted must be Yes or No, not "Maybe".');
	});

	test('text in an amount cell', async () => {
		const grid = commitmentsGrid();
		grid[1][5] = 'abc';
		await expectRejected(await toXlsx(grid), 'Cell F2: "abc" is not a number.');
	});
});
