<!--
	Board finance dashboard. Shows the newest forecast and commitments versions by default,
	or older ones picked from the version history (?forecast=<id>&commitments=<id>).
	Both uploads live in one form so they can share the "Your name" field; each card's
	Upload button posts to its own action (?/forecast or ?/commitments).
-->
<script>
	import { onMount } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import ChartCanvas from '$lib/components/ChartCanvas.svelte';
	import { money, monthLabel, shortDate, shortMoney, timeAgo } from '$lib/format.js';

	/** @type {{ data: import('./$types').PageData, form: import('./$types').ActionData }} */
	let { data, form } = $props();

	const NAME_KEY = 'elevate215.uploaderName';

	/** @typedef {'forecast' | 'commitments'} Kind */
	/** @typedef {{ type: 'ok' | 'err' | 'busy', text: string } | null} Status */

	/** Form field name of each card's file input. */
	const FILE_FIELD = { forecast: 'workbook', commitments: 'commitments' };

	// After a no-JS post the name comes back from the server; otherwise it's filled from localStorage.
	// Only the first value is wanted: after that the field belongs to the person typing.
	// svelte-ignore state_referenced_locally
	let uploaderName = $state(form?.uploadedBy ?? '');
	/** @type {HTMLInputElement | undefined} */
	let nameInput = $state();
	/** @type {HTMLFormElement | undefined} */
	let uploadForm = $state();
	/** @type {Record<Kind, HTMLInputElement | undefined>} */
	let fileInputs = $state({ forecast: undefined, commitments: undefined });
	/** @type {Record<Kind, HTMLButtonElement | undefined>} */
	let uploadButtons = $state({ forecast: undefined, commitments: undefined });
	/** @type {Record<Kind, string>} name of the file waiting to be uploaded */
	let chosen = $state({ forecast: '', commitments: '' });
	/** @type {Record<Kind, boolean>} */
	let dragging = $state({ forecast: false, commitments: false });
	/** @type {Record<Kind, Status>} messages set in the browser; win over `form` */
	let status = $state({ forecast: null, commitments: null });

	onMount(() => {
		try {
			const saved = localStorage.getItem(NAME_KEY);
			if (saved && !uploaderName) uploaderName = saved;
		} catch {
			// storage blocked (private window etc.): the field just starts empty
		}
	});

	function rememberName() { // Save the uploader's name to localStorage for future sessions
		try {
			localStorage.setItem(NAME_KEY, uploaderName.trim());
			console.log('Name remembered:', uploaderName); 
		} catch {
			// not important if it can't be remembered
		}
	}

	/**
	 * The message under a card: from this session, or from a no-JS form post.
	 * @param {Kind} kind
	 * @returns {Status}
	 */
	function messageFor(kind) { // get the status message for the given kind 

		console.log("STATUS::>", kind);
		if (status[kind]) return status[kind];
		if (form?.kind !== kind) return null;
		if ('error' in form) return { type: 'err', text: `Nothing was saved. ${form.error}` };
		if ('version' in form && form.version) return savedMessage(form.filename, form.version);
		return null;
	}

	/**
	 * @param {string} filename
	 * @param {{ id: number, rowCount: number }} version
	 * @returns {Status}
	 */
	const savedMessage = (filename, version) => ({ // generate a success message for the saved file
		type: 'ok',
		text: `Saved ${filename} as version ${version.id} (${version.rowCount} rows). The dashboard now shows it.`
	});

	/** @param {Kind} kind */
	function submitCard(kind) {
		const button = uploadButtons[kind];
		if (!uploadForm || !button || button.disabled) return;
		uploadForm.requestSubmit(button);
	}

	/** @param {Kind} kind @param {Event} e */
	function onFileChosen(kind, e) {  // handle when a file is chosen for the given kind
		console.log('File chosen for kind:', kind, 'file:', e.currentTarget.files?.[0]?.name);
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		chosen[kind] = input.files?.[0]?.name ?? '';
		status[kind] = null;
		if (chosen[kind]) submitCard(kind);
	}

	/** @param {Kind} kind @param {DragEvent} e */
	function onDrop(kind, e) {
		e.preventDefault();
		dragging[kind] = false;
		const file = e.dataTransfer?.files?.[0];
		const input = fileInputs[kind];
		if (!file || !input) return;
		const one = new DataTransfer(); // only the first file if several are dropped
		one.items.add(file);
		input.files = one.files;
		chosen[kind] = file.name;
		status[kind] = null;
		submitCard(kind);
	}

	/** @param {Kind} kind @param {DragEvent} e */
	function onDragLeave(kind, e) {
		const zone = /** @type {HTMLElement} */ (e.currentTarget);
		if (!zone.contains(/** @type {Node | null} */ (e.relatedTarget))) dragging[kind] = false;
	}

	/** @param {Kind} kind */
	function clearFile(kind) {
		const input = fileInputs[kind];
		if (input) input.value = '';
		chosen[kind] = '';
	}

	/** @type {import('@sveltejs/kit').SubmitFunction} */
	function onSubmit({ action, formData, cancel }) {
		/** @type {Kind} */
		const kind = action.search === '?/commitments' ? 'commitments' : 'forecast';
		const other = kind === 'forecast' ? 'commitments' : 'forecast';

		if (!uploaderName.trim()) {
			cancel();
			status[kind] = { type: 'err', text: 'Nothing was saved. Enter your name above first.' };
			nameInput?.focus();
			return;
		}
		formData.delete(FILE_FIELD[other]); // only send this card's file
		rememberName();
		status[kind] = { type: 'busy', text: `Uploading ${chosen[kind] || 'file'}…` };

		return async ({ result }) => {
			if (result.type === 'success' && result.data) {
				const { filename, version } = /** @type {any} */ (result.data);
				status[kind] = savedMessage(filename, version);
				clearFile(kind);
				// Show the new upload: drop "?<kind>=<old id>" if an older version was being viewed.
				const url = new URL(page.url);
				if (url.searchParams.has(kind)) {
					url.searchParams.delete(kind);
					await goto(url, { invalidateAll: true, noScroll: true, keepFocus: true });
				} else {
					await invalidateAll();
				}
			} else if (result.type === 'failure') {
				status[kind] = { type: 'err', text: `Nothing was saved. ${result.data?.error ?? 'The upload failed.'}` };
			} else {
				status[kind] = null;
				await applyAction(result);
			}
		};
	}

	// ----- what's being viewed -----

	const fc = $derived(data.forecast);
	const cm = $derived(data.commitments);
	const fs = $derived(fc.summary);
	const cs = $derived(cm.summary);
	const olderForecast = $derived(fc.selectedId !== null && fc.selectedId !== fc.latestId);
	const olderCommitments = $derived(cm.selectedId !== null && cm.selectedId !== cm.latestId);

	/**
	 * Link that views one version and keeps the other card's choice. The newest version needs no param.
	 * @param {Kind} kind
	 * @param {number} id
	 */
	function viewHref(kind, id) {
		const params = new URLSearchParams();
		const ids = {
			forecast: olderForecast ? fc.selectedId : null,
			commitments: olderCommitments ? cm.selectedId : null
		};
		ids[kind] = id === (kind === 'forecast' ? fc.latestId : cm.latestId) ? null : id;
		for (const k of /** @type {Kind[]} */ (['forecast', 'commitments'])) {
			if (ids[k] !== null) params.set(k, String(ids[k]));
		}
		const qs = params.toString();
		return qs ? `?${qs}` : '/';
	}

	/** @param {Kind} kind */
	function versionInfo(kind) {
		const d = kind === 'forecast' ? fc : cm;
		return d.versions.find((v) => v.id === d.selectedId);
	}

	const viewingText = $derived.by(() => {
		/** @type {string[]} */
		const parts = [];
		const f = versionInfo('forecast');
		const c = versionInfo('commitments');
		if (olderForecast && f) parts.push(`forecast version ${f.id}, uploaded ${timeAgo(f.uploadedAt, data.now)}`);
		if (olderCommitments && c) parts.push(`commitments version ${c.id}, uploaded ${timeAgo(c.uploadedAt, data.now)}`);
		return `Viewing an older version: ${parts.join(' and ')}.`;
	});

	const closedRange = $derived(
		fs?.firstMonth && fs.lastMonth
			? fs.firstMonth === fs.lastMonth
				? monthLabel(fs.firstMonth)
				: `${monthLabel(fs.firstMonth)} – ${monthLabel(fs.lastMonth)}`
			: ''
	);
</script>

<svelte:head>
	<title>Elevate 215 — Board Finance</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="wrap">
	<header class="topbar">
		<div class="brand">
			<div class="mark" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4 20L12 4L20 20" stroke="#8AF1FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M8 13H16" stroke="#8AF1FF" stroke-width="2" stroke-linecap="round" />
				</svg>
			</div>
			<div class="brand-text">
				<h1>Board finance</h1>
				<p>Elevate 215 · one source, not two</p>
			</div>
		</div>
		<div class="controls">
			<span class="live-pill" title="Refreshes on page load and after every upload">
				<span class="live-dot" aria-hidden="true"></span>Live
			</span>
		</div>
	</header>

	<main>
		{#if olderForecast || olderCommitments}
			<div class="viewing-banner">
				<span>{viewingText}</span>
				<a class="banner-btn" href="/">Back to latest</a>
			</div>
		{/if}

		<section class="merge-banner" aria-labelledby="merge-title">
			<svg class="merge-icon" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<rect x="2" y="4" width="14" height="14" rx="3" stroke="#8AF1FF" stroke-width="1.6" />
				<rect x="28" y="4" width="14" height="14" rx="3" stroke="#8AF1FF" stroke-width="1.6" />
				<path d="M9 18V24C9 27 11 29 14 29H30C33 29 35 27 35 24V18" stroke="#8AF1FF" stroke-width="1.6" />
				<rect x="13" y="29" width="18" height="12" rx="3" fill="#8AF1FF" />
				<path d="M18 35L21 38L26 32" stroke="#0B1C2C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			<div class="merge-copy">
				<h2 id="merge-title">QuickBooks forecast + grant commitments, one source</h2>
				<p>Upload a new export any time, nothing older ever gets deleted, every version stays on record below.</p>
			</div>
		</section>

		<!-- Headline numbers -->
		<div class="grid">
			<section class="card" aria-labelledby="stat-actual">
				<h2 class="stat-label" id="stat-actual">Actual vs budget</h2>
				<p class="stat-num display">{fs?.hasActuals ? shortMoney(fs.actual) : '—'}</p>
				{#if !fs}
					<p class="stat-sub">No uploads yet</p>
				{:else if !fs.hasActuals}
					<p class="stat-sub">No months with actuals yet</p>
				{:else if fs.pctOfBudget === null}
					<p class="stat-sub">No budget for the months with actuals</p>
				{:else}
					<p class="stat-sub">
						<span class={fs.actual >= fs.budget ? 'tag-up' : 'tag-down'}>
							<span aria-hidden="true">{fs.actual >= fs.budget ? '▲' : '▼'}</span>
							{fs.pctOfBudget}% of budget
						</span>
					</p>
					<p class="stat-note">
						{fs.monthCount}
						{fs.monthCount === 1 ? 'month' : 'months'} with actuals ({closedRange}), against the budget for those
						same months. Months that haven't closed are left out.
					</p>
				{/if}
			</section>

			<section class="card" aria-labelledby="stat-grants">
				<h2 class="stat-label" id="stat-grants">Grant commitments</h2>
				<p class="stat-num display">{cs ? shortMoney(cs.total) : '—'}</p>
				<p class="stat-sub">
					{#if cs}
						{cs.grantCount} {cs.grantCount === 1 ? 'grant' : 'grants'} · {shortMoney(cs.restricted)} restricted
					{:else}
						No uploads yet
					{/if}
				</p>
			</section>

			<section class="card" aria-labelledby="stat-split">
				<h2 class="stat-label" id="stat-split">Unrestricted vs restricted</h2>
				{#if cs && cs.restrictedPct !== null}
					<p class="stat-num display">
						<span aria-hidden="true">{cs.unrestrictedPct} / {cs.restrictedPct}</span>
						<span class="visually-hidden">{cs.unrestrictedPct}% unrestricted, {cs.restrictedPct}% restricted</span>
					</p>
					<p class="stat-sub">Share of grant commitments</p>
				{:else}
					<p class="stat-num display">—</p>
					<p class="stat-sub">{cs ? 'Nothing committed in this version' : 'No uploads yet'}</p>
				{/if}
			</section>
		</div>

		<!-- Charts -->
		<div class="panel-row">
			<section class="card" aria-labelledby="chart-dept">
				<h2 class="panel-title" id="chart-dept">Actual vs budget by department</h2>
				{#if fs?.hasActuals}
					<p class="panel-note">Months with actuals only: {closedRange}</p>
					<ChartCanvas
						type="bar"
						label={`Actual vs budget by department, ${closedRange}`}
						labels={fs.departments.map((d) => d.department)}
						series={[
							{ label: 'Actual', values: fs.departments.map((d) => d.actual), color: '--chart-actual' },
							{ label: 'Budget', values: fs.departments.map((d) => d.budget), color: '--chart-budget' }
						]}
					/>
				{:else}
					<p class="chart-empty">{fs ? 'No months with actuals yet' : 'No uploads yet'}</p>
				{/if}
			</section>

			<section class="card" aria-labelledby="chart-trend">
				<h2 class="panel-title" id="chart-trend">Actual across every upload</h2>
				{#if fc.trend.length}
					<p class="panel-note">Total actual in each forecast version, oldest to newest</p>
					<ChartCanvas
						type="line"
						label="Total actual in each forecast upload, oldest to newest"
						labels={fc.trend.map((t) => `${shortDate(t.uploadedAt)} · v${t.id}`)}
						series={[{ label: 'Total actual', values: fc.trend.map((t) => t.totalActual), color: '--chart-line' }]}
					/>
				{:else}
					<p class="chart-empty">No uploads yet</p>
				{/if}
			</section>
		</div>

		<!-- Grants table -->
		<section class="card table-card" aria-labelledby="grants-title">
			<h2 class="panel-title" id="grants-title">Commitments per grant</h2>
			<table>
				<thead>
					<tr>
						<th scope="col">Grant</th>
						<th scope="col">Funder</th>
						<th scope="col" class="num">Committed</th>
						<th scope="col">Restricted</th>
						<th scope="col" class="share-col">Share</th>
					</tr>
				</thead>
				<tbody>
					{#if cs && cs.grants.length}
						{#each cs.grants as g (g.grant)}
							<tr>
								<td>{g.grant}</td>
								<td>{g.funder}</td>
								<td class="num">{money(g.committed)}</td>
								<td>{g.restricted ? 'Yes' : 'No'}</td>
								<td class="share-col">
									{g.share}%
									<div class="pct-bar-track" aria-hidden="true">
										<div class="pct-bar-fill" style:width="{Math.min(g.share, 100)}%"></div>
									</div>
								</td>
							</tr>
						{/each}
					{:else}
						<tr><td colspan="5" class="empty-row">No uploads yet</td></tr>
					{/if}
				</tbody>
			</table>
			<p class="table-note">Share is each grant's part of all commitments. Spent to date will appear once payment records are uploaded.</p>
		</section>

		<!-- Uploads -->
		<section class="import-section" aria-labelledby="import-title">
			<h2 class="panel-title" id="import-title">Import new data</h2>

			<form method="POST" enctype="multipart/form-data" bind:this={uploadForm} use:enhance={onSubmit}>
				<div class="name-field">
					<label for="uploader">Your name</label>
					<input
						id="uploader"
						name="uploadedBy"
						type="text"
						autocomplete="name"
						aria-describedby="uploader-hint"
						bind:this={nameInput}
						bind:value={uploaderName}
						onchange={rememberName}
						onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
					/>
					<p class="hint" id="uploader-hint">Saved with each upload, so the version history shows who sent it.</p>
				</div>

				<div class="import-grid">
					{@render importCard({
						kind: 'forecast',
						title: 'Forecast workbook',
						desc: 'Excel (.xlsx): departments down the side, months across, with Budget, Actual and Forecast for each month.',
						template: '/templates/forecast.xlsx',
						versions: fc.versions,
						selectedId: fc.selectedId
					})}
					{@render importCard({
						kind: 'commitments',
						title: 'Grant commitments file',
						desc: 'Excel (.xlsx): Grant, Funder, Department, Restricted, then one column per month.',
						template: '/templates/commitments.xlsx',
						versions: cm.versions,
						selectedId: cm.selectedId
					})}
				</div>
			</form>
		</section>
	</main>

	<footer class="footer">
		<p>Visible to Stacy Holland, Priya, and the finance committee.</p>
	</footer>
</div>

{#snippet importCard(
	/** @type {{ kind: Kind, title: string, desc: string, template: string, versions: import('$lib/server/store/index.js').VersionInfo[], selectedId: number | null }} */ c
)}
	{@const msg = messageFor(c.kind)}
	{@const busy = msg?.type === 'busy'}
	<section class="card import-card" aria-labelledby="{c.kind}-title">
		<h3 id="{c.kind}-title">{c.title}</h3>
		<p class="desc" id="{c.kind}-desc">{c.desc}</p>

		<label
			class="drop-zone"
			class:drag={dragging[c.kind]}
			ondragenter={(e) => (e.preventDefault(), (dragging[c.kind] = true))}
			ondragover={(e) => e.preventDefault()}
			ondragleave={(e) => onDragLeave(c.kind, e)}
			ondrop={(e) => onDrop(c.kind, e)}
		>
			<span class="icn" aria-hidden="true">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
					<path d="M12 4V16M12 16L7 11M12 16L17 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M4 20H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</span>
			<span class="drop-text">
				{#if chosen[c.kind]}
					<b>{chosen[c.kind]}</b>
				{:else}
					Drop file here, or click to choose
				{/if}
			</span>
			<input
				class="visually-hidden"
				type="file"
				name={FILE_FIELD[c.kind]}
				accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				aria-describedby="{c.kind}-desc"
				bind:this={fileInputs[c.kind]}
				onchange={(e) => onFileChosen(c.kind, e)}
			/>
		</label>

		<div class="upload-status ok" role="status">
			{#if msg && msg.type !== 'err'}{msg.text}{/if}
		</div>
		<div class="upload-status err" role="alert">
			{#if msg?.type === 'err'}{msg.text}{/if}
		</div>

		<div class="import-actions">
			<button class="btn small" formaction="?/{c.kind}" bind:this={uploadButtons[c.kind]} disabled={busy}>
				{busy ? 'Uploading…' : 'Upload'}
			</button>
			<a class="btn ghost small" href={c.template} download>Download template</a>
		</div>

		<h4 class="history-title">Version history</h4>
		{#if c.versions.length}
			<ul class="history-list">
				{#each c.versions as v (v.id)}
					{@const active = v.id === c.selectedId}
					<li class="history-row" class:active>
						<span class="meta">
							<b>{v.filename}</b>
							<span class="sub">
								v{v.id} · {v.uploadedBy} ·
								<time datetime={v.uploadedAt} title={new Date(v.uploadedAt).toLocaleString('en-US')}>
									{timeAgo(v.uploadedAt, data.now)}
								</time>
								· {v.rowCount} rows
							</span>
						</span>
						{#if active}
							<span class="view-btn current" aria-current="true">Viewing</span>
						{:else}
							<a class="view-btn" href={viewHref(c.kind, v.id)} aria-label="View version {v.id}, {v.filename}">View</a>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-hist">No uploads yet.</p>
		{/if}
	</section>
{/snippet}

<style>
	/* ---- Tokens: the mockup's palette, plus a few text-safe shades (see notes) ---- */
	:global(:root) {
		--navy: #122f47;
		--navy-light: #1e4365;
		--cyan: #06b6cc;
		--cyan-bg: #8af1ff;
		--yellow: #b88a00;
		--yellow-bg: #ffe500;
		--bg: #f8f8f5;
		--panel: #ffffff;
		--ink: #122f47;
		/* darker than the mockup's 0.64 / 0.42 so small text passes 4.5:1 */
		--ink-soft: rgba(18, 47, 71, 0.74);
		--ink-faint: rgba(18, 47, 71, 0.68);
		--line: rgba(18, 47, 71, 0.12);
		--line-strong: rgba(18, 47, 71, 0.22);
		--radius: 14px;
		/* text versions of the accent colors (the bright ones fail contrast as text on white) */
		--cyan-ink: #0e7490;
		--yellow-ink: #5c4500;
		--danger: #c0392b;
		--chart-actual: var(--cyan);
		--chart-budget: var(--navy);
		--chart-line: var(--navy);
		color-scheme: light;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) {
			--navy: #0b1c2c;
			--navy-light: #16324a;
			--cyan: #8af1ff;
			--cyan-bg: #0f3a42;
			--yellow: #ffe500;
			--yellow-bg: #3a3005;
			--bg: #081420;
			--panel: #10263a;
			--ink: #f3f8fa;
			--ink-soft: rgba(243, 248, 250, 0.72);
			--ink-faint: rgba(243, 248, 250, 0.6);
			--line: rgba(255, 255, 255, 0.12);
			--line-strong: rgba(255, 255, 255, 0.22);
			--cyan-ink: #8af1ff;
			--yellow-ink: #ffe500;
			--danger: #ff8a80;
			--chart-budget: #8a96a0;
			--chart-line: var(--ink);
			color-scheme: dark;
		}
	}
	:global(:root[data-theme='dark']) {
		--navy: #0b1c2c;
		--navy-light: #16324a;
		--cyan: #8af1ff;
		--cyan-bg: #0f3a42;
		--yellow: #ffe500;
		--yellow-bg: #3a3005;
		--bg: #081420;
		--panel: #10263a;
		--ink: #f3f8fa;
		--ink-soft: rgba(243, 248, 250, 0.72);
		--ink-faint: rgba(243, 248, 250, 0.6);
		--line: rgba(255, 255, 255, 0.12);
		--line-strong: rgba(255, 255, 255, 0.22);
		--cyan-ink: #8af1ff;
		--yellow-ink: #ffe500;
		--danger: #ff8a80;
		--chart-budget: #8a96a0;
		--chart-line: var(--ink);
		color-scheme: dark;
	}

	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font-family: 'Public Sans', sans-serif;
		-webkit-font-smoothing: antialiased;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--cyan-ink);
		outline-offset: 2px;
	}

	/* ---- Layout ---- */
	.wrap {
		max-width: 1280px;
		margin: 0 auto;
		padding: 32px 40px 64px;
	}
	h1,
	h2,
	.display {
		font-family: 'Space Grotesk', sans-serif;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 24px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mark {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--navy);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.mark svg {
		width: 22px;
		height: 22px;
	}
	.brand-text h1 {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
	}
	.brand-text p {
		font-size: 13px;
		color: var(--ink-soft);
		margin: 2px 0 0;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.live-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		padding: 7px 12px;
		border-radius: 999px;
		background: var(--cyan-bg);
		color: var(--ink);
	}
	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--cyan);
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.live-dot {
			animation: none;
		}
	}

	.viewing-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background: var(--yellow-bg);
		color: var(--yellow-ink); /* mockup's #B88A00 on yellow is only 2.5:1; this is 7:1 */
		border-radius: 10px;
		padding: 10px 16px;
		margin-bottom: 16px;
		font-size: 13px;
		font-weight: 600;
	}
	.banner-btn {
		flex-shrink: 0;
		font-size: 13px;
		font-weight: 600;
		color: #122f47;
		background: white;
		border-radius: 8px;
		padding: 6px 12px;
		text-decoration: none;
	}
	.banner-btn:hover {
		background: #f0f4f6;
	}

	.merge-banner {
		display: flex;
		align-items: center;
		gap: 16px;
		background: var(--navy);
		color: white;
		border-radius: var(--radius);
		padding: 18px 22px;
		margin-bottom: 24px;
	}
	.merge-icon {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
	}
	.merge-copy h2 {
		font-size: 15px;
		font-weight: 600;
		margin: 0 0 3px;
		color: white;
	}
	.merge-copy p {
		font-size: 13px;
		margin: 0;
		color: rgba(255, 255, 255, 0.78);
		line-height: 1.5;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		margin-bottom: 24px;
	}
	.card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 20px 22px;
		min-width: 0;
	}
	.stat-label {
		font-family: 'Public Sans', sans-serif;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-faint);
		margin: 0 0 10px;
	}
	.stat-num {
		font-size: 30px;
		font-weight: 700;
		margin: 0;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.stat-sub {
		font-size: 13px;
		color: var(--ink-soft);
		margin: 8px 0 0;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.stat-note {
		font-size: 12px;
		color: var(--ink-faint);
		margin: 8px 0 0;
		line-height: 1.45;
	}
	.tag-up {
		color: var(--cyan-ink);
		font-weight: 700;
	}
	.tag-down {
		color: var(--ink);
		font-weight: 700;
	}

	.panel-row {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 16px;
		margin-bottom: 16px;
	}
	.panel-title {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 14px;
	}
	.panel-note {
		font-size: 12px;
		color: var(--ink-faint);
		margin: -8px 0 12px;
	}
	.chart-empty {
		height: 260px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		font-size: 13px;
		color: var(--ink-faint);
		border: 1.5px dashed var(--line);
		border-radius: 10px;
	}

	.table-card {
		margin-bottom: 24px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	th {
		text-align: left;
		font-weight: 600;
		color: var(--ink-faint);
		text-transform: uppercase;
		font-size: 11px;
		letter-spacing: 0.03em;
		padding: 0 12px 8px 0;
		border-bottom: 1px solid var(--line);
	}
	td {
		padding: 10px 12px 10px 0;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	tbody tr:hover td {
		background: color-mix(in srgb, var(--line) 35%, transparent);
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		padding-right: 32px;
	}
	.share-col {
		width: 22%;
		padding-right: 0;
		font-variant-numeric: tabular-nums;
	}
	.empty-row {
		color: var(--ink-faint);
		text-align: center;
		padding: 20px 0;
	}
	.pct-bar-track {
		width: 100%;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
		margin-top: 6px;
		overflow: hidden;
	}
	.pct-bar-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--cyan);
	}
	.table-note {
		font-size: 12px;
		color: var(--ink-faint);
		margin: 14px 0 0;
	}

	.btn {
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		color: white;
		background: var(--navy);
		border: none;
		border-radius: 10px;
		padding: 10px 16px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}
	.btn:hover {
		background: var(--navy-light);
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.btn.ghost {
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line-strong);
	}
	.btn.ghost:hover {
		background: var(--line);
	}
	.btn.small {
		font-size: 12px;
		padding: 7px 12px;
	}

	.import-section {
		margin-bottom: 24px;
	}
	.name-field {
		display: grid;
		grid-template-columns: auto 280px 1fr;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}
	.name-field label {
		font-size: 13px;
		font-weight: 600;
	}
	.name-field input {
		font: inherit;
		font-size: 14px;
		color: var(--ink);
		background: var(--panel);
		border: 1px solid var(--line-strong);
		border-radius: 8px;
		padding: 8px 10px;
	}
	.hint {
		font-size: 12px;
		color: var(--ink-faint);
		margin: 0;
	}
	.import-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.import-card h3 {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 4px;
	}
	.import-card p.desc {
		font-size: 12px;
		color: var(--ink-soft);
		margin: 0 0 14px;
		line-height: 1.45;
	}
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1.5px dashed var(--line-strong);
		border-radius: 10px;
		padding: 18px;
		text-align: center;
		margin-bottom: 12px;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.drop-zone:hover,
	.drop-zone.drag {
		border-color: var(--cyan);
		background: var(--cyan-bg);
	}
	.drop-zone:has(input:focus-visible) {
		outline: 2px solid var(--cyan-ink);
		outline-offset: 2px;
		border-color: var(--cyan);
	}
	.drop-text {
		margin-top: 6px;
		font-size: 12px;
		color: var(--ink-soft);
		overflow-wrap: anywhere;
	}
	.icn {
		color: var(--ink-faint);
	}
	.upload-status {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.45;
	}
	.upload-status:not(:empty) {
		margin-bottom: 10px;
	}
	.upload-status.ok {
		color: var(--cyan-ink);
	}
	.upload-status.err {
		color: var(--danger);
	}
	.import-actions {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}

	.history-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--ink-faint);
		margin: 0 0 4px;
	}
	.history-list {
		list-style: none;
		margin: 0;
		padding: 0 4px 0 0;
		max-height: 200px;
		overflow-y: auto;
	}
	.history-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
		font-size: 12px;
	}
	.history-row:last-child {
		border-bottom: none;
	}
	.meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--ink-soft);
	}
	.meta b {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.view-btn {
		flex-shrink: 0;
		font-size: 11px;
		font-weight: 600;
		color: var(--ink);
		background: var(--line);
		border-radius: 6px;
		padding: 5px 10px;
		text-decoration: none;
	}
	a.view-btn:hover {
		background: var(--line-strong);
	}
	.view-btn.current {
		background: var(--cyan-bg);
	}
	.empty-hist {
		font-size: 12px;
		color: var(--ink-faint);
		padding: 8px 0;
		margin: 0;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 8px;
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	.footer p {
		font-size: 12px;
		color: var(--ink-faint);
		margin: 0;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
