/**
 * GET /download/<kind>/<id> sends back the exact .xlsx that was uploaded for that version.
 */
import { error } from '@sveltejs/kit';
import { partFor } from '$lib/server/uploads.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** @param {{ params: { kind: string, id: string } }} event */
export async function GET({ params }) {
	const part = partFor(params.kind);
	const id = Number(params.id);
	if (!part || !Number.isSafeInteger(id) || id < 1) error(404, 'No such version.');

	const original = await part.store.readOriginal(id);
	if (!original) error(404, 'No such version.');

	const version = (await part.store.listVersions()).find((v) => v.id === id);
	const filename = version?.filename || `version-${id}.xlsx`;
	// Plain-ASCII name for older browsers, plus the full name encoded for modern ones.
	const safe = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');

	return new Response(original, {
		headers: {
			'content-type': XLSX_TYPE,
			'content-disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`
		}
	});
}
