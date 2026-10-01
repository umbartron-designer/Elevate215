/**
 * Upload handler for the grant commitments file (Part 2).
 * Same steps as the forecast upload on "/": check the form, read the file, save a new version.
 */
import { fail } from '@sveltejs/kit';
import { readCommitments } from '$lib/server/commitments.js';
import { WorkbookError } from '$lib/server/workbook.js';
import { commitmentsStore } from '$lib/server/store/index.js';

/** @satisfies {import('./$types').Actions} */
export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('commitments');
		const uploadedBy = String(form.get('uploadedBy') ?? '').trim();

		// Basic form checks before we even open the file.
		if (!uploadedBy) return fail(400, { error: 'Enter your name.' });
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Choose a commitments file to upload.' });
		if (!file.name.toLowerCase().endsWith('.xlsx')) {
			return fail(400, { error: `${file.name} is not an .xlsx file.` });
		}

		// Read the whole file first. Any problem stops here, so nothing is saved.
		let rows;
		try {
			rows = await readCommitments(await file.arrayBuffer());
		} catch (err) {
			if (err instanceof WorkbookError) return fail(400, { error: err.message });
			throw err;
		}

		const version = await commitmentsStore.saveVersion(rows, { uploadedBy, filename: file.name });
		return { version };
	}
};
