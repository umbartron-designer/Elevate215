<script>
	import { enhance } from '$app/forms';

	/** @type {{ form: import('./$types').ActionData }} */
	let { form } = $props();
	let uploading = $state(false);
</script>

<svelte:head>
	<title>Financials Upload</title>
</svelte:head>

<main>
	<h1>Upload forecast workbook</h1>

	<form
		method="POST"
		enctype="multipart/form-data"
		use:enhance={() => {
			uploading = true;
			return async ({ update }) => {
				await update();
				uploading = false;
			};
		}}
	>
		<label>
			Workbook (.xlsx)
			<input type="file" name="workbook" accept=".xlsx" required />
		</label>
		<label>
			Uploaded by
			<input type="text" name="uploadedBy" required />
		</label>
		<button disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
	</form>

	{#if form?.error}
		<p class="error" role="alert">Nothing was saved. {form.error}</p>
	{:else if form?.version}
		<p class="ok" role="status">
			Saved version {form.version.id} on {new Date(form.version.uploadedAt).toLocaleString()}
			({form.version.rowCount} rows).
		</p>
	{/if}
</main>

<style>
	main {
		max-width: 32rem;
		margin: 3rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	form {
		display: grid;
		gap: 1rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	.error {
		color: #b00020;
	}
	.ok {
		color: #1b6e20;
	}
</style>
