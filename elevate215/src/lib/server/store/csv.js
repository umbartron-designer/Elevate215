/**
 * CSV store: each upload becomes a new dated version on disk. Old versions are never overwritten.
 *
 *   storage/versions.csv                  id,uploaded_at,uploaded_by,filename
 *   storage/versions/<id>/financials.csv  department,month,budget,actual,forecast
 *
 * These columns match the future `versions` and `financials` tables (see docs/db-plan.md),
 * so scripts/migrate-csv-to-db.js can load them straight into a database.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION_COLUMNS = ['id', 'uploaded_at', 'uploaded_by', 'filename'];
const FINANCIAL_COLUMNS = ['department', 'month', 'budget', 'actual', 'forecast'];

/** @param {string} root  folder that holds versions.csv and versions/ */
export function createCsvStore(root) {
	const indexFile = path.join(root, 'versions.csv');
	const versionsDir = path.join(root, 'versions');
	/** Runs saves one at a time in this process so two uploads can't claim the same id. */
	let queue = Promise.resolve();

	/** @type {import('./index.js').Store['saveVersion']} */
	function saveVersion(rows, { uploadedBy, filename }) {
		const result = queue.then(async () => {
			await fs.mkdir(versionsDir, { recursive: true });
			const id = (await lastId()) + 1;
			const uploadedAt = new Date().toISOString();

			// Write the numbers to a temp folder, then rename it into place in one step,
			// so a failure part-way leaves no half-saved version behind.
			const tmp = path.join(versionsDir, `.tmp-${id}-${process.pid}`);
			await fs.rm(tmp, { recursive: true, force: true });
			await fs.mkdir(tmp);
			try {
				await fs.writeFile(
					path.join(tmp, 'financials.csv'),
					toCsv(FINANCIAL_COLUMNS, rows.map((r) => [r.department, r.month, r.budget, r.actual, r.forecast]))
				);
				await fs.rename(tmp, path.join(versionsDir, String(id)));
			} catch (err) {
				await fs.rm(tmp, { recursive: true, force: true });
				throw err;
			}

			const header = (await exists(indexFile)) ? '' : VERSION_COLUMNS.join(',') + '\n';
			await fs.appendFile(indexFile, header + toCsvLine([id, uploadedAt, uploadedBy, filename]) + '\n');

			return { id, uploadedAt, rowCount: rows.length };
		});
		queue = result.then(() => {}, () => {});
		return result;
	}

	/** Highest version id already used. */
	async function lastId() {
		const ids = (await fs.readdir(versionsDir)).map(Number).filter(Number.isInteger);
		return ids.length ? Math.max(...ids) : 0;
	}

	return { saveVersion };
}

/** @param {string} file */
async function exists(file) {
	try {
		await fs.access(file);
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string[]} columns
 * @param {unknown[][]} rows
 */
function toCsv(columns, rows) {
	return [columns.join(','), ...rows.map(toCsvLine)].join('\n') + '\n';
}

/** @param {unknown[]} values */
function toCsvLine(values) {
	return values
		.map((v) => {
			if (v === null || v === undefined) return '';
			const s = String(v);
			return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		})
		.join(',');
}
