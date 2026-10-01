/**
 * Where uploaded versions are saved. Today that's CSV files; set STORE=db once a
 * database store exists (see docs/db-plan.md). The page never talks to storage directly.
 *
 * Two stores, kept in separate folders so their version numbers never mix:
 *   store             <STORAGE_DIR>/              forecast workbook (Part 1)
 *   commitmentsStore  <STORAGE_DIR>/commitments/  grant commitments (Part 2)
 */
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { COMMITMENTS_TABLE, createCsvStore, FINANCIALS_TABLE } from './csv.js';

/**
 * One grant's committed amount for one month, as saved in commitments.csv.
 * @typedef {{
 *   grant_name: string,
 *   funder: string,
 *   department: string,
 *   restricted: boolean,
 *   month: string,            // "YYYY-MM"
 *   committed: number|null    // null = blank in the file (nothing committed that month)
 * }} CommitmentRow
 */

/**
 * @typedef {{ id: number, uploadedAt: string, rowCount: number }} SavedVersion
 * One line of versions.csv, plus how many data rows that version holds.
 * @typedef {{
 *   id: number,
 *   uploadedAt: string,       // ISO timestamp
 *   uploadedBy: string,
 *   filename: string,
 *   rowCount: number
 * }} VersionInfo
 * @typedef {{
 *   saveVersion: (
 *     rows: import('../workbook.js').FinancialRow[],
 *     meta: { uploadedBy: string, filename: string }
 *   ) => Promise<SavedVersion>,
 *   listVersions: () => Promise<VersionInfo[]>,     // newest first; [] before the first upload
 *   readVersion: (id: number) => Promise<import('../workbook.js').FinancialRow[]>  // [] if missing
 * }} Store
 * @typedef {{
 *   saveVersion: (
 *     rows: CommitmentRow[],
 *     meta: { uploadedBy: string, filename: string }
 *   ) => Promise<SavedVersion>,
 *   listVersions: () => Promise<VersionInfo[]>,
 *   readVersion: (id: number) => Promise<CommitmentRow[]>
 * }} CommitmentsStore
 */

const root = env.STORAGE_DIR ?? 'storage';
const kind = env.STORE ?? 'csv';

/** @returns {Store} */
function createStore() {
	if (kind === 'csv') return createCsvStore(root, FINANCIALS_TABLE);
	throw new Error(`Unknown STORE "${kind}".`);
}

/** @returns {CommitmentsStore} */
function createCommitmentsStore() {
	if (kind === 'csv') return createCsvStore(path.join(root, 'commitments'), COMMITMENTS_TABLE);
	throw new Error(`Unknown STORE "${kind}".`);
}

export const store = createStore();
export const commitmentsStore = createCommitmentsStore();
