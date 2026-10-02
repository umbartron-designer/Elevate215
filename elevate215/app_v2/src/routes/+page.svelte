<!--
  The upload page: a tab for each upload, each showing its UploadPanel.
-->
<script>
	import KindIcon from '$lib/KindIcon.svelte';
	import UploadPanel from '$lib/UploadPanel.svelte';

	let { data, form } = $props();

	/** @type {'forecast' | 'commitments'} */
	let tab = $state('forecast');

	/** @type {{ kind: 'forecast' | 'commitments', label: string, sub: string }[]} */
	const TABS = [
		{ kind: 'forecast', label: 'Forecast workbook', sub: 'Finance · every month' },
		{ kind: 'commitments', label: 'Grant commitments', sub: 'Grants · twice a year' }
	];
</script>

<svelte:head>
	<title>Upload data · Elevate 215</title>
</svelte:head>

<header>
	<span class="logo">E</span>
	<span class="brand">Elevate 215</span>
	<span class="divider"></span>
	<span class="muted">Financial dashboard</span>
</header>

<main>
	<div class="intro">
		<h1>Upload data</h1>
		<p class="muted">
			Every upload is saved as a new numbered version. Earlier versions are kept and can be downloaded at any time.
		</p>
	</div>

	<div class="tabs" role="tablist">
		{#each TABS as t (t.kind)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t.kind}
				class:on={tab === t.kind}
				onclick={() => (tab = t.kind)}
			>
				<span class="tab-icon"><KindIcon kind={t.kind} /></span>
				<span class="tab-text">
					<strong>{t.label}</strong>
					<span class="muted">{t.sub}</span>
				</span>
			</button>
		{/each}
	</div>

	{#each TABS as t (t.kind)}
		<div role="tabpanel" hidden={tab !== t.kind}>
			<UploadPanel kind={t.kind} versions={data[t.kind]} result={form?.kind === t.kind ? form : null} />
		</div>
	{/each}
</main>

<style>
	:global(body) {
		margin: 0;
		min-width: 1100px;
		background: #dce2ea;
		color: #1d2433;
		font-family: 'Atkinson Hyperlegible', Helvetica, Arial, sans-serif;
	}
	.muted {
		color: #5a6475;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		height: 68px;
		padding: 0 48px;
		display: flex;
		align-items: center;
		gap: 14px;
		background: #f4f6f9;
		border-bottom: 1px solid #c9d0da;
		font-size: 17px;
	}
	.logo {
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background: #3b5bab;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 700;
	}
	.brand {
		font-size: 19px;
		font-weight: 700;
	}
	.divider {
		width: 1px;
		height: 22px;
		background: #c9d0da;
	}

	main {
		width: 960px;
		box-sizing: border-box;
		margin: 0 auto;
		padding: 44px 48px 64px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	h1 {
		margin: 0 0 8px;
		font-size: 34px;
		line-height: 1.15;
	}
	.intro p {
		margin: 0;
		font-size: 17px;
		line-height: 1.5;
		max-width: 640px;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.tabs button {
		font-family: inherit;
		text-align: left;
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 16px 18px;
		border-radius: 10px;
		cursor: pointer;
		background: #e4e8ee;
		border: 2px solid #c9d0da;
		color: #1d2433;
	}
	.tabs button.on {
		background: #f4f6f9;
		border-color: #3b5bab;
	}
	.tab-icon {
		width: 40px;
		height: 40px;
		border-radius: 9px;
		background: #d6dce5;
		color: #5a6475;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.on .tab-icon {
		background: #eaeef8;
		color: #3b5bab;
	}
	.tab-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 15px;
	}
	.tab-text strong {
		font-size: 18px;
	}
</style>
