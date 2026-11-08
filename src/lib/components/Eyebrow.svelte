<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<p class="eyebrow gok-eyebrow">
	<span class="eyebrow__rule" aria-hidden="true" data-morph="rule"></span>
	<span data-morph="label">{text}</span>
</p>

<style>
	.eyebrow {
		display: flex;
		align-items: center;
		gap: var(--gok-space-300, 12px);
		margin: 0 0 var(--gok-space-400, 16px);
		color: var(--gok-color-text-muted);
	}

	.eyebrow__rule {
		display: inline-block;
		inline-size: 24px;
		block-size: 2px;
		background: var(--gok-color-primary);
		flex-shrink: 0;
	}
</style>
