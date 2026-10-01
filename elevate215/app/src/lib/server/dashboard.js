/**
 * Turns saved rows into the numbers the dashboard on "/" shows.
 * Plain functions with no file access, so they're easy to test.
 */

/**
 * @typedef {import('./workbook.js').FinancialRow} FinancialRow
 * @typedef {import('./store/index.js').CommitmentRow} CommitmentRow
 */

/**
 * Actual vs budget, counting only the department-months that have an actual,
 * so months that haven't closed yet don't drag the percentage down.
 * @param {FinancialRow[]} rows
 */
export function summarizeForecast(rows) {
	/** @type {Map<string, { department: string, actual: number, budget: number }>} */
	const byDept = new Map();
	/** @type {Set<string>} */
	const closedMonths = new Set();
	let actual = 0;
	let budget = 0;

	for (const r of rows) {
		const dept = byDept.get(r.department) ?? { department: r.department, actual: 0, budget: 0 };
		byDept.set(r.department, dept); // keeps the file's department order
		if (r.actual === null) continue;
		closedMonths.add(r.month);
		actual += r.actual;
		budget += r.budget ?? 0;
		dept.actual += r.actual;
		dept.budget += r.budget ?? 0;
	}

	const months = [...closedMonths].sort();
	return {
		/** true once at least one month has an actual */
		hasActuals: months.length > 0,
		actual: round(actual),
		budget: round(budget),
		/** whole-number percent, or null when there's no budget to compare with */
		pctOfBudget: budget ? Math.round((actual / budget) * 100) : null,
		/** "YYYY-MM" of the first and last month with an actual */
		firstMonth: months[0] ?? null,
		lastMonth: months.at(-1) ?? null,
		monthCount: months.length,
		departments: [...byDept.values()].map((d) => ({ ...d, actual: round(d.actual), budget: round(d.budget) }))
	};
}

/**
 * Total actual in one version (blanks count as nothing).
 * @param {FinancialRow[]} rows
 */
export function totalActual(rows) {
	return round(rows.reduce((sum, r) => sum + (r.actual ?? 0), 0));
}

/**
 * Committed money per grant and in total, split by the Restricted flag.
 * @param {CommitmentRow[]} rows
 */
export function summarizeCommitments(rows) {
	/** @type {Map<string, { grant: string, funder: string, restricted: boolean, committed: number }>} */
	const byGrant = new Map();
	for (const r of rows) {
		const g = byGrant.get(r.grant_name) ?? {
			grant: r.grant_name,
			funder: r.funder,
			restricted: r.restricted,
			committed: 0
		};
		g.committed += r.committed ?? 0;
		byGrant.set(r.grant_name, g); // keeps the file's grant order
	}

	const grants = [...byGrant.values()];
	const total = grants.reduce((s, g) => s + g.committed, 0);
	const restricted = grants.filter((g) => g.restricted).reduce((s, g) => s + g.committed, 0);
	const restrictedPct = total ? Math.round((restricted / total) * 100) : null;

	return {
		grantCount: grants.length,
		total: round(total),
		restricted: round(restricted),
		unrestricted: round(total - restricted),
		/** whole-number percents that add up to 100, or null when nothing is committed */
		restrictedPct,
		unrestrictedPct: restrictedPct === null ? null : 100 - restrictedPct,
		grants: grants.map((g) => ({
			...g,
			committed: round(g.committed),
			/** this grant's share of all commitments, 0–100 with one decimal */
			share: total ? Math.round((g.committed / total) * 1000) / 10 : 0
		}))
	};
}

/** @param {number} n */
const round = (n) => Math.round(n * 100) / 100;
