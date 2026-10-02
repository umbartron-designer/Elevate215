/**
 * The board finance dashboard on "/".
 *
 * load:    reads the saved versions and works out the numbers for the version being viewed
 *          (newest by default, or ?forecast=<id>&commitments=<id>).
 * actions: ?/forecast and ?/commitments save a new upload, using the same readers and stores
 *          as before, so a broken file is rejected and nothing is saved.
 */
import { fail } from '@sveltejs/kit';
import { readWorkbook, WorkbookError } from '$lib/server/workbook.js';
import { readCommitments } from '$lib/server/commitments.js';
import { commitmentsStore, store } from '$lib/server/store/index.js';
import { summarizeCommitments, summarizeForecast, totalActual } from '$lib/server/dashboard.js';

/**
 * The version a search param asks for, or the newest one if it's missing or unknown.
 * @param {import('$lib/server/store/index.js').VersionInfo[]} versions  newest first
 * @param {string | null} param
 */
function pickVersion(versions, param) {
	const asked = param && /^\d+$/.test(param) ? versions.find((v) => v.id === Number(param)) : undefined;
	return asked ?? versions[0] ?? null;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const [forecastVersions, commitmentVersions] = await Promise.all([
		store.listVersions(),
		commitmentsStore.listVersions()
	]);
	const forecastPick = pickVersion(forecastVersions, url.searchParams.get('forecast'));
	const commitmentsPick = pickVersion(commitmentVersions, url.searchParams.get('commitments'));

	const [forecastRows, commitmentRows, trend] = await Promise.all([
		forecastPick ? store.readVersion(forecastPick.id) : [],
		commitmentsPick ? commitmentsStore.readVersion(commitmentsPick.id) : [],
		// Total actual in every forecast version, oldest to newest, for the line chart.
		Promise.all(
			[...forecastVersions].reverse().map(async (v) => ({
				id: v.id,
				uploadedAt: v.uploadedAt,
				totalActual: totalActual(await store.readVersion(v.id))
			}))
		)
	]);

	return {
		now: Date.now(),
		forecast: {
			versions: forecastVersions,
			selectedId: forecastPick?.id ?? null,
			latestId: forecastVersions[0]?.id ?? null,
			summary: forecastPick ? summarizeForecast(forecastRows) : null,
			trend
		},
		commitments: {
			versions: commitmentVersions,
			selectedId: commitmentsPick?.id ?? null,
			latestId: commitmentVersions[0]?.id ?? null,
			summary: commitmentsPick ? summarizeCommitments(commitmentRows) : null
		}
	};
}

/**
 * The upload steps both forms share: check the form, read the whole file, save a new version.
 * @template T
 * @param {Request} request
 * @param {{
 *   kind: 'forecast' | 'commitments',
 *   field: string,
 *   missing: string,
 *   read: (data: ArrayBuffer) => Promise<T[]>,
 *   save: (rows: T[], meta: { uploadedBy: string, filename: string }) => Promise<import('$lib/server/store/index.js').SavedVersion>
 * }} opts
 */
async function upload(request, { kind, field, missing, read, save }) {
	const form = await request.formData();
	const file = form.get(field);
	const uploadedBy = String(form.get('uploadedBy') ?? '').trim();

	if (!uploadedBy) return fail(400, { kind, uploadedBy, error: 'Enter your name.' });
	if (!(file instanceof File) || file.size === 0) return fail(400, { kind, uploadedBy, error: missing });
	if (!file.name.toLowerCase().endsWith('.xlsx')) {
		return fail(400, { kind, uploadedBy, error: `${file.name} is not an .xlsx file.` });
	}

	let rows;
	try {
		rows = await read(await file.arrayBuffer());
		console.log("ROWS::>", rows)
	} catch (err) {
		if (err instanceof WorkbookError) return fail(400, { kind, uploadedBy, error: err.message });
		throw err;
	}

	const version = await save(rows, { uploadedBy, filename: file.name });
	return { kind, uploadedBy, filename: file.name, version };
}

/** @satisfies {import('./$types').Actions} */
export const actions = {
	forecast: ({ request }) =>
		upload(request, {
			kind: 'forecast',
			field: 'workbook',
			missing: 'Choose a workbook to upload.',
			read: readWorkbook,
			save: store.saveVersion
		}),
	commitments: ({ request }) =>
		upload(request, {
			kind: 'commitments',
			field: 'commitments',
			missing: 'Choose a commitments file to upload.',
			read: readCommitments,
			save: commitmentsStore.saveVersion
		})
};
