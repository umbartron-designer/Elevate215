/**
 * Server side of the upload page.
 *   load            both version lists, with dates ready to show
 *   actions.upload  takes the submitted form, runs the backend, returns saved or why not
 */
import { fail } from '@sveltejs/kit';
import { partFor } from '$lib/server/uploads.js';

export async function load() {
	return {
		forecast: await versionsFor('forecast'),
		commitments: await versionsFor('commitments')
	};
}

export const actions = {
	upload: async ({ request }) => {
		const form = await request.formData();
		const kind = String(form.get('kind') ?? '');
		const file = form.get('file');
		const name = String(form.get('name') ?? '').trim();

		const part = partFor(kind);
		if (!part) return fail(400, { kind, saved: false, type: 'missing', reason: 'Unknown upload type.' });
		if (!(file instanceof File) || file.size === 0 || !name) {
			return fail(400, { kind, saved: false, type: 'missing', reason: 'Choose a file and enter your name.' });
		}

		const result = await part.upload(Buffer.from(await file.arrayBuffer()), { uploadedBy: name, filename: file.name });
		return result.saved ? { kind, ...result } : fail(400, { kind, ...result });
	}
};

/**
 * One part's versions, newest first, with the upload time split into a date and a time.
 * @param {'forecast' | 'commitments'} kind
 */
async function versionsFor(kind) {
	const versions = await /** @type {NonNullable<ReturnType<typeof partFor>>} */ (partFor(kind)).store.listVersions();
	return versions.map((v) => {
		const at = new Date(v.uploadedAt);
		return {
			...v,
			date: at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
			time: at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
		};
	});
}
