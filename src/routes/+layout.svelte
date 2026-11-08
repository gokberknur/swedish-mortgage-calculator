<script lang="ts">
	// Design-system foundations: fonts, tokens, typography, layout utilities.
	import '@gokberknur/design-system/fonts.css';
	import '@gokberknur/design-system/tokens.css';
	import '@gokberknur/design-system/typography.css';
	import '@gokberknur/design-system/layout.css';
	import '../app.css';

	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();

	onMount(() => {
		// Register every gok-* custom element. Browser-only, so it must not run during prerender.
		// @ts-expect-error - side-effect-only registration bundle, no type declarations
		import('@gokberknur/design-system/standalone');
	});
</script>

<header class="app-bar">
	<a class="meta-label" href="https://gokberk.se">gökberk.se</a>
	<ThemeToggle />
</header>
<main class="app-main">
	{@render children()}
</main>
<footer class="app-foot">
	<span class="meta-label"
		>By <a href="https://gokberk.se">Gökberk Nur</a> ·
		<a href="https://github.com/gokberknur/swedish-mortgage-calculator">Source</a></span
	>
</footer>
