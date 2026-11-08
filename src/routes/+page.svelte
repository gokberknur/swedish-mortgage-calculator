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
	const watch = (set: (v: boolean) => void) => (node: HTMLElement) => {
		const io = new IntersectionObserver(([e]) => set(e.isIntersecting));
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
				`${refused.map((s) => s.title).join(' and ')} ${refused.length > 1 ? 'are' : 'is'} below the ${m.minAmortization.toFixed(1)}% minimum`
			);
		if (i.bRate >= i.aRate) out.push('Invest the difference needs a lower rate than Pay it down');
		return out.length ? `${out.join('. ')}.` : '';
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

<div class="split">
	<div
		class="answer"
		{@attach watch((v) => (answerInView = v))}
		{@attach (n: HTMLElement) => {
			const ro = new ResizeObserver(() =>
				n.parentElement!.style.setProperty('--answer-h', `${n.offsetHeight + 24}px`)
			);
			ro.observe(n);
			return () => ro.disconnect();
		}}
	>
		{#if cmp && best && !invalid}
			<section class="verdict">
				<span class="meta-label">When Pay it down is paid off · {cmp.payoffDisplay}</span>
				<h2 class="statement">
					<span role="status">
						{#if ranked.length === 1}Only Pay it down qualifies.{:else if m.verdict!.lead < 1}The
							plans come out even.{:else}{best.title}
							comes out ahead.{#if win !== 'A'}<span class="vh"
									>{` ${signed(winNet)} vs Pay it down.`}</span
								>{/if}{/if}
					</span>
				</h2>
				{#if win !== 'A'}<p class="lead">{signed(winNet)} vs Pay it down, before ISK tax</p>{/if}
			</section>
		{/if}
	</div>

	<aside class="inputs" aria-label="Your numbers">
		<Setup model={m} />
	</aside>
	{#if best && !invalid && !resultsInView && !answerInView}
		<a class="dock" href="#results" {@attach padRoot('Bottom')}>
			<span>
				<b>{ranked.length === 1 ? 'Only Pay it down qualifies' : `${best.title} ahead`}</b>
				{#if win !== 'A'}<span class="dock-lead"
						>{signed(winNet)} vs Pay it down, before ISK tax</span
					>{/if}
				{#if note}<span class="dock-warn">⚠ {note}</span>{/if}
			</span>
			<span class="dock-cta">See results</span>
		</a>
	{/if}

	<div class="results" id="results" {@attach watch((v) => (resultsInView = v))}>
		{#if invalid}
			<!-- The field error says what to fix; there is no answer for a loan no bank would grant. -->
		{:else if cmp && best}
			<div class="rank-wrap">
				{#if ranked.length > 1}<p class="meta-label rank-cap" id="rank-cap">
						Net position vs Pay it down, before ISK tax
					</p>
					<ol class="rank" aria-labelledby="rank-cap">
						{#each ranked as r (r.id)}
							<li class:win={win === r.id}>
								<span class="tag" aria-hidden="true">{r.tag}</span>
								<span class="name"
									>{r.title}{#if win === r.id}<span class="meta-label"
											>{' · best'}{#if extra >= 1}{` · ${formatCurrency(extra)} more a month`}{/if}</span
										>{/if}</span
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
								<tr class="net"
									><th scope="row">Net position</th>{#each columns as s (s.id)}<td
											class:win={win === s.id}>{signed(cmp.same[s.id].net)}</td
										>{/each}</tr
								>
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
							Net position: investment value, minus remaining debt, minus the extra interest (after
							ränteavdrag) a plan pays compared with Pay it down.
						</li>
						<li>
							Amortization is a fixed share of the original loan. Interest and returns stay
							constant; returns are before ISK tax.
						</li>
						<li>
							Ränteavdrag: 30% of the first 100 000 kr of yearly interest per borrower, 21% above.
						</li>
					</ul>
				</gok-accordion-item>
			</gok-accordion>
		{:else}
			<gok-alert status="info" class="notice"
				>Set Pay it down's amortization above 0%. At 0% the loan is never repaid, so there is no
				date to compare the plans at.</gok-alert
			>
		{/if}

		<p class="disclaimer">For information only, not financial advice.</p>
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
	/* Phones read top to bottom: answer, inputs, details. Wide screens put the inputs on the left,
	   beside the answer and the details. */
	@media (min-width: 900px) {
		.split {
			grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
			grid-template-rows: auto 1fr;
			grid-template-areas: 'inputs answer' 'inputs results';
			gap: var(--gok-space-600, 32px) var(--gok-space-900, 64px);
		}
		.inputs {
			grid-area: inputs;
		}
		/* The verdict and the results stay in view while you edit the inputs beside them: both pin,
		   the results just under the verdict. */
		.answer {
			grid-area: answer;
			position: sticky;
			top: var(--gok-space-400, 16px);
			z-index: 1;
			align-self: start;
		}
		.results {
			grid-area: results;
			position: sticky;
			top: calc(var(--gok-space-400, 16px) + var(--answer-h, 0px));
			align-self: start;
		}
		.lead {
			display: none;
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
				max(var(--gok-space-400, 16px), env(safe-area-inset-right))
				calc(var(--gok-space-300, 12px) + env(safe-area-inset-bottom))
				max(var(--gok-space-400, 16px), env(safe-area-inset-left));
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
			color: var(--gok-color-primary);
			font-variant-numeric: tabular-nums;
			font-size: var(--gok-type-body-small-size, 14px);
		}
		.dock-warn {
			display: block;
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
		}
		.compare th[scope='row'],
		.compare thead th:first-child {
			position: sticky;
			inset-inline-start: 0;
			background: var(--gok-color-surface-overlay, var(--gok-color-surface));
			backdrop-filter: var(--gok-surface-backdrop, none);
			white-space: normal;
			min-inline-size: 6rem;
		}
	}
	.compare .net td {
		font-weight: var(--gok-font-weight-semibold, 600);
		font-size: var(--gok-type-body-large-size, 18px);
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
