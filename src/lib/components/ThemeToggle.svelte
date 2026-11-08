<script lang="ts">
	import { onMount } from 'svelte';

	// The DS theme switch: self-contained Light/Dark pill. It reads/writes the shared
	// `theme` localStorage key (matching app.html's no-flash script) and applies
	// `data-theme` to <html> itself. Below the navbar's `m` breakpoint we flip it to
	// the DS `compact` (icon-only) mode so it fits the tight mobile bar.
	let isMobile = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(max-width: 47.99rem)');
		const update = () => (isMobile = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	// Reactive attachment: re-runs when `isMobile` changes, driving `compact` via the
	// property (Svelte would serialize `compact={false}` to `compact="false"`, which Lit
	// reads as truthy).
	function applyCompact(node: HTMLElement & { compact?: boolean }) {
		node.compact = isMobile;
	}
</script>

<gok-theme-switch {@attach applyCompact} label="Theme" storage-key="theme"></gok-theme-switch>
