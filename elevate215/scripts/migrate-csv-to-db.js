/**
 * Move saved CSV versions into a database.
 *
 * Reads storage/versions.csv and every storage/versions/<id>/financials.csv and writes
 * storage/migration.sql: the schema plus INSERTs, one transaction per version.
 * ON CONFLICT DO NOTHING makes it safe to re-run, since already-migrated versions are skipped.
 * The SQL works in both SQLite and Postgres:
 *
 *   npm run migrate
 *   sqlite3 elevate215.db < storage/migration.sql
 *   psql "$DATABASE_URL" -f storage/migration.sql
 *
 * See docs/db-plan.md for the cutover steps.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.env.STORAGE_DIR ?? 'storage';

const SCHEMA = `CREATE TABLE IF NOT EXISTS versions (
  id          INTEGER PRIMARY KEY,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  filename    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financials (
  version_id  INTEGER NOT NULL REFERENCES versions(id),
  department  TEXT NOT NULL,
  month       TEXT NOT NULL,
  budget      NUMERIC(14, 2),
  actual      NUMERIC(14, 2),
  forecast    NUMERIC(14, 2),
  PRIMARY KEY (version_id, department, month)
);
`;

const versions = parseCsv(await fs.readFile(path.join(root, 'versions.csv'), 'utf8'));
const out = [SCHEMA];

for (const v of versions) {
	const financials = parseCsv(await fs.readFile(path.join(root, 'versions', v.id, 'financials.csv'), 'utf8'));
	out.push('BEGIN;');
	out.push(
		`INSERT INTO versions (id, uploaded_at, uploaded_by, filename) VALUES ` +
			`(${v.id}, ${str(v.uploaded_at)}, ${str(v.uploaded_by)}, ${str(v.filename)}) ON CONFLICT DO NOTHING;`
	);
	for (const f of financials) {
		out.push(
			`INSERT INTO financials (version_id, department, month, budget, actual, forecast) VALUES ` +
				`(${v.id}, ${str(f.department)}, ${str(f.month)}, ${num(f.budget)}, ${num(f.actual)}, ${num(f.forecast)}) ` +
				`ON CONFLICT DO NOTHING;`
		);
	}
	out.push('COMMIT;');
	console.log(`Version ${v.id}: ${financials.length} rows`);
}

const target = path.join(root, 'migration.sql');
await fs.writeFile(target, out.join('\n') + '\n');
console.log(`Wrote ${target} (${versions.length} versions)`);

/** @param {string} s */
function str(s) {
	return `'${s.replace(/'/g, "''")}'`;
}

/** @param {string} s */
function num(s) {
	if (s === '') return 'NULL';
	if (!Number.isFinite(Number(s))) throw new Error(`"${s}" is not a number.`);
	return s;
}

/**
 * Minimal CSV reader for the files csv.js writes (quoted fields, doubled quotes).
 * @param {string} textContent
 * @returns {Record<string, string>[]}
 */
function parseCsv(textContent) {
	/** @type {string[][]} */
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < textContent.length; i++) {
		const c = textContent[i];
		if (quoted) {
			if (c === '"' && textContent[i + 1] === '"') (field += '"'), i++;
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') row.push(field), (field = '');
		else if (c === '\n') row.push(field), rows.push(row), (row = []), (field = '');
		else if (c !== '\r') field += c;
	}
	if (field || row.length) row.push(field), rows.push(row);

	const [header, ...body] = rows;
	return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
