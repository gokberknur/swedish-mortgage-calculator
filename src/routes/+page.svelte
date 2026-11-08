<script lang="ts">
	import Eyebrow from '$lib/components/Eyebrow.svelte';
	import Setup from '$lib/components/Setup.svelte';
	import ScheduleDialog from '$lib/components/ScheduleDialog.svelte';
	import { formatCurrency } from '$lib/mortgage';
	import { createMortgageModel, type ScenarioId } from '$lib/mortgageModel.svelte';

	const m = createMortgageModel();
	let openSched: ScenarioId | '' = $state('');

	// Compact figures ("1.8M kr") keep the plot usable on phones; exact figures are in the table.
	// English abbreviations on purpose: Swedish "tn" (tusen) and "bn" (biljon) read as trillion
	// and billion on this English page, off by up to 1000x.
	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const compactKr = (n: number) => `${compact.format(n)} kr`;

	// gok-chart takes its data and formatter as properties, not attributes.
	let chartEl = $state<
		(HTMLElement & { data: unknown; format: (n: number) => string }) | undefined
	>();
	$effect(() => {
		if (chartEl && m.chart) {
			chartEl.format = compactKr;
			chartEl.data = m.chart;
		}
	});

	function onClick(node: HTMLElement, handler: () => void) {
		const fn = () => handler();
		node.addEventListener('click', fn);
		return { destroy: () => node.removeEventListener('click', fn) };
	}

	const i = $derived(m.inputs);
	const cmp = $derived(m.comparison);
	const win = $derived(m.verdict?.best.id);
	const fullCards = $derived(
		cmp
			? [
					{ id: 'B' as const, card: cmp.bFull },
					{ id: 'C' as const, card: cmp.cFull }
				]
			: []
	);
	const investAt = (id: ScenarioId) =>
		id === 'A' ? 0 : id === 'B' ? (cmp?.bSame.investment ?? 0) : (cmp?.cSame.investment ?? 0);
	const interestAt = (id: ScenarioId) =>
		id === 'A'
			? (cmp?.aCard.interestPaid ?? 0)
			: id === 'B'
				? (cmp?.bSame.interestPaid ?? 0)
				: (cmp?.cSame.interestPaid ?? 0);
	// Results in view: the phone dock hides, so it never covers the answer it points to.
	let resultsInView = $state(false);
	function watchResults(node: HTMLElement) {
		const io = new IntersectionObserver(([e]) => (resultsInView = e.isIntersecting), {
			rootMargin: '0px 0px -40% 0px'
		});
		io.observe(node);
		return () => io.disconnect();
	}

	const netAt = (id: ScenarioId) =>
		id === 'A'
			? 0
			: id === 'B'
				? (cmp?.bSame.financialPosition ?? 0)
				: (cmp?.cSame.financialPosition ?? 0);
	const ranked = $derived(
		m.scenarios.map((s) => ({ ...s, net: netAt(s.id) })).sort((a, b) => b.net - a.net)
	);
	const rankMax = $derived(Math.max(1, ...ranked.map((r) => r.net)));
	// The verdict must not quietly recommend a plan a bank would refuse, or one that only wins by
	// spending more each month.
	const caveats = $derived.by(() => {
		const best = m.scenarios.find((s) => s.id === win);
		const a = m.scenarios[0];
		if (!best || m.verdict!.lead < 1) return [];
		const out: string[] = [];
		if (best.rate < m.requirements.totalMinimum)
			out.push(
				`${best.title} amortizes ${best.rate}%, below the ${m.requirements.totalMinimum.toFixed(1)}% legal minimum, so a bank would not allow it.`
			);
		const extra = best.mortgageCost - a.mortgageCost;
		if (extra >= 1)
			out.push(
				`It also costs ${formatCurrency(extra)} more a month than Pay it down, which explains part of its lead.`
			);
		return out;
	});
	// gok-chart colours series 1-3 (A, B, C) from these tokens: the winner gets the one accent,
	// the others two greys, so colour never carries the plan on its own (the legend names it).
	const chartColors = $derived(
		(['A', 'B', 'C'] as const)
			.map((id, n) => {
				const grey = n === 0 ? 'var(--gok-color-text-muted)' : 'var(--gok-color-border-strong)';
				return `--gok-chart-${n + 1}: ${id === win ? 'var(--gok-color-primary)' : grey}`;
			})
			.join('; ')
	);
	const signed = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`;
</script>

<svelte:head>
	<title>Swedish Mortgage Calculator</title>
	<meta
		name="description"
		content="Pay down faster vs. invest the difference, under Swedish rules."
	/>
</svelte:head>

<div class="page-head">
	<Eyebrow text="Tool · Sweden" />
	<h1 class="gok-headline-1">Swedish Mortgage Calculator</h1>
	<p>
		One loan, three strategies. Set up your loan and the three plans below, and see which leaves you
		better off, under Swedish rules (amorteringskrav, ränteavdrag, kontantinsats).
	</p>
</div>

<div class="split">
	<aside class="inputs" aria-label="Your numbers">
		<Setup model={m} />
	</aside>
	{#if m.verdict && !resultsInView}
		<a class="dock" href="#results">
			<span>
				<b
					>{#if m.verdict.lead < 1}The plans finish level{:else}{m.verdict.best.title} ahead{/if}</b
				>
				{#if m.verdict.lead >= 1}<span class="dock-lead"
						>+{formatCurrency(m.verdict.lead)} vs the next plan</span
					>{/if}
			</span>
			<span class="dock-cta">See results</span>
		</a>
	{/if}

	<div class="results" id="results" {@attach watchResults}>
		{#if cmp && m.verdict}
			{#if m.downPaymentError}
				<gok-alert status="warning" class="notice"
					>Banks require at least {m.downShare * 100}% down. These results assume a loan you can't
					get.</gok-alert
				>
			{/if}
			<section class="verdict">
				<span class="meta-label"
					>Verdict · after {m.verdict.payoff}, when Pay it down is paid off</span
				>
				<h2 class="statement">
					<span role="status">
						{#if m.verdict.lead < 1}The strategies finish level.{:else}{m.verdict.best.title} comes out
							ahead.<span class="vh">{` By ${formatCurrency(m.verdict.lead)}.`}</span>{/if}
					</span>
				</h2>
				{#if m.verdict.lead >= 1}
					<p class="lead">
						+{formatCurrency(m.verdict.lead)}
						<span>better net position than the next-best plan</span>
					</p>
				{/if}
				{#if caveats.length}
					<gok-alert status="warning" class="caveat">{caveats.join(' ')}</gok-alert>
				{/if}
				<ol class="rank" aria-label="Net position by plan">
					{#each ranked as r (r.id)}
						<li class:win={win === r.id}>
							<span class="tag" aria-hidden="true">{r.tag}</span>
							<span class="name">{r.title}</span>
							<span class="val" class:neg={r.net < 0}>{signed(r.net)}</span>
							<span class="bar" aria-hidden="true"
								><i style:inline-size="{(Math.max(0, r.net) / rankMax) * 100}%"></i></span
							>
						</li>
					{/each}
				</ol>
			</section>

			<section class="block">
				<div class="block-head"><h2 class="gok-headline-4">How they compare</h2></div>
				<p class="block-intro">
					Frozen at the moment <strong>Pay it down</strong> clears the loan ({cmp.aCard
						.payoffDisplay}), so every plan is judged at the same point in time.
				</p>
				<!-- A scrollable region must be focusable so keyboard users can scroll it on phones. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="table-scroll" role="region" aria-label="Plan comparison" tabindex="0">
					<table class="compare">
						<thead>
							<tr>
								<th scope="col"><span class="vh">Metric</span></th>
								{#each m.scenarios as s (s.id)}
									<th scope="col" class:win={win === s.id}>
										<span class="meta-label sc-tag"
											>{s.tag}{#if win === s.id}{' · best'}{/if}</span
										>
										<span class="sc-title">{s.title}</span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<tr
								><th scope="row">Monthly outlay, first month</th>{#each m.scenarios as s (s.id)}<td
										class:win={win === s.id}>{formatCurrency(s.mortgageCost)}</td
									>{/each}</tr
							>
							<tr
								><th scope="row">Mortgage paid off</th>{#each m.scenarios as s (s.id)}<td
										class:win={win === s.id}>{s.payoff.display}</td
									>{/each}</tr
							>
							<tr
								><th scope="row">Interest paid (before ränteavdrag)</th
								>{#each m.scenarios as s (s.id)}<td class:win={win === s.id}
										>{formatCurrency(interestAt(s.id))}</td
									>{/each}</tr
							>
							<tr
								><th scope="row">Investment value</th>{#each m.scenarios as s (s.id)}<td
										class:win={win === s.id}>{formatCurrency(investAt(s.id))}</td
									>{/each}</tr
							>
							<tr class="net"
								><th scope="row">Net position</th>{#each m.scenarios as s (s.id)}<td
										class:win={win === s.id}
										class:pos={netAt(s.id) > 0}
										class:neg={netAt(s.id) < 0}
										>{netAt(s.id) > 0 ? '+' : ''}{formatCurrency(netAt(s.id))}</td
									>{/each}</tr
							>
						</tbody>
					</table>
				</div>
				<p class="fine">
					Net position = investment value − any remaining debt − the extra interest (after
					ränteavdrag) the plan paid compared with Pay it down. Before tax on investment gains.
				</p>
			</section>

			{#if m.chart}
				<section class="block">
					<div class="block-head"><h2 class="gok-headline-4">Net position over time</h2></div>
					<gok-chart
						style={chartColors}
						bind:this={chartEl}
						type="line"
						height={280}
						accessible-label="Net position by year for each plan"
					></gok-chart>
				</section>
			{/if}

			<gok-accordion class="more">
				<gok-accordion-item heading-level="2">
					<span slot="summary">Monthly breakdown</span>
					<div class="breakdown">
						{#each m.scenarios as s (s.id)}
							<div class="bd-col">
								<h3>{s.tag} · {s.title}</h3>
								<dl>
									<div>
										<dt>Interest (before ränteavdrag)</dt>
										<dd>{formatCurrency(m.monthlyInterest)}</dd>
									</div>
									<div>
										<dt>Amortization</dt>
										<dd>{formatCurrency(s.amort)}</dd>
									</div>
									<div>
										<dt>Invested</dt>
										<dd>{formatCurrency(s.invest)}</dd>
									</div>
									<div class="rule">
										<dt>Monthly outlay</dt>
										<dd>{formatCurrency(s.mortgageCost)}</dd>
									</div>
									<div>
										<dt>+ Avgift</dt>
										<dd>{formatCurrency(i.monthlyFee)}</dd>
									</div>
									<div class="rule">
										<dt>Total per month</dt>
										<dd>{formatCurrency(s.total)}</dd>
									</div>
									<div>
										<dt>Back as ränteavdrag</dt>
										<dd>+{formatCurrency(m.monthlyTaxBenefit)}</dd>
									</div>
								</dl>
								<gok-button
									variant="secondary"
									size="s"
									accessible-label={`60-month schedule, ${s.title}`}
									use:onClick={() => (openSched = s.id)}>60-month schedule</gok-button
								>
							</div>
						{/each}
					</div>
				</gok-accordion-item>
				<gok-accordion-item heading-level="2">
					<span slot="summary">If each plan runs to its own payoff</span>
					<div class="breakdown two">
						{#each fullCards as { id, card } (id)}
							<div class="bd-col">
								<h3>{id} · at full payoff</h3>
								{#if card}
									<dl>
										<div>
											<dt>Payoff</dt>
											<dd>{card.payoffDisplay}</dd>
										</div>
										<div>
											<dt>Interest paid (before ränteavdrag)</dt>
											<dd>{formatCurrency(card.interestPaid)}</dd>
										</div>
										<div>
											<dt>Total paid</dt>
											<dd>{formatCurrency(card.totalPaid)}</dd>
										</div>
										<div>
											<dt>Investment value</dt>
											<dd>{formatCurrency(card.investment)}</dd>
										</div>
									</dl>
								{:else}
									<p class="muted">Never repaid at 0% amortization.</p>
								{/if}
							</div>
						{/each}
					</div>
				</gok-accordion-item>
				<gok-accordion-item heading-level="2">
					<span slot="summary">Assumptions &amp; method</span>
					<ul class="assume">
						<li>
							Straight-line amortization on the original loan; interest &amp; returns held constant.
						</li>
						<li>
							Ränteavdrag is 30% on the first 100 000 kr of yearly interest per borrower and 21%
							above, with the loan split equally between borrowers. The monthly fee is excluded from
							cumulative totals.
						</li>
						<li>
							Net position = investment value − remaining debt − the extra interest, after
							ränteavdrag, paid compared with Pay it down. A plan that amortizes less pays more
							interest, and that cash counts against it.
						</li>
						<li>Plans B and C may amortize below the legal minimum; banks would not allow that.</li>
					</ul>
				</gok-accordion-item>
			</gok-accordion>
		{:else if m.loanAmount <= 0}
			<gok-alert status="info" class="notice"
				>Enter a property value larger than the down payment to see the comparison.</gok-alert
			>
		{:else}
			<gok-alert status="info" class="notice"
				>Pay it down is set to 0% amortization, so its loan is never repaid and there is no payoff
				date to compare at. Set its amortization above 0%.</gok-alert
			>
		{/if}

		<p class="disclaimer">For information only, not financial advice.</p>
	</div>
</div>

<ScheduleDialog
	open={openSched !== ''}
	title={openSched
		? `${m.scenarios.find((s) => s.id === openSched)?.title} · payment schedule`
		: ''}
	schedule={openSched ? m.schedules[openSched] : null}
	onclose={() => (openSched = '')}
/>

<style>
	.block {
		margin-top: var(--gok-space-800, 48px);
	}
	.block-head {
		display: flex;
		align-items: center;
		gap: var(--gok-space-300, 12px);
		margin-bottom: var(--gok-space-400, 16px);
		padding-bottom: var(--gok-space-300, 12px);
		border-bottom: 1px solid var(--gok-color-border);
	}
	.block-head h2 {
		margin: 0;
	}
	.block-intro {
		margin: 0 0 var(--gok-space-500, 24px);
		color: var(--gok-color-text-muted);
		max-width: 60ch;
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--gok-space-800, 48px);
	}
	.results {
		container-type: inline-size;
		min-inline-size: 0;
	}
	@media (min-width: 900px) {
		.split {
			grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
			gap: var(--gok-space-900, 64px);
			align-items: start;
		}
		/* The inputs stay on screen while the results scroll, so every edit shows its effect. */
		.inputs {
			position: sticky;
			top: var(--gok-space-400, 16px);
			max-block-size: calc(100dvh - 2 * var(--gok-space-400, 16px));
			overflow-y: auto;
			padding-inline-end: var(--gok-space-300, 12px);
		}
	}
	.results > :first-child {
		margin-top: 0;
	}
	.verdict {
		margin: 0;
	}
	.rank {
		list-style: none;
		margin: var(--gok-space-600, 32px) 0 0;
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
	.rank .tag {
		display: inline-grid;
		place-items: center;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		border: 1px solid var(--gok-color-border-strong, var(--gok-color-border));
		border-radius: var(--gok-radius-s);
		font-family: var(--gok-font-family-mono);
		font-size: 0.75rem;
		font-weight: var(--gok-font-weight-semibold, 600);
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
	.rank .win .tag {
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
	.caveat {
		display: block;
		margin-top: var(--gok-space-400, 16px);
		max-inline-size: 36rem;
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
		/* Focused fields scroll clear of the bar instead of hiding behind it. */
		:global(html) {
			scroll-padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
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
	.lead {
		margin: var(--gok-space-400, 16px) 0 0;
		font-size: var(--gok-type-headline-5-size, 1.125rem);
		font-variant-numeric: tabular-nums;
		color: var(--gok-color-primary);
		font-weight: var(--gok-font-weight-medium, 500);
	}
	.lead span {
		color: var(--gok-color-text-muted);
		font-weight: 400;
		font-size: var(--gok-type-body-regular-size, 16px);
	}
	.table-scroll {
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
		min-inline-size: 8rem;
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
	.vh {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
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
			min-inline-size: 8rem;
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
	.pos {
		color: var(--gok-color-status-success-text);
	}
	.neg {
		color: var(--gok-color-status-error-text);
	}
	.fine {
		margin: var(--gok-space-300, 12px) 0 0;
		font-size: var(--gok-type-caption-size, 0.75rem);
		color: var(--gok-color-text-muted);
	}
	.notice {
		display: block;
		margin-top: var(--gok-space-800, 48px);
	}
	.notice + .verdict {
		margin-top: var(--gok-space-600, 32px);
	}
	.more {
		margin-top: var(--gok-space-700, 40px);
	}
	/* `inline-size` is explicit because `gok-accordion-item` sizes slotted content
	   to itself (DS 0.9.0); without it this grid shrinks to its columns'
	   max-content and bunches at the panel's inline start. */
	.breakdown {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--gok-space-600, 32px);
		inline-size: 100%;
	}
	.breakdown.two {
		grid-template-columns: repeat(2, 1fr);
	}
	@container (max-width: 640px) {
		.breakdown,
		.breakdown.two {
			grid-template-columns: 1fr;
		}
	}
	.bd-col h3 {
		margin: 0 0 var(--gok-space-300, 12px);
		font-size: var(--gok-type-body-regular-size, 16px);
	}
	.bd-col dl {
		margin: 0 0 var(--gok-space-400, 16px);
	}
	.bd-col dl > div {
		display: flex;
		justify-content: space-between;
		gap: var(--gok-space-300, 12px);
		padding-block: var(--gok-space-100, 4px);
		font-size: var(--gok-type-body-small-size, 14px);
	}
	.bd-col dl > div.rule {
		border-block: 1px solid var(--gok-color-border);
		margin-block: var(--gok-space-100, 4px);
		font-weight: var(--gok-font-weight-medium, 500);
	}
	.bd-col dt {
		color: var(--gok-color-text-muted);
	}
	.bd-col dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
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
	.muted {
		color: var(--gok-color-text-muted);
	}
	.disclaimer {
		margin-top: var(--gok-space-700, 40px);
		font-size: var(--gok-type-caption-size, 0.75rem);
		font-style: italic;
		color: var(--gok-color-text-muted);
	}
</style>
