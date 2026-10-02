/**
 * A made-up forecast workbook in the real layout: 9 departments x 12 months.
 * Returns a grid so a test can break one thing, then pass it to toXlsx().
 */
export const DEPARTMENTS = [
	'Operations', 'Programs', 'Finance', 'HR', 'Marketing',
	'Development', 'IT', 'Facilities', 'Youth Services'
];
export const MONTHS = [
	'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025',
	'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026'
];

/** @returns {unknown[][]} */
export function forecastGrid() {
	const monthRow = [null, ...MONTHS.flatMap((m) => [m, null, null])];
	const measureRow = ['Department', ...MONTHS.flatMap(() => ['Budget', 'Actual', 'Forecast'])];
	const departmentRows = DEPARTMENTS.map((name, d) => [
		name,
		...MONTHS.flatMap((_, m) => {
			const budget = 10000 + d * 1000;
			const actual = m < 9 ? budget - 250 : null; // last 3 months haven't closed yet
			return [budget, actual, budget];
		})
	]);
	return [monthRow, measureRow, ...departmentRows];
}
