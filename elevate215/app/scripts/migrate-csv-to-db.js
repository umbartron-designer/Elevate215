/**
 * Move saved CSV versions into a database.
 *
 * Reads storage/versions.csv and every storage/versions/<id>/financials.csv and writes
 * storage/migration.sql: the schema plus INSERTs, one transaction per version.
 * If storage/commitments/ exists, its versions go into commitment_versions and commitments too.
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
CREATE TABLE IF NOT EXISTS commitment_versions (
  id          INTEGER PRIMARY KEY,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  filename    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commitments (
  version_id  INTEGER NOT NULL REFERENCES commitment_versions(id),
  grant_name  TEXT NOT NULL,
  funder      TEXT NOT NULL,
  department  TEXT NOT NULL,
  restricted  BOOLEAN NOT NULL,
  month       TEXT NOT NULL,
  committed   NUMERIC(14, 2),
  PRIMARY KEY (version_id, grant_name, month)
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

// Grant commitments (Part 2) live in their own folder. Skip quietly if nobody has uploaded one yet.
const commitmentsRoot = path.join(root, 'commitments');
const commitmentsIndex = path.join(commitmentsRoot, 'versions.csv');
/** @type {Record<string, string>[]} */
let commitmentVersions = [];
if (await exists(commitmentsIndex)) {
	commitmentVersions = parseCsv(await fs.readFile(commitmentsIndex, 'utf8'));
}

for (const v of commitmentVersions) {
	const commitments = parseCsv(
		await fs.readFile(path.join(commitmentsRoot, 'versions', v.id, 'commitments.csv'), 'utf8')
	);
	out.push('BEGIN;');
	out.push(
		`INSERT INTO commitment_versions (id, uploaded_at, uploaded_by, filename) VALUES ` +
			`(${v.id}, ${str(v.uploaded_at)}, ${str(v.uploaded_by)}, ${str(v.filename)}) ON CONFLICT DO NOTHING;`
	);
	for (const c of commitments) {
		out.push(
			`INSERT INTO commitments (version_id, grant_name, funder, department, restricted, month, committed) VALUES ` +
				`(${v.id}, ${str(c.grant_name)}, ${str(c.funder)}, ${str(c.department)}, ${bool(c.restricted)}, ` +
				`${str(c.month)}, ${num(c.committed)}) ON CONFLICT DO NOTHING;`
		);
	}
	out.push('COMMIT;');
	console.log(`Commitments version ${v.id}: ${commitments.length} rows`);
}

const target = path.join(root, 'migration.sql');
await fs.writeFile(target, out.join('\n') + '\n');
console.log(
	`Wrote ${target} (${versions.length} versions, ${commitmentVersions.length} commitments versions)`
);

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
 * "true"/"false" from commitments.csv -> SQL TRUE/FALSE (works in Postgres and SQLite 3.23+).
 * @param {string} s
 */
function bool(s) {
	if (s === 'true') return 'TRUE';
	if (s === 'false') return 'FALSE';
	throw new Error(`"${s}" is not true or false.`);
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
