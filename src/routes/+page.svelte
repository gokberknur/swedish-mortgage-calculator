<script lang="ts">
	import Setup from '$lib/components/Setup.svelte';
	import { formatCurrency } from '$lib/mortgage';
	import { createMortgageModel } from '$lib/mortgageModel.svelte';

	const m = createMortgageModel();
	const cmp = $derived(m.comparison);
	const best = $derived(m.verdict?.best);
	const win = $derived(best?.id);

	// The phone bar hides while the answer or the results are on screen, so it never repeats them.
	let answerInView = $state(false);
	let resultsInView = $state(false);
	const watch =
		(set: (v: boolean) => void, threshold = 0) =>
		(node: HTMLElement) => {
			const io = new IntersectionObserver(([e]) => set(e.isIntersecting), { threshold });
			io.observe(node);
			return () => io.disconnect();
		};

	// Pinned bars (the phone dock, the wide-screen ranking) reserve their height in the page's scroll
	// padding, so a focused field or table scrolls clear of them instead of hiding underneath.
	const padRoot =
		(side: 'Top' | 'Bottom', query = 'all') =>
		(node: HTMLElement) => {
			const root = document.documentElement;
			const mq = matchMedia(query);
			const set = () =>
				(root.style[`scrollPadding${side}`] = mq.matches ? `${node.offsetHeight + 8}px` : '');
			const ro = new ResizeObserver(set);
			ro.observe(node);
			mq.addEventListener('change', set);
			return () => {
				ro.disconnect();
				mq.removeEventListener('change', set);
				root.style[`scrollPadding${side}`] = '';
			};
		};

	const ranked = $derived(
		m.scenarios
			.filter((s) => m.rankedIds.includes(s.id))
			.map((s) => ({ ...s, net: cmp?.same[s.id].net ?? 0 }))
			.sort((a, b) => b.net - a.net)
	);
	const rankMax = $derived(Math.max(1, ...ranked.map((r) => r.net)));
	const signed = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`;

	// Plans left out of the ranking, by name: a bank would refuse them, or B has nothing to invest.
	const note = $derived.by(() => {
		if (m.loanAmount <= 0) return '';
		const out: string[] = [];
		const refused = m.scenarios.filter((s) => s.id !== 'A' && s.rate < m.minAmortization);
		if (refused.length)
			out.push(
				`${refused.map((s) => s.title).join(' and ')} ${refused.length > 1 ? "aren't" : "isn't"} ranked: raise amortization to ${m.minAmortization.toFixed(1)}%.`
			);
		if (i.bRate >= i.aRate)
			out.push(`Invest the difference isn't ranked: set its amortization below ${i.aRate}%.`);
		return out.join(' ');
	});
	// A winner that also costs more each month says so on its row.
	const extra = $derived.by(() => {
		const w = m.scenarios.find((s) => s.id === win);
		return w ? w.mortgageCost - m.scenarios[0].mortgageCost : 0;
	});
	const i = $derived(m.inputs);
	type Plan = (typeof m.scenarios)[number];
	const rows: [string, (s: Plan) => string][] = [
		['Monthly cost', (s) => formatCurrency(s.mortgageCost)],
		['Amortization / month', (s) => formatCurrency(s.amort)],
		['Invested / month', (s) => formatCurrency(s.invest)],
		['Paid off in', (s) => s.payoff.display],
		['Interest paid', (s) => formatCurrency(cmp?.same[s.id].interestPaid ?? 0)],
		['Investment value', (s) => formatCurrency(cmp?.same[s.id].investment ?? 0)]
	];
	// Inputs no bank would accept leave the answer empty; the field errors say what to fix.
	const invalid = $derived(!!m.downPaymentError || m.loanAmount <= 0 || !m.meetsRequirement);
	// Detail columns lead with the winner, so a narrow table never hides it.
	const columns = $derived([
		...ranked,
		...m.scenarios.filter((s) => !ranked.some((r) => r.id === s.id))
	]);
	const headline = $derived(
		ranked.length === 1
			? 'Only Pay it down qualifies.'
			: (m.verdict?.lead ?? 0) < 1
				? 'The plans come out even.'
				: `${best?.title} comes out ahead.`
	);
	const winNet = $derived(win && cmp ? cmp.same[win].net : 0);
</script>

<svelte:head>
	<title>Swedish Mortgage Calculator</title>
	<meta
		name="description"
		content="Pay off your Swedish mortgage faster, or invest instead? Compare three plans."
	/>
</svelte:head>

<div class="page-head">
	<h1 class="gok-headline-1">Swedish Mortgage Calculator</h1>
	<p>Pay off your mortgage faster, or invest instead?</p>
</div>

<!-- Always present, so a returning answer is announced; empty while the inputs are invalid. -->
<p class="vh" role="status">
	{#if cmp && best && !invalid}{headline}{#if win !== 'A'}{` ${signed(winNet)} vs Pay it down.`}{/if}{/if}
</p>

<div
	class="split"
	{@attach (n: HTMLElement) => {
		// The pinned column leaves room for the footer only once the footer is on screen.
		const set = () =>
			n.style.setProperty(
				'--below',
				`${Math.max(0, innerHeight - n.getBoundingClientRect().bottom)}px`
			);
		set();
		const ro = new ResizeObserver(set);
		ro.observe(document.body);
		addEventListener('scroll', set, { passive: true });
		return () => {
			ro.disconnect();
			removeEventListener('scroll', set);
		};
	}}
>
	<aside class="inputs" aria-label="Your numbers">
		<Setup model={m} />
	</aside>
	{#if best && !invalid && !resultsInView && !answerInView}
		<a class="dock" href="#results" {@attach padRoot('Bottom')}>
			<span>
				<b>{ranked.length === 1 ? 'Only Pay it down qualifies' : `${best.title} ahead`}</b>
				{#if win !== 'A'}<span class="dock-lead">{signed(winNet)} vs Pay it down</span>{/if}
			</span>
			<span class="dock-cta">See results</span>
		</a>
	{/if}

	<div
		class="right"
		{@attach (n: HTMLElement) => {
			const ro = new ResizeObserver(() =>
				n.classList.toggle('scrolls', n.scrollHeight > n.clientHeight + 1)
			);
			ro.observe(n);
			for (const c of n.children) ro.observe(c);
			return () => ro.disconnect();
		}}
	>
		<div class="answer" {@attach watch((v) => (answerInView = v))}>
			{#if cmp && best && !invalid}
				<section class="verdict">
					<span class="meta-label">In {cmp.payoffDisplay}</span>
					<h2 class="statement">{headline}</h2>
					{#if win !== 'A'}<p class="lead" aria-hidden="true">
							{signed(winNet)} vs Pay it down
						</p>{/if}
				</section>
			{/if}
		</div>

		<div class="results" id="results">
			{#if invalid}
				<!-- The field error says what to fix; there is no answer for a loan no bank would grant. -->
			{:else if cmp && best}
				<div class="rank-wrap" {@attach watch((v) => (resultsInView = v), 1)}>
					{#if ranked.length > 1}<p class="meta-label rank-cap" id="rank-cap">
							Net position vs Pay it down, before ISK tax
						</p>
						<ol class="rank" aria-labelledby="rank-cap">
							{#each ranked as r (r.id)}
								<li class:win={win === r.id}>
									<span class="tag" aria-hidden="true">{r.tag}</span>
									<span class="name"
										>{r.title}{#if win === r.id}{#if extra >= 1}<span class="extra"
													>{` · ${formatCurrency(extra)} more a month`}</span
												>{/if}{/if}</span
									>
									<span class="val" class:neg={r.net < 0}>{signed(r.net)}</span>
									<span class="bar" aria-hidden="true"
										><i style:inline-size="{(Math.max(0, r.net) / rankMax) * 100}%"></i></span
									>
								</li>
							{/each}
						</ol>{/if}
					{#if note}<p class="rank-warn">⚠ {note}</p>{/if}
				</div>

				<gok-accordion class="more">
					<gok-accordion-item heading-level="2">
						<span slot="summary">Compare in detail</span>
						<!-- A scrollable region must be focusable so keyboard users can scroll it on phones. -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div class="table-scroll" role="region" aria-label="Plan comparison" tabindex="0">
							<table class="compare">
								<thead>
									<tr>
										<th scope="col"><span class="vh">Metric</span></th>
										{#each columns as s (s.id)}
											<th scope="col" class:win={win === s.id}>
												<span class="meta-label sc-tag">{s.tag}</span>
												<span class="sc-title">{s.title}</span>
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each rows as [label, cell] (label)}
										<tr
											><th scope="row">{label}</th>{#each columns as s (s.id)}<td
													class:win={win === s.id}>{cell(s)}</td
												>{/each}</tr
										>
									{/each}
								</tbody>
							</table>
						</div>
						<p class="fine">Costs and interest before ränteavdrag; investments before ISK tax.</p>
					</gok-accordion-item>
					<gok-accordion-item heading-level="2">
						<span slot="summary">How it's calculated</span>
						<ul class="assume">
							<li>Every plan is judged on the day Pay it down clears the loan.</li>
							<li>
								Net position: investment value, minus remaining debt, minus the extra interest
								(after ränteavdrag) a plan pays compared with Pay it down.
							</li>
							<li>
								Amortization is a fixed share of the original loan. Interest and returns stay
								constant.
							</li>
							<li>
								Ränteavdrag: 30% of the first 100 000 kr of yearly interest per borrower, 21% above.
							</li>
						</ul>
					</gok-accordion-item>
				</gok-accordion>
				<p class="disclaimer">For information only, not financial advice.</p>
			{:else}
				<gok-alert status="info" class="notice"
					>Set Pay it down's amortization above 0%. At 0% the loan is never repaid, so there is no
					date to compare the plans at.</gok-alert
				>
			{/if}
		</div>
	</div>
</div>

<style>
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--gok-space-800, 48px);
	}
	.results {
		container-type: inline-size;
		min-inline-size: 0;
	}
	/* Phones read top to bottom: answer, inputs, details. The answer is moved first visually; it
	   holds no controls, so the keyboard order still runs inputs, then details. Wide screens put
	   the inputs on the left, beside the answer and the details. */
	.right {
		display: contents;
	}
	.answer {
		order: -1;
	}
	@media (min-width: 900px) {
		.split {
			grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
			grid-template-areas: 'inputs right';
			gap: var(--gok-space-600, 32px) var(--gok-space-900, 64px);
		}
		.inputs {
			grid-area: inputs;
		}
		/* The verdict and the results pin together beside the inputs; if they outgrow the screen,
		   the column scrolls on its own. */
		.right {
			grid-area: right;
			position: sticky;
			top: var(--gok-space-400, 16px);
			align-self: start;
			max-block-size: calc(100dvh - 2 * var(--gok-space-400, 16px) - var(--below, 0px));
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: var(--gok-space-600, 32px);
		}
		.lead {
			display: none;
		}
		.right:global(.scrolls) .answer {
			background: var(--gok-color-bg, var(--gok-color-surface));
		}
		/* If the details make the column scroll, the verdict stays at its top. */
		.answer {
			position: sticky;
			top: 0;
			z-index: 1;
		}
	}
	.lead {
		margin: var(--gok-space-300, 12px) 0 0;
		font-family: var(--gok-font-family-mono);
		font-variant-numeric: tabular-nums;
		color: var(--gok-color-text-muted);
	}
	.fine {
		margin: var(--gok-space-300, 12px) 0 0;
		font-size: var(--gok-type-caption-size, 0.75rem);
		color: var(--gok-color-text-muted);
	}
	.rank .extra {
		color: var(--gok-color-text-muted);
		font-size: var(--gok-type-body-small-size, 14px);
	}
	.answer:empty {
		display: none;
	}
	.rank-cap {
		margin: 0 0 var(--gok-space-300, 12px);
	}
	.results > :first-child {
		margin-top: 0;
	}
	.verdict {
		margin: 0;
	}
	.rank {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--gok-space-300, 12px);
		max-inline-size: 36rem;
	}
	.rank li {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) auto;
		gap: var(--gok-space-100, 4px) var(--gok-space-300, 12px);
		align-items: center;
	}
	.rank-wrap {
		margin-top: 0;
	}
	.rank-warn {
		margin: var(--gok-space-200, 8px) 0 0;
		font-size: var(--gok-type-body-small-size, 14px);
	}
	.rank .val {
		font-family: var(--gok-font-family-mono);
		font-variant-numeric: tabular-nums;
	}
	.rank .bar {
		grid-column: 2 / 4;
		block-size: 6px;
		background: var(--gok-color-border);
	}
	.rank .bar i {
		display: block;
		block-size: 100%;
		background: var(--gok-color-border-strong, var(--gok-color-text-muted));
	}
	.rank .win :global(.tag) {
		border-color: var(--gok-color-primary);
		color: var(--gok-color-primary);
	}
	.rank .win .val {
		color: var(--gok-color-primary);
		font-weight: var(--gok-font-weight-semibold, 600);
	}
	.rank .win .bar i {
		background: var(--gok-color-primary);
	}
	.dock {
		display: none;
	}
	@media (max-width: 899.98px) {
		.dock {
			display: flex;
			position: fixed;
			inset: auto 0 0;
			z-index: 10;
			justify-content: space-between;
			align-items: center;
			gap: var(--gok-space-300, 12px);
			padding: var(--gok-space-300, 12px)
				max(var(--gok-container-inline-pad, 16px), env(safe-area-inset-right))
				calc(var(--gok-space-300, 12px) + env(safe-area-inset-bottom))
				max(var(--gok-container-inline-pad, 16px), env(safe-area-inset-left));
			background: var(--gok-color-surface);
			border-top: 1px solid var(--gok-color-border-strong, var(--gok-color-border));
			color: var(--gok-color-text);
			text-decoration: none;
		}
		.dock b {
			display: block;
			font-weight: var(--gok-font-weight-semibold, 600);
		}
		.dock-lead {
			font-family: var(--gok-font-family-mono);
			color: var(--gok-color-primary);
			font-variant-numeric: tabular-nums;
			font-size: var(--gok-type-body-small-size, 14px);
		}
		.dock-cta {
			flex: none;
			padding: var(--gok-space-200, 8px) var(--gok-space-300, 12px);
			border: 1px solid var(--gok-color-border-strong, var(--gok-color-border));
			border-radius: var(--gok-radius-s);
			font-size: var(--gok-type-body-small-size, 14px);
		}
	}
	.statement {
		margin: var(--gok-space-300, 12px) 0 0;
		font-size: clamp(2rem, 5vw, 3.5rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
		font-weight: var(--gok-font-weight-medium, 500);
		text-wrap: balance;
		max-width: 18ch;
	}
	/* gok-accordion-item sizes slotted content to itself, so the table claims the full width. */
	.table-scroll:focus-visible {
		outline-offset: -2px;
	}
	.table-scroll {
		inline-size: 100%;
		overflow-x: auto;
	}
	.compare {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.compare th,
	.compare td {
		font-family: var(--gok-font-family-mono);
		padding: var(--gok-space-300, 12px);
		text-align: right;
		border-bottom: 1px solid var(--gok-color-border);
		vertical-align: baseline;
	}
	.compare thead th {
		border-bottom: 1px solid var(--gok-color-border-strong, var(--gok-color-border));
	}
	.compare th[scope='row'] {
		text-align: left;
		font-weight: 400;
		color: var(--gok-color-text-muted);
		min-inline-size: 6rem;
	}
	.compare td {
		white-space: nowrap;
	}
	.sc-tag {
		display: block;
	}
	.sc-title {
		font-weight: var(--gok-font-weight-medium, 500);
	}
	@container (max-width: 600px) {
		.compare th,
		.compare td {
			padding: var(--gok-space-300, 12px) var(--gok-space-200, 8px);
			text-align: start;
		}
		.compare th[scope='row'],
		.compare thead th:first-child {
			position: sticky;
			inset-inline-start: 0;
			background: var(--gok-color-surface-overlay, var(--gok-color-surface));
			backdrop-filter: var(--gok-surface-backdrop, none);
			white-space: normal;
			min-inline-size: 5rem;
		}
	}
	.compare .win {
		box-shadow: inset 2px 0 0 0 var(--gok-color-primary);
		background: var(--gok-color-accent-subtle, transparent);
	}
	.neg {
		color: var(--gok-color-status-error-text);
	}
	.notice {
		display: block;
		margin-top: var(--gok-space-800, 48px);
	}
	.more {
		margin-top: var(--gok-space-700, 40px);
	}
	.assume {
		margin: 0;
		padding-left: var(--gok-space-500, 24px);
		display: flex;
		flex-direction: column;
		gap: var(--gok-space-200, 8px);
		font-size: var(--gok-type-body-small-size, 14px);
		color: var(--gok-color-text-muted);
	}
	.disclaimer {
		margin-top: var(--gok-space-700, 40px);
		font-size: var(--gok-type-caption-size, 0.75rem);
		font-style: italic;
		color: var(--gok-color-text-muted);
	}
</style>
