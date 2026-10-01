/**
 * CSV store: each upload becomes a new dated version on disk. Old versions are never overwritten.
 *
 *   storage/versions.csv                  id,uploaded_at,uploaded_by,filename
 *   storage/versions/<id>/financials.csv  department,month,budget,actual,forecast
 *
 * The same code also saves grant commitments in their own folder:
 *
 *   storage/commitments/versions.csv                    id,uploaded_at,uploaded_by,filename
 *   storage/commitments/versions/<id>/commitments.csv   grant_name,funder,department,restricted,month,committed
 *
 * These columns match the future database tables (see docs/db-plan.md),
 * so scripts/migrate-csv-to-db.js can load them straight into a database.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION_COLUMNS = ['id', 'uploaded_at', 'uploaded_by', 'filename'];

/**
 * What one kind of data looks like on disk.
 * @template T
 * @typedef {{
 *   file: string,               // name of the CSV inside each version folder, e.g. "financials.csv"
 *   columns: string[],          // header line for that CSV
 *   toRow: (row: T) => unknown[], // turns one row object into values, in the same order as columns
 *   fromRow: (values: string[]) => T // the reverse, for reading a saved CSV back (does not change saving)
 * }} CsvTable
 */

/**
 * How Part 1 (the forecast workbook) is saved. Kept exactly as it was before.
 * @type {CsvTable<import('../workbook.js').FinancialRow>}
 */
export const FINANCIALS_TABLE = {
	file: 'financials.csv',
	columns: ['department', 'month', 'budget', 'actual', 'forecast'],
	toRow: (r) => [r.department, r.month, r.budget, r.actual, r.forecast],
	fromRow: ([department, month, budget, actual, forecast]) => ({
		department,
		month,
		budget: toAmount(budget),
		actual: toAmount(actual),
		forecast: toAmount(forecast)
	})
};

/**
 * How Part 2 (grant commitments) is saved. Exactly these six columns, nothing extra.
 * "grant_name" instead of "grant" because GRANT is a reserved word in Postgres.
 * @type {CsvTable<import('./index.js').CommitmentRow>}
 */
export const COMMITMENTS_TABLE = {
	file: 'commitments.csv',
	columns: ['grant_name', 'funder', 'department', 'restricted', 'month', 'committed'],
	// restricted is a real boolean, so String() writes it as true/false
	toRow: (r) => [r.grant_name, r.funder, r.department, r.restricted, r.month, r.committed],
	fromRow: ([grant_name, funder, department, restricted, month, committed]) => ({
		grant_name,
		funder,
		department,
		restricted: restricted === 'true',
		month,
		committed: toAmount(committed)
	})
};

/**
 * @template T
 * @param {string} root folder that holds versions.csv and versions/
 * @param {CsvTable<T>} table  which CSV to write inside each version folder
 */
export function createCsvStore(root, table) {
	const indexFile = path.join(root, 'versions.csv');
	const versionsDir = path.join(root, 'versions');
	/** Runs saves one at a time in this process so two uploads can't claim the same id. */
	let queue = Promise.resolve();

	/**
	 * @param {T[]} rows
	 * @param {{ uploadedBy: string, filename: string }} meta
	 * @returns {Promise<import('./index.js').SavedVersion>}
	 */
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
				await fs.writeFile(path.join(tmp, table.file), toCsv(table.columns, rows.map(table.toRow)));
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

	/**
	 * Every saved version, newest first. Empty if nothing has been uploaded yet.
	 * @returns {Promise<import('./index.js').VersionInfo[]>}
	 */
	async function listVersions() {
		const index = await readIfExists(indexFile);
		if (index === null) return [];
		const [, ...lines] = parseCsv(index); // skip the header line
		const versions = await Promise.all(
			lines
				.filter((v) => /^\d+$/.test(v[0] ?? '') && Number(v[0]) >= 1)
				.map(async ([id, uploadedAt, uploadedBy, filename]) => {
					const data = await readIfExists(dataFile(Number(id)));
					return {
						id: Number(id),
						uploadedAt,
						uploadedBy,
						filename,
						// data rows only, not the header
						rowCount: data === null ? 0 : Math.max(parseCsv(data).length - 1, 0)
					};
				})
		);
		return versions.sort((a, b) => b.id - a.id);
	}

	/**
	 * The rows saved in one version, with numbers and booleans turned back from text.
	 * Empty if that version doesn't exist.
	 * @param {number} id
	 * @returns {Promise<T[]>}
	 */
	async function readVersion(id) {
		const data = await readIfExists(dataFile(id));
		if (data === null) return [];
		const [, ...lines] = parseCsv(data);
		return lines.map(table.fromRow);
	}

	/**
	 * Path to one version's CSV. The id must be a whole number, so it can't point outside versions/.
	 * @param {number} id
	 */
	function dataFile(id) {
		if (!Number.isSafeInteger(id) || id < 1) throw new Error(`Version id must be a whole number, not "${id}".`);
		return path.join(versionsDir, String(id), table.file);
	}

	return { saveVersion, listVersions, readVersion };
}

/**
 * A file's text, or null if it (or its folder) doesn't exist yet.
 * @param {string} file
 */
async function readIfExists(file) {
	try {
		return await fs.readFile(file, 'utf8');
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return null;
		throw err;
	}
}

/**
 * Blank back to null, anything else back to a number (the reverse of how amounts are written).
 * @param {string} s
 */
function toAmount(s) {
	return s === '' || s === undefined ? null : Number(s);
}

/**
 * Split CSV text into lines of fields, undoing the quoting toCsvLine adds:
 * "quoted, fields", doubled "" quotes and line breaks inside quotes.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
	/** @type {string[][]} */
	const lines = [];
	/** @type {string[]} */
	let line = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			line.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			line.push(field);
			if (line.length > 1 || line[0] !== '') lines.push(line); // skip blank lines
			line = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || line.length) {
		line.push(field);
		lines.push(line);
	}
	return lines;
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
