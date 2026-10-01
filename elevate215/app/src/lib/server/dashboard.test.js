import { describe, expect, it } from 'vitest';
import { summarizeCommitments, summarizeForecast, totalActual } from './dashboard.js';
import { buildCommitmentsTemplate, buildForecastTemplate } from './templates.js';
import { readWorkbook } from './workbook.js';
import { readCommitments } from './commitments.js';

/** @param {string} department @param {string} month @param {number} budget @param {number|null} actual */
const f = (department, month, budget, actual) => ({ department, month, budget, actual, forecast: actual ?? budget });

describe('summarizeForecast', () => {
	it('compares actual only with the budget of months that have an actual', () => {
		const s = summarizeForecast([
			f('A', '2025-07', 100, 90),
			f('A', '2025-08', 100, null), // not closed: its budget is left out
			f('B', '2025-07', 50, 60)
		]);
		expect(s.actual).toBe(150);
		expect(s.budget).toBe(150);
		expect(s.pctOfBudget).toBe(100);
		expect(s.monthCount).toBe(1);
		expect(s.departments).toEqual([
			{ department: 'A', actual: 90, budget: 100 },
			{ department: 'B', actual: 60, budget: 50 }
		]);
	});

	it('handles no rows and no actuals', () => {
		expect(summarizeForecast([]).hasActuals).toBe(false);
		const s = summarizeForecast([f('A', '2025-07', 100, null)]);
		expect(s).toMatchObject({ hasActuals: false, actual: 0, budget: 0, pctOfBudget: null });
		expect(totalActual([f('A', '2025-07', 100, null), f('A', '2025-08', 100, 40.5)])).toBe(40.5);
	});
});

describe('summarizeCommitments', () => {
	it('totals per grant and splits by Restricted', () => {
		/** @param {string} g @param {boolean} restricted @param {number|null} committed */
		const c = (g, restricted, committed) => ({ grant_name: g, funder: 'F', department: 'D', restricted, month: '2025-07', committed });
		const s = summarizeCommitments([c('A', true, 300), c('A', true, null), c('B', false, 100)]);
		expect(s).toMatchObject({ grantCount: 2, total: 400, restricted: 300, restrictedPct: 75, unrestrictedPct: 25 });
		expect(s.grants.map((g) => [g.grant, g.committed, g.share])).toEqual([['A', 300, 75], ['B', 100, 25]]);
		expect(summarizeCommitments([]).restrictedPct).toBeNull();
	});
});

describe('upload templates', () => {
	/** @param {import('exceljs').Workbook} wb */
	const toBuffer = async (wb) => /** @type {Buffer} */ (await wb.xlsx.writeBuffer());

	// An empty template passes every header check and only fails because it has no data rows yet.
	it('forecast template has the header layout readWorkbook expects', async () => {
		await expect(readWorkbook(await toBuffer(buildForecastTemplate()))).rejects.toThrow('Expected 9 departments, found 0.');
	});

	it('commitments template has the header layout readCommitments expects', async () => {
		await expect(readCommitments(await toBuffer(buildCommitmentsTemplate()))).rejects.toThrow('The file has no grants in it.');
	});
});
