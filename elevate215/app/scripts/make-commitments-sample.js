/**
 * Build sample_commitments.xlsx for testing the grant commitments upload.
 * Grant names are real school names from the School Rollup CSV; everything else is made up.
 * Run: npm run sample:commitments
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEPARTMENTS, MONTHS } from './make-sample.js';

/** The school roll-up CSV lives in elevate215/data/, two folders up from this script. */
const ROLLUP_CSV = fileURLToPath(
	new URL('../../data/Elevate215-School-Data - PHL School Performance Model.xlsx - School Rollup.csv', import.meta.url)
);

/** How many schools to turn into grants. */
const GRANT_COUNT = 12;

/** Made-up funders, picked in turn. */
const FUNDERS = ['City Fund', 'State Education Grant', 'Community Foundation', 'Federal Title I'];

/** A small seeded random number generator so the sample is the same every run (same as make-sample.js). */
function seeded(seed) {
	return () => {
		seed = (seed * 1664525 + 1013904223) % 2 ** 32;
		return seed / 2 ** 32;
	};
}

/**
 * Split one CSV line into fields. Handles "quoted, fields" and doubled "" quotes.
 * Good enough for the roll-up file; it doesn't handle line breaks inside quotes.
 * @param {string} line
 */
function splitCsvLine(line) {
	const fields = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			if (c === '"' && line[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			fields.push(field);
			field = '';
		} else field += c;
	}
	fields.push(field);
	return fields;
}

/**
 * Read the first `count` school names from the roll-up CSV.
 * @param {number} count
 */
export function readSchoolNames(count = GRANT_COUNT) {
	if (!fs.existsSync(ROLLUP_CSV)) {
		throw new Error(`Can't find the school roll-up CSV at ${ROLLUP_CSV}`);
	}
	const lines = fs.readFileSync(ROLLUP_CSV, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
	const header = splitCsvLine(lines[0]);
	const nameCol = header.indexOf('SchoolName');
	if (nameCol === -1) throw new Error('The roll-up CSV has no SchoolName column.');

	/** @type {string[]} */
	const names = [];
	for (const line of lines.slice(1)) {
		const name = (splitCsvLine(line)[nameCol] ?? '').trim();
		// Skip blanks and repeats, since a grant name has to be unique.
		if (name && !names.includes(name)) names.push(name);
		if (names.length === count) break;
	}
	return names;
}

/** @param {{ grants?: string[] }} [options] */
export function buildCommitmentsSample({ grants = readSchoolNames() } = {}) {
	const random = seeded(215);
	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Commitments');

	// Row 1: the four label headers, then one column per month starting in column E.
	['Grant', 'Funder', 'Department', 'Restricted'].forEach((h, i) => (ws.getCell(1, i + 1).value = h));
	MONTHS.forEach((month, i) => {
		const cell = ws.getCell(1, 5 + i);
		cell.value = month;
		cell.numFmt = 'mmm yyyy';
	});

	// Rows 2+: one grant each.
	grants.forEach((grant, g) => {
		const row = ws.getRow(2 + g);
		row.getCell(1).value = grant;
		row.getCell(2).value = FUNDERS[g % FUNDERS.length];
		row.getCell(3).value = DEPARTMENTS[g % DEPARTMENTS.length];
		row.getCell(4).value = random() < 0.5 ? 'Yes' : 'No';
		MONTHS.forEach((_, i) => {
			// About 1 in 5 months has nothing committed (left blank).
			const blank = random() < 0.2;
			row.getCell(5 + i).value = blank ? null : Math.round((1_000 + random() * 24_000) / 50) * 50;
		});
	});

	return wb;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await buildCommitmentsSample().xlsx.writeFile('sample_commitments.xlsx');
	console.log('Wrote sample_commitments.xlsx');
}
