/**
 * A made-up grant commitments file in the real layout: 5 grants x 12 months.
 * Returns a grid so a test can break one thing, then pass it to toXlsx().
 */
import { MONTHS } from './forecast.js';

export const GRANTS = [
	['Youth Jobs', 'City Fund', 'Youth Services', 'Yes'],
	['Tech Upgrade', 'State Grant Office', 'IT', 'Yes'],
	['General Support', 'Community Trust', 'Operations', 'No'],
	['Outreach', 'Family Foundation', 'Marketing', 'No'],
	['After School', 'City Fund', 'Programs', 'Yes']
];

/** @returns {unknown[][]} */
export function commitmentsGrid() {
	const headerRow = ['Grant', 'Funder', 'Department', 'Restricted', ...MONTHS];
	const grantRows = GRANTS.map((labels, g) => [
		...labels,
		...MONTHS.map((_, m) => (m % 3 === g % 3 ? null : 5000 + g * 500)) // some months have nothing committed
	]);
	return [headerRow, ...grantRows];
}
