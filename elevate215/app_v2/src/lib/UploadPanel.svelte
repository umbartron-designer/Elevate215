<!--
  One upload (forecast or grant commitments): choose a file, enter a name, upload,
  see saved / rejected, and the version history underneath.
-->
<script>
	import { enhance } from '$app/forms';
	import KindIcon from '$lib/KindIcon.svelte';
	import { tipFor } from '$lib/tips.js';

	/**
	 * @typedef {{ id: number, uploadedBy: string, filename: string, rowCount: number, date: string, time: string }} Version
	 * @typedef {{ kind: string, saved: true, id: number, rowCount: number }
	 *   | { kind: string, saved: false, type: string, reason: string }} Result
	 * @type {{ kind: 'forecast' | 'commitments', versions: Version[], result: Result | null }}
	 */
	let { kind, versions, result } = $props();

	const TEXT = {
		forecast: {
			title: 'Forecast workbook',
			noun: 'forecast',
			dropNoun: 'forecast workbook',
			subtitle: 'Uploaded monthly by Finance. 9 departments, with budget, actual and forecast for each month.'
		},
		commitments: {
			title: 'Grant commitments',
			noun: 'grant commitments',
			dropNoun: 'grant commitments file',
			subtitle:
				'Uploaded twice a year by Grants. One row per grant: funder, department, restricted (Yes/No) and the amount committed each month.'
		}
	};
	const text = $derived(TEXT[kind]);

	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();
	/** @type {{ name: string, size: string } | null} */
	let file = $state(null);
	let name = $state('');
	let uploading = $state(false);
	let dragging = $state(false);

	const nextVersion = $derived((versions[0]?.id ?? 0) + 1);
	const ready = $derived(file !== null && name.trim() !== '' && !uploading);
	const hint = $derived(
		!file && !name.trim()
			? 'Choose a file and enter your name to upload.'
			: !file
				? 'Choose a file to upload.'
				: 'Enter your name to upload.'
	);
	// The version just saved, for the "Uploaded by ... on ..." line.
	const savedVersion = $derived(result?.saved ? versions.find((v) => v.id === result.id) : undefined);

	/** @param {number} id */
	const isNew = (id) => result?.saved === true && result.id === id;

	/** @param {File | undefined} f */
	function choose(f) {
		file = f ? { name: f.name, size: Math.max(1, Math.round(f.size / 1024)) + ' KB' } : null;
	}

	function pick() {
		if (!uploading) fileInput?.click();
	}

	/** @param {DragEvent} e */
	function drop(e) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (fileInput && files?.length) {
			fileInput.files = files; // put the dropped file into the form's file field
			choose(files[0]);
		}
	}

	function removeFile() {
		if (fileInput) fileInput.value = '';
		file = null;
	}

	/** Runs when the form is sent: show "Uploading", then clear the file once the answer is back. */
	/** @type {import('@sveltejs/kit').SubmitFunction} */
	const submit = () => {
		uploading = true;
		return async ({ update }) => {
			await update({ reset: false }); // keep the name filled in
			uploading = false;
			removeFile();
		};
	};
</script>

<section class="card">
	<div class="head">
		<div class="icon"><KindIcon {kind} /></div>
		<div>
			<h2>{text.title}</h2>
			<p class="muted">{text.subtitle}</p>
		</div>
	</div>

	<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance={submit}>
		<input type="hidden" name="kind" value={kind} />
		<input
			bind:this={fileInput}
			type="file"
			name="file"
			accept=".xlsx"
			hidden
			onchange={(e) => choose(e.currentTarget.files?.[0])}
		/>

		{#if file}
			<div class="chosen">
				<span class="badge">XLSX</span>
				<div class="grow">
					<span class="muted small">File chosen</span>
					<strong class="filename">{file.name}</strong>
					<span class="muted small">{file.size}</span>
				</div>
				{#if !uploading}
					<button type="button" class="secondary" onclick={pick}>Change file</button>
					<button type="button" class="quiet" onclick={removeFile}>Remove</button>
				{/if}
			</div>
		{:else}
			<button
				type="button"
				class="drop"
				class:dragging
				onclick={pick}
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={drop}
			>
				<strong class="big">
					{result && !result.saved ? 'Drag the corrected file here' : `Drag your ${text.dropNoun} here`}
				</strong>
				<span class="muted">or</span>
				<span class="choose">Choose file</span>
				<span class="muted small">Excel workbook (.xlsx)</span>
			</button>
		{/if}

		<div class="row">
			<label class="name">
				<span>Your name</span>
				<input name="name" bind:value={name} readonly={uploading} placeholder="Full name" autocomplete="name" />
			</label>
			<button type="submit" class="primary" disabled={!ready}>
				{uploading ? 'Uploading…' : `Upload as version ${nextVersion}`}
			</button>
		</div>
		{#if !ready && !uploading}
			<p class="hint muted">{hint}</p>
		{/if}
	</form>

	{#if uploading}
		<div class="status uploading" role="status">
			<strong class="big">Uploading {file?.name}…</strong>
			<span class="muted">Checking the file before saving. This takes a few seconds.</span>
			<div class="bar"><div></div></div>
		</div>
	{:else if result?.saved}
		<div class="status saved" role="status">
			<span class="check" aria-hidden="true">✓</span>
			<div class="stack">
				<strong class="big">Saved {text.noun} version {result.id}: {result.rowCount} rows.</strong>
				{#if savedVersion}
					<span>Uploaded by {savedVersion.uploadedBy} on {savedVersion.date}. It is now at the top of the list below.</span>
				{/if}
			</div>
		</div>
	{:else if result}
		<div class="status rejected" role="alert">
			<span class="label">Not saved: please fix the file</span>
			<strong class="reason">{result.reason}</strong>
			<div class="stack">
				<strong>What to do</strong>
				<span>{tipFor(kind, result.type)}</span>
			</div>
			<span class="muted">Nothing was saved. The version history below is unchanged.</span>
		</div>
	{/if}
</section>

<section class="card history">
	<div class="history-head">
		<h3>Version history</h3>
		{#if versions.length}
			<span class="muted">{versions.length} {versions.length === 1 ? 'version' : 'versions'}, newest first</span>
		{/if}
	</div>

	{#if versions.length === 0}
		<div class="empty">
			<strong class="big">No versions yet</strong>
			<span class="muted">Your first upload will be saved as version 1.</span>
		</div>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Version</th>
					<th>Uploaded</th>
					<th>By</th>
					<th>File</th>
					<th class="num">Rows</th>
					<th><span class="sr-only">Download</span></th>
				</tr>
			</thead>
			<tbody>
				{#each versions as v (v.id)}
					<tr class:new={isNew(v.id)}>
						<td>
							<strong>v{v.id}</strong>
							{#if isNew(v.id)}<span class="new-badge">New</span>{/if}
						</td>
						<td>{v.date}<br /><span class="muted small">{v.time}</span></td>
						<td>{v.uploadedBy}</td>
						<td class="file">{v.filename}</td>
						<td class="num">{v.rowCount}</td>
						<td class="right"><a class="download" href="/download/{kind}/{v.id}" download>Download</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.card {
		background: #f4f6f9;
		border: 1px solid #dde2ea;
		border-radius: 12px;
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.history {
		padding: 24px 28px;
		gap: 14px;
		margin-top: 20px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 24px;
		line-height: 1.2;
	}
	h3 {
		margin: 0;
		font-size: 20px;
	}
	p {
		margin: 0;
	}
	.muted {
		color: #5a6475;
	}
	.small {
		font-size: 14px;
	}
	.big {
		font-size: 18px;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.head {
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}
	.head p {
		font-size: 16px;
		line-height: 1.45;
		max-width: 620px;
	}
	.icon {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		background: #eaeef8;
		color: #3b5bab;
		font-size: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	button,
	input {
		font-family: inherit;
	}

	.drop {
		border: 2px dashed #c3cee9;
		background: #e9edf2;
		border-radius: 10px;
		padding: 32px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		color: inherit;
		font-size: 16px;
	}
	.drop.dragging {
		border-color: #3b5bab;
		background: #eaeef8;
	}
	.choose {
		border: 1px solid #3b5bab;
		color: #3b5bab;
		background: #f4f6f9;
		border-radius: 8px;
		padding: 9px 18px;
		font-weight: 700;
	}
	.drop:hover .choose {
		background: #eaeef8;
	}

	.chosen {
		border: 1px solid #c3cee9;
		background: #e9edf2;
		border-radius: 10px;
		padding: 16px 18px;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.badge {
		width: 40px;
		height: 48px;
		border-radius: 6px;
		background: #f4f6f9;
		border: 1px solid #c3cee9;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
		box-sizing: border-box;
		font-size: 11px;
		font-weight: 700;
		color: #3b5bab;
		letter-spacing: 0.04em;
		flex: none;
	}
	.grow {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.filename {
		font-size: 18px;
		overflow-wrap: anywhere;
	}
	.secondary,
	.quiet {
		font-size: 16px;
		border-radius: 8px;
		padding: 8px 14px;
		cursor: pointer;
		background: transparent;
	}
	.secondary {
		color: #3b5bab;
		border: 1px solid #c3cee9;
	}
	.secondary:hover {
		background: #eaeef8;
	}
	.quiet {
		color: #5a6475;
		border: 1px solid transparent;
	}
	.quiet:hover {
		background: #eef1f5;
	}

	.row {
		display: flex;
		gap: 16px;
		align-items: flex-end;
	}
	.name {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
		max-width: 360px;
		font-size: 16px;
		font-weight: 700;
	}
	.name input {
		font-size: 17px;
		font-weight: 400;
		color: #1d2433;
		padding: 11px 12px;
		border: 1px solid #c6cdd8;
		border-radius: 8px;
		background: #f4f6f9;
		outline-color: #3b5bab;
	}
	.primary {
		font-size: 17px;
		font-weight: 700;
		color: #ffffff;
		background: #3b5bab;
		border: 1px solid #3b5bab;
		border-radius: 8px;
		padding: 12px 22px;
		cursor: pointer;
	}
	.primary:hover:not(:disabled) {
		background: #314d93;
	}
	.primary:disabled {
		color: #8a93a3;
		background: #eef1f5;
		border-color: #dde2ea;
		cursor: not-allowed;
	}
	.hint {
		font-size: 15px;
		margin-top: -10px;
	}

	.status {
		display: flex;
		gap: 12px;
		padding: 16px 18px;
		border-radius: 10px;
		font-size: 15px;
	}
	.uploading {
		flex-direction: column;
		gap: 10px;
		background: #e9edf2;
		border: 1px solid #dde2ea;
	}
	.bar {
		height: 6px;
		border-radius: 3px;
		background: #e1e6f0;
		overflow: hidden;
		position: relative;
	}
	.bar div {
		position: absolute;
		inset: 0 auto 0 0;
		width: 40%;
		border-radius: 3px;
		background: #3b5bab;
		animation: slide 1.4s ease-in-out infinite;
	}
	@keyframes slide {
		from {
			transform: translateX(-110%);
		}
		to {
			transform: translateX(260%);
		}
	}
	.saved {
		align-items: flex-start;
		gap: 14px;
		background: #ebf5ef;
		border: 1px solid #bfdcc9;
		color: #2f4a3b;
	}
	.saved strong {
		color: #1f5a3a;
	}
	.check {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #2f7d52;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		flex: none;
	}
	.rejected {
		flex-direction: column;
		padding: 18px 20px;
		background: #fbf5e8;
		border: 1px solid #ead6a6;
		font-size: 16px;
		line-height: 1.45;
	}
	.label {
		font-size: 14px;
		font-weight: 700;
		color: #74510f;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.reason {
		font-size: 19px;
		line-height: 1.35;
	}
	.rejected .muted {
		font-size: 15px;
	}

	.history-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		font-size: 15px;
	}
	.empty {
		padding: 28px 20px;
		border-radius: 10px;
		background: #e9edf2;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 15px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 16px;
	}
	th {
		text-align: left;
		font-size: 14px;
		color: #5a6475;
		padding: 0 12px 10px;
		border-bottom: 1px solid #dde2ea;
	}
	td {
		padding: 12px;
		border-bottom: 1px solid #eceff4;
		vertical-align: middle;
	}
	tr.new td {
		background: #f2f8f4;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.right {
		text-align: right;
	}
	.file {
		overflow-wrap: anywhere;
	}
	.new-badge {
		margin-left: 8px;
		font-size: 12px;
		font-weight: 700;
		color: #1f5a3a;
		background: #d7ecdf;
		border-radius: 999px;
		padding: 2px 8px;
	}
	.download {
		font-size: 14px;
		color: #3b5bab;
		border: 1px solid #c3cee9;
		border-radius: 8px;
		padding: 6px 10px;
		text-decoration: none;
	}
	.download:hover {
		background: #eaeef8;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
