<!--
  Small icon for each upload: three bars for the forecast, a page with lines for grant commitments.
  Takes its size from the font-size and its colour from the text colour of wherever it's placed.
-->
<script>
	/** @type {{ kind: 'forecast' | 'commitments' }} */
	let { kind } = $props();
</script>

{#if kind === 'forecast'}
	<span class="bars" aria-hidden="true"><i style="height: 45%"></i><i style="height: 73%"></i><i></i></span>
{:else}
	<span class="page" aria-hidden="true"><i></i><i></i><i class="short"></i></span>
{/if}

<style>
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 0.18em;
		height: 1em;
	}
	.bars i {
		width: 0.27em;
		height: 100%;
		background: currentColor;
		border-radius: 1px;
	}
	.page {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.13em;
		width: 0.8em;
		height: 1.05em;
		padding: 0 0.13em;
		border: 2px solid currentColor;
		border-radius: 3px;
		box-sizing: border-box;
	}
	.page i {
		height: 2px;
		background: currentColor;
	}
	.page .short {
		width: 60%;
	}
</style>
