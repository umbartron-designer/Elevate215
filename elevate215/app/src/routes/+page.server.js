import { fail } from '@sveltejs/kit';
import { readWorkbook, WorkbookError } from '$lib/server/workbook.js';
import { store } from '$lib/server/store/index.js';

/** @satisfies {import('./$types').Actions} */
export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('workbook');
		const uploadedBy = String(form.get('uploadedBy') ?? '').trim();

		if (!uploadedBy) return fail(400, { error: 'Enter your name.' });
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Choose a workbook to upload.' });
		if (!file.name.toLowerCase().endsWith('.xlsx')) {
			return fail(400, { error: `${file.name} is not an .xlsx file.` });
		}

		let rows;
		try {
			rows = await readWorkbook(await file.arrayBuffer());
		} catch (err) {
			if (err instanceof WorkbookError) return fail(400, { error: err.message });
			throw err;
		}

		const version = await store.saveVersion(rows, { uploadedBy, filename: file.name });
		return { version };
	}
};
