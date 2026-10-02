import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { forecastGrid } from '../mock-data/forecast.js';
import { commitmentsGrid } from '../mock-data/commitments.js';
import { toXlsx } from '../mock-data/xlsx.js';
import { tipFor } from '../src/lib/tips.js';

/** @type {string} */
let folder;
/** @type {typeof import('../src/routes/+page.server.js')} */
let page;
/** @type {typeof import('../src/routes/download/[kind]/[id]/+server.js')} */
let download;

// Fresh storage folder for every test. The website's backend is created when its
// files are first loaded, so load them again after pointing STORAGE_DIR at the new folder.
beforeEach(async () => {
	folder = await fs.mkdtemp(path.join(os.tmpdir(), 'page-test-'));
	process.env.STORAGE_DIR = folder;
	vi.resetModules();
	page = await import('../src/routes/+page.server.js');
	download = await import('../src/routes/download/[kind]/[id]/+server.js');
});
afterEach(async () => {
	delete process.env.STORAGE_DIR;
	await fs.rm(folder, { recursive: true, force: true });
});

/**
 * Send the upload form the way the browser does.
 * @param {string} kind
 * @param {Buffer | null} file
 * @param {string} name
 * @param {string} [filename]
 */
async function submit(kind, file, name, filename = `${kind}.xlsx`) {
	const form = new FormData();
	form.set('kind', kind);
	if (file) form.set('file', new File([file], filename));
	form.set('name', name);
	const request = new Request('http://localhost/?/upload', { method: 'POST', body: form });
	return page.actions.upload(/** @type {any} */ ({ request }));
}

describe('Part 1: upload page', () => {
	test('good forecast is saved as version 1 with 108 rows', async () => {
		const result = await submit('forecast', await toXlsx(forecastGrid()), 'Priya');
		expect(result).toEqual({ kind: 'forecast', saved: true, id: 1, rowCount: 108 });
	});

	test('good commitments file is saved as version 1 with 60 rows', async () => {
		const result = await submit('commitments', await toXlsx(commitmentsGrid()), 'Renée');
		expect(result).toEqual({ kind: 'commitments', saved: true, id: 1, rowCount: 60 });
	});

	test('broken forecast is rejected with the reason, and nothing is saved', async () => {
		const grid = forecastGrid();
		grid.pop();
		const result = await submit('forecast', await toXlsx(grid), 'Priya');
		expect(result).toMatchObject({
			status: 400,
			data: { kind: 'forecast', saved: false, type: 'count', reason: 'Expected 9 departments, found 8.' }
		});
		expect((await page.load()).forecast).toEqual([]);
	});

	test('broken commitments file is rejected with the reason, and nothing is saved', async () => {
		const grid = commitmentsGrid();
		grid[1][3] = 'Maybe';
		const result = await submit('commitments', await toXlsx(grid), 'Renée');
		expect(result).toMatchObject({
			status: 400,
			data: { saved: false, type: 'cell', reason: 'Cell D2: Restricted must be Yes or No, not "Maybe".' }
		});
		expect((await page.load()).commitments).toEqual([]);
	});

	test('upload without a name is rejected', async () => {
		const result = await submit('forecast', await toXlsx(forecastGrid()), '  ');
		expect(result).toMatchObject({ status: 400, data: { saved: false, type: 'missing' } });
	});

	test('every kind of problem has a "What to do" tip on both tabs', () => {
		for (const kind of /** @type {const} */ (['forecast', 'commitments'])) {
			for (const type of ['unreadable', 'header', 'cell', 'duplicate', 'count', 'missing']) {
				expect(tipFor(kind, type)).toMatch(/\w/);
			}
		}
	});
});

describe('Part 2: version history', () => {
	test('lists versions newest first, with who, file, rows and date', async () => {
		await submit('forecast', await toXlsx(forecastGrid()), 'Priya', 'october.xlsx');
		await submit('forecast', await toXlsx(forecastGrid()), 'Priya', 'november.xlsx');

		const { forecast } = await page.load();
		expect(forecast.map((v) => v.id)).toEqual([2, 1]);
		expect(forecast[0]).toMatchObject({ uploadedBy: 'Priya', filename: 'november.xlsx', rowCount: 108 });
		expect(forecast[0].date).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/); // e.g. "Oct 2, 2026"
	});

	test('Download gives back the exact file that was uploaded', async () => {
		const file = await toXlsx(commitmentsGrid());
		await submit('commitments', file, 'Renée', 'grants fall.xlsx');

		const response = await download.GET({ params: { kind: 'commitments', id: '1' } });
		expect(Buffer.from(await response.arrayBuffer())).toEqual(file);
		expect(response.headers.get('content-disposition')).toContain('filename="grants fall.xlsx"');
	});

	test('Download of a version that does not exist is "not found"', async () => {
		await expect(download.GET({ params: { kind: 'forecast', id: '9' } })).rejects.toMatchObject({ status: 404 });
	});
});
