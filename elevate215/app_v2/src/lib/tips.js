/**
 * "What to do" tips shown under a rejected upload, one per kind of problem.
 * The backend says what went wrong (the reason); these say how to fix it.
 */
const TIPS = {
	unreadable: 'Open the file in Excel, choose File > Save As, pick "Excel Workbook (.xlsx)", then upload the new file.',
	header: 'Check the labels and month names at the top of the sheet match the usual layout. Fix them, save, and upload again.',
	cell: 'Go to the cell or row named above, correct it, save the file, and upload again.',
	missing: 'Choose a file and enter your name, then upload.',
	duplicate: {
		forecast: 'Each department should appear only once. Remove or correct one of the two rows, save, and upload again.',
		commitments: 'Each grant should appear only once. Remove or correct one of the two rows, save, and upload again.'
	},
	count: {
		forecast: 'The workbook must list all 9 departments, one per row. Add the missing ones, save, and upload again.',
		commitments: 'Add at least one grant below the header row, save, and upload again.'
	}
};

/**
 * @param {'forecast' | 'commitments'} kind
 * @param {string} type  the problem type from the backend, or "missing"
 */
export function tipFor(kind, type) {
	const tip = Object.hasOwn(TIPS, type) ? TIPS[/** @type {keyof TIPS} */ (type)] : TIPS.cell;
	return typeof tip === 'string' ? tip : tip[kind];
}
