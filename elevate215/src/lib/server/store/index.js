/**
 * Where uploaded versions are saved. Today that's CSV files; set STORE=db once a
 * database store exists (see docs/db-plan.md). The page never talks to storage directly.
 */
import { env } from '$env/dynamic/private';
import { createCsvStore } from './csv.js';

/**
 * @typedef {{ id: number, uploadedAt: string, rowCount: number }} SavedVersion
 * @typedef {{
 *   saveVersion: (
 *     rows: import('../workbook.js').FinancialRow[],
 *     meta: { uploadedBy: string, filename: string }
 *   ) => Promise<SavedVersion>
 * }} Store
 */

/** @returns {Store} */
function createStore() {
	const kind = env.STORE ?? 'csv';
	if (kind === 'csv') return createCsvStore(env.STORAGE_DIR ?? 'storage');
	throw new Error(`Unknown STORE "${kind}".`);
}

export const store = createStore();
