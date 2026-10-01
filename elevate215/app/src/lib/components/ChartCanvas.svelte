<!--
	One Chart.js chart plus a visually hidden table of the same numbers for screen readers.
	Chart.js is loaded in the browser only (onMount). Colors come from the page's CSS variables,
	and the chart redraws when the data or the light/dark setting changes.
-->
<script>
	import { onMount } from 'svelte';
	import { money, shortMoney } from '$lib/format.js';

	/**
	 * @type {{
	 *   type: 'bar' | 'line',
	 *   label: string,                 // what the chart shows, used as its aria-label and table caption
	 *   labels: string[],              // x-axis categories
	 *   series: { label: string, values: number[], color: string }[]  // color = CSS variable name
	 * }}
	 */
	let { type, label, labels, series } = $props();

	/** @type {HTMLCanvasElement | undefined} */
	let canvas = $state();
	/** @type {any} the Chart class, once loaded */
	let ChartJs = $state(null);
	/** bumped when the color scheme changes, so the chart re-reads its colors */
	let scheme = $state(0);

	onMount(() => {
		let gone = false;
		import('chart.js/auto').then((m) => {
			if (!gone) ChartJs = m.default;
		});
		const dark = matchMedia('(prefers-color-scheme: dark)');
		const onScheme = () => scheme++;
		dark.addEventListener('change', onScheme);
		return () => {
			gone = true;
			dark.removeEventListener('change', onScheme);
		};
	});

	$effect(() => {
		if (!ChartJs || !canvas) return;
		void scheme;

		const css = getComputedStyle(canvas);
		/** @param {string} name */
		const color = (name) => css.getPropertyValue(name).trim();
		const ink = color('--ink-soft');
		const grid = color('--line');
		const surface = color('--panel');
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const font = { family: "'Public Sans', sans-serif", size: 12 };

		const chart = new ChartJs(canvas, {
			type,
			data: {
				labels,
				datasets: series.map((s) =>
					type === 'bar'
						? {
								label: s.label,
								data: s.values,
								backgroundColor: color(s.color),
								// a small gap between the Actual and Budget bars of each department
								categoryPercentage: 0.72,
								barPercentage: 0.88,
								borderRadius: 4,
								borderSkipped: 'start',
								maxBarThickness: 26
							}
						: {
								label: s.label,
								data: s.values,
								borderColor: color(s.color),
								backgroundColor: 'transparent',
								pointBackgroundColor: color('--cyan'),
								pointBorderColor: surface,
								pointBorderWidth: 2,
								pointRadius: 5,
								pointHoverRadius: 7,
								borderWidth: 2,
								tension: 0.3
							}
				)
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: reduceMotion ? false : { duration: 400 },
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: {
						display: series.length > 1,
						align: 'end',
						labels: { color: ink, font, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 }
					},
					tooltip: {
						callbacks: {
							/** @param {any} ctx */
							label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}`
						}
					}
				},
				scales: {
					x: { ticks: { color: ink, font }, grid: { display: false }, border: { color: grid } },
					y: {
						beginAtZero: true,
						ticks: { color: ink, font, callback: (/** @type {number} */ v) => shortMoney(v) },
						grid: { color: grid },
						border: { display: false }
					}
				}
			}
		});
		return () => chart.destroy();
	});
</script>

<div class="chart-box" role="img" aria-label={label}>
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<table class="visually-hidden">
	<caption>{label}</caption>
	<thead>
		<tr>
			<th scope="col">Item</th>
			{#each series as s (s.label)}<th scope="col">{s.label}</th>{/each}
		</tr>
	</thead>
	<tbody>
		{#each labels as l, i (i)}
			<tr>
				<th scope="row">{l}</th>
				{#each series as s (s.label)}<td>{money(s.values[i])}</td>{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.chart-box {
		position: relative;
		height: 260px;
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
