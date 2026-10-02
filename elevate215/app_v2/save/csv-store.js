/**
 * Save rows as numbered versions in CSV files. Old versions are never overwritten.
 *
 *   <folder>/versions.csv     id,uploaded_at,uploaded_by,filename
 *   <folder>/<id>/rows.csv    one line per row, columns as given to createCsvStore
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION_COLUMNS = ['id', 'uploaded_at', 'uploaded_by', 'filename'];
const ROWS_FILE = 'rows.csv';

/**
 * What each column holds, so reading a CSV back gives the right type.
 * @typedef {'text' | 'amount' | 'yesno'} ColumnType
 * @typedef {{ id: number, uploadedAt: string, uploadedBy: string, filename: string }} Version
 */

/**
 * @param {string} folder  where this kind of data is saved, e.g. "storage/forecast"
 * @param {Record<string, ColumnType>} columns  column name -> type, in file order
 */
export function createCsvStore(folder, columns) {
	const names = Object.keys(columns);
	const indexFile = path.join(folder, 'versions.csv');
	/** Saves run one at a time so two uploads can't claim the same id. */
	let queue = Promise.resolve();

	/**
	 * @param {Record<string, unknown>[]} rows
	 * @param {{ uploadedBy: string, filename: string }} meta
	 * @returns {Promise<{ id: number, rowCount: number }>}
	 */
	function saveVersion(rows, { uploadedBy, filename }) {
		const result = queue.then(async () => {
			await fs.mkdir(folder, { recursive: true });
			const id = (await lastId()) + 1;

			// Write to a temp folder, then rename it into place in one step,
			// so a failure part-way leaves no half-saved version behind.
			const tmp = path.join(folder, `.tmp-${id}-${process.pid}`);
			await fs.rm(tmp, { recursive: true, force: true });
			await fs.mkdir(tmp);
			try {
				const lines = [names.join(','), ...rows.map((row) => toCsvLine(names.map((n) => row[n])))];
				await fs.writeFile(path.join(tmp, ROWS_FILE), lines.join('\n') + '\n');
				await fs.rename(tmp, path.join(folder, String(id)));
			} catch (err) {
				await fs.rm(tmp, { recursive: true, force: true });
				throw err;
			}

			const header = (await readIfExists(indexFile)) === null ? VERSION_COLUMNS.join(',') + '\n' : '';
			const uploadedAt = new Date().toISOString();
			await fs.appendFile(indexFile, header + toCsvLine([id, uploadedAt, uploadedBy, filename]) + '\n');
			return { id, rowCount: rows.length };
		});
		queue = result.then(() => {}, () => {}); // keep the queue going even if this save failed
		return result;
	}

	/**
	 * Every saved version, newest first. Empty before the first upload.
	 * @returns {Promise<Version[]>}
	 */
	async function listVersions() {
		const index = await readIfExists(indexFile);
		if (index === null) return [];
		const [, ...lines] = parseCsv(index); // skip the header line
		return lines
			.map(([id, uploadedAt, uploadedBy, filename]) => ({ id: Number(id), uploadedAt, uploadedBy, filename }))
			.sort((a, b) => b.id - a.id);
	}

	/**
	 * The rows saved in one version, with amounts and yes/no turned back from text.
	 * Empty if that version doesn't exist.
	 * @param {number} id
	 */
	async function readVersion(id) {
		// A whole number only, so the id can't point outside this folder.
		if (!Number.isSafeInteger(id) || id < 1) throw new Error(`Version id must be a whole number, not "${id}".`);
		const data = await readIfExists(path.join(folder, String(id), ROWS_FILE));
		if (data === null) return [];
		const [, ...lines] = parseCsv(data);
		return lines.map((values) =>
			Object.fromEntries(names.map((n, i) => [n, fromText(values[i] ?? '', columns[n])]))
		);
	}

	/** Highest version id already used, 0 if none. */
	async function lastId() {
		const ids = (await fs.readdir(folder)).map(Number).filter(Number.isInteger);
		return ids.length ? Math.max(...ids) : 0;
	}

	return { saveVersion, listVersions, readVersion };
}

/**
 * @param {string} s
 * @param {ColumnType} type
 */
function fromText(s, type) {
	if (type === 'amount') return s === '' ? null : Number(s);
	if (type === 'yesno') return s === 'true';
	return s;
}

/**
 * A file's text, or null if it doesn't exist yet.
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
 * One CSV line. Blank for null; quotes any value with a comma, quote or line break.
 * @param {unknown[]} values
 */
function toCsvLine(values) {
	return values
		.map((v) => {
			if (v === null || v === undefined) return '';
			const s = String(v);
			return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		})
		.join(',');
}

/**
 * Split CSV text into lines of fields, undoing the quoting toCsvLine adds.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
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
