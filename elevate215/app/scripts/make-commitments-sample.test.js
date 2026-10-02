import { describe, expect, it } from 'vitest';
import { splitCsvLine } from './make-commitments-sample.js';

describe('splitCsvLine', () => {
	it('splits a line at its commas', () => {
		expect(splitCsvLine('Lincoln High,Philadelphia,500')).toEqual(['Lincoln High', 'Philadelphia', '500']);
	});

	it('keeps commas inside quotes', () => {
		expect(splitCsvLine('"Smith, John",500')).toEqual(['Smith, John', '500']);
	});

	// An empty CSV file has no first line, so readSchoolNames would pass undefined.
	it('throws when given no line at all', () => {
		expect(() => splitCsvLine(undefined)).toThrow(TypeError);
	}); 

	// With no closing quote, every comma counts as text, so nothing gets split.
	it('does not split a line with an unclosed quote', () => {
		expect(splitCsvLine('"Lincoln High,Philadelphia,500')).toEqual(['Lincoln High,Philadelphia,500']);
	});

});
