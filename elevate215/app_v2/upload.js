/**
 * The backend's front door: read an uploaded .xlsx, and if it's fine, save it as a new version.
 * A broken file is not saved; the result says why.
 */
import path from 'node:path';
import { UploadError } from './read/excel.js';
import { readForecast } from './read/forecast.js';
import { readCommitments } from './read/commitments.js';
import { createCsvStore } from './save/csv-store.js';

/** Columns saved for each part, and what each one holds. */
const FORECAST_COLUMNS = /** @type {const} */ ({
	department: 'text', month: 'text', budget: 'amount', actual: 'amount', forecast: 'amount'
});
const COMMITMENT_COLUMNS = /** @type {const} */ ({
	grant_name: 'text', funder: 'text', department: 'text', restricted: 'yesno', month: 'text', committed: 'amount'
});

/**
 * @typedef {{ uploadedBy: string, filename: string }} UploadInfo
 * @typedef {{ saved: true, id: number, rowCount: number } | { saved: false, reason: string }} UploadResult
 */

/**
 * @param {string} [storageFolder]  where versions are saved (tests pass a temp folder)
 */
export function createUploads(storageFolder = 'storage') {
	const forecastStore = createCsvStore(path.join(storageFolder, 'forecast'), FORECAST_COLUMNS);
	const commitmentsStore = createCsvStore(path.join(storageFolder, 'commitments'), COMMITMENT_COLUMNS);

	return {
		/** @param {Buffer | ArrayBuffer} file  @param {UploadInfo} info */
		uploadForecast: (file, info) => upload(readForecast, forecastStore, file, info),
		/** @param {Buffer | ArrayBuffer} file  @param {UploadInfo} info */
		uploadCommitments: (file, info) => upload(readCommitments, commitmentsStore, file, info),
		forecastStore,
		commitmentsStore
	};
}

/**
 * @param {(file: Buffer | ArrayBuffer) => Promise<Record<string, unknown>[]>} read
 * @param {ReturnType<typeof createCsvStore>} store
 * @param {Buffer | ArrayBuffer} file
 * @param {UploadInfo} info
 * @returns {Promise<UploadResult>}
 */
async function upload(read, store, file, info) {
	let rows;
	try {
		rows = await read(file);
	} catch (err) {
		if (err instanceof UploadError) return { saved: false, reason: err.message };
		throw err; // not the file's fault (a bug), so don't hide it
	}
	const { id, rowCount } = await store.saveVersion(rows, info);
	return { saved: true, id, rowCount };
}
