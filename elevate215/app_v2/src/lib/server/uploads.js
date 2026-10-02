/**
 * The one shared copy of the backend for the whole website, so every page uses
 * the same save queue. Saves to STORAGE_DIR if set (tests use a temp folder),
 * otherwise to app_v2/storage.
 */
import { createUploads } from '../../../upload.js';

const uploads = createUploads(process.env.STORAGE_DIR ?? 'storage');

const PARTS = {
	forecast: { upload: uploads.uploadForecast, store: uploads.forecastStore },
	commitments: { upload: uploads.uploadCommitments, store: uploads.commitmentsStore }
};

/**
 * The upload function and store for "forecast" or "commitments". Null for anything else.
 * @param {string} kind
 */
export function partFor(kind) {
	return Object.hasOwn(PARTS, kind) ? PARTS[/** @type {keyof PARTS} */ (kind)] : null;
}
