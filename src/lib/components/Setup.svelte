<script lang="ts">
	import { formatCurrency, RULES_DATE, RULES_SOURCE } from '$lib/mortgage';
	import type { MortgageModel } from '$lib/mortgageModel.svelte';

	let { model }: { model: MortgageModel } = $props();

	let openRules = $state(false);
	let rulesEl = $state<(HTMLElement & { open: boolean }) | undefined>();
	$effect(() => {
		if (rulesEl) rulesEl.open = openRules;
	});

	type Inputs = MortgageModel['inputs'];
	type Key = { [K in keyof Inputs]: Inputs[K] extends number ? K : never }[keyof Inputs];
	type NumberEvent = CustomEvent<{ value: number | null }>;
	// gok-number-input reports `null` while a field is empty. Typing updates the model only with a
	// real number; leaving a field empty puts its last value back, so the field and the maths agree.
	const set = (key: Key) => (e: Event) => {
		const v = (e as NumberEvent).detail?.value;
		if (v != null) model.inputs[key] = v;
	};
	const restore = (key: Key) => (e: Event) => {
		if ((e as NumberEvent).detail?.value == null)
			(e.target as HTMLElement & { value: number }).value = model.inputs[key];
	};
	function onClick(node: HTMLElement, handler: () => void) {
		const fn = () => handler();
		node.addEventListener('click', fn);
		return { destroy: () => node.removeEventListener('click', fn) };
	}
	function onClose(node: HTMLElement, handler: () => void) {
		const fn = () => handler();
		node.addEventListener('gok-close', fn);
		return { destroy: () => node.removeEventListener('gok-close', fn) };
	}

	type Field = HTMLElement & { checked?: boolean; value?: string };

	const i = $derived(model.inputs);
	// Plans B and C may go below the legal minimum to explore; say so instead of blocking it.
	const belowMin = (rate: number) =>
		model.loanAmount > 0 && rate < model.requirements.totalMinimum
			? `Below the ${model.requirements.totalMinimum.toFixed(1)}% legal minimum; a bank would not allow it`
			: '';
</script>

<section class="block" aria-labelledby="loan-h">
	<h2 class="gok-headline-5" id="loan-h">Your loan</h2>
	<div class="situation">
		<gok-switch
			{@attach (n: Field) => {
				n.checked = i.legacy;
			}}
			onchange={(e: Event) => (model.inputs.legacy = !!(e.target as Field).checked)}
			helper="Keeps the old 85% cap and the extra 1% for loans over 4.5× income"
			>Loan taken before {RULES_DATE}</gok-switch
		>
		<gok-segmented
			label="Borrowers"
			{@attach (n: Field) => {
				n.value = String(i.borrowers);
			}}
			onchange={(e: Event) => (model.inputs.borrowers = Number((e.target as Field).value))}
		>
			<gok-segmented-item value="1">One borrower</gok-segmented-item>
			<gok-segmented-item value="2">Two borrowers</gok-segmented-item>
		</gok-segmented>
	</div>
	<div class="fields">
		<gok-number-input
			label="Property value (SEK)"
			error={model.propertyError}
			locale="sv-SE"
			value={i.propertyValue}
			min="0"
			step="100000"
			oninput={set('propertyValue')}
			onchange={restore('propertyValue')}
		></gok-number-input>
		<gok-number-input
			label="Down payment (SEK)"
			locale="sv-SE"
			value={i.downPayment}
			min="0"
			step="50000"
			helper={`Min ${model.downShare * 100}% of property value`}
			error={model.downPaymentError}
			oninput={set('downPayment')}
			onchange={restore('downPayment')}
		></gok-number-input>
		{#if i.legacy}
			<gok-number-input
				label="Annual gross salary (SEK)"
				helper="Sets the extra 1% rule for loans over 4.5× income"
				locale="sv-SE"
				value={i.annualSalary}
				min="0"
				step="10000"
				oninput={set('annualSalary')}
				onchange={restore('annualSalary')}
			></gok-number-input>
		{/if}
		<gok-number-input
			label="Interest rate (%)"
			value={i.interestRate}
			min="0"
			max="20"
			step="0.1"
			oninput={set('interestRate')}
			onchange={restore('interestRate')}
		></gok-number-input>
		<gok-number-input
			label="Monthly fee / avgift (SEK)"
			locale="sv-SE"
			value={i.monthlyFee}
			min="0"
			step="100"
			oninput={set('monthlyFee')}
			onchange={restore('monthlyFee')}
		></gok-number-input>
	</div>
	<p class="summary">
		<span class="meta-label">Loan</span>
		<span class="v">{formatCurrency(model.loanAmount)}</span>
		<span class="meta-label">LTV</span>
		<span class="v">{model.ltv.toFixed(0)}%</span>
		<span class="meta-label">Min amortization</span>
		<span class="v"
			>{#if model.loanAmount > 0}{model.requirements.totalMinimum.toFixed(1)}%/yr{:else}–{/if}</span
		>
	</p>
	<gok-button variant="secondary" size="s" use:onClick={() => (openRules = true)}
		>See amortization rules</gok-button
	>
</section>

<section class="block" aria-labelledby="plans-h">
	<h2 class="gok-headline-5" id="plans-h">Your plans</h2>
	<p class="intro">Three ways to handle the same loan.</p>
	<gok-number-input
		label="Expected annual return (%)"
		helper="Yearly growth on what plans B and C invest"
		value={i.investmentReturn}
		min="0"
		max="20"
		step="0.1"
		oninput={set('investmentReturn')}
		onchange={restore('investmentReturn')}
	></gok-number-input>
	{#each model.scenarios as s (s.id)}
		<div class="plan" role="group" aria-labelledby="plan-{s.id}">
			<div class="plan-head">
				<span class="tag" aria-hidden="true">{s.tag}</span>
				<h3 id="plan-{s.id}">{s.title}</h3>
			</div>
			<p class="desc">{s.desc}</p>
			<div class="fields">
				{#if s.id === 'A'}
					<gok-number-input
						label="Amortization (%)"
						value={i.aRate}
						min="0"
						max="10"
						step="0.1"
						error={model.meetsRequirement
							? ''
							: `Enter at least ${model.requirements.totalMinimum.toFixed(1)}% to meet amorteringskrav`}
						helper={model.loanAmount > 0 && model.meetsRequirement
							? 'Meets Swedish requirement'
							: ''}
						oninput={set('aRate')}
						onchange={restore('aRate')}
					></gok-number-input>
				{:else if s.id === 'B'}
					<gok-number-input
						label="Amortization (%)"
						value={i.bRate}
						min="0"
						max="10"
						step="0.1"
						helper={i.bRate >= i.aRate
							? ''
							: belowMin(i.bRate) ||
								`Invests ${formatCurrency(s.invest)} a month: what Pay it down amortizes on top`}
						error={i.bRate >= i.aRate
							? `Enter a rate below Pay it down's ${i.aRate}% to have a difference to invest`
							: ''}
						oninput={set('bRate')}
						onchange={restore('bRate')}
					></gok-number-input>
				{:else}
					<gok-number-input
						label="Amortization (%)"
						value={i.cRate}
						helper={belowMin(i.cRate)}
						min="0"
						max="10"
						step="0.1"
						oninput={set('cRate')}
						onchange={restore('cRate')}
					></gok-number-input>
					<gok-number-input
						label="Invest each month (SEK)"
						locale="sv-SE"
						value={i.cInvestmentAmount}
						min="0"
						step="100"
						oninput={set('cInvestmentAmount')}
						onchange={restore('cInvestmentAmount')}
					></gok-number-input>
				{/if}
			</div>
		</div>
	{/each}
</section>

<gok-dialog
	bind:this={rulesEl}
	heading="Swedish amortization rules"
	scale="amorteringskrav"
	use:onClose={() => (openRules = false)}
>
	<p class="muted">
		{#if i.legacy}
			Rules for loans taken before {RULES_DATE}.
		{:else}
			Rules in force since {RULES_DATE} (<a href={RULES_SOURCE} rel="noreferrer">Regeringen</a>).
		{/if}
		Your situation: LTV {model.ltv.toFixed(1)}%{#if i.legacy}, LTI {model.lti.toFixed(2)}×{/if}
		→ minimum {model.requirements.totalMinimum.toFixed(1)}%/yr.
	</p>
	<ul class="rules">
		<li class:on={model.ltv > 70}>
			LTV &gt; 70% → 2%/yr{#if model.ltv > 70}<span class="applies">{' · applies to you'}</span
				>{/if}
		</li>
		<li class:on={model.ltv >= 50 && model.ltv <= 70}>
			LTV 50–70% → 1%/yr{#if model.ltv >= 50 && model.ltv <= 70}<span class="applies"
					>{' · applies to you'}</span
				>{/if}
		</li>
		<li class:on={model.ltv < 50}>
			LTV &lt; 50% → 0%/yr{#if model.ltv < 50}<span class="applies">{' · applies to you'}</span
				>{/if}
		</li>
		{#if i.legacy}
			<li class:on={model.lti > 4.5}>
				LTI &gt; 4.5× → +1%/yr{#if model.lti > 4.5}<span class="applies">{' · applies to you'}</span
					>{/if}
			</li>
		{/if}
	</ul>
	<gok-button slot="footer" variant="secondary" use:onClick={() => (openRules = false)}
		>Close</gok-button
	>
</gok-dialog>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: var(--gok-space-400, 16px);
	}
	.block + .block {
		margin-top: var(--gok-space-700, 40px);
	}
	.block > gok-button {
		align-self: flex-start;
	}
	h2 {
		margin: 0;
		padding-bottom: var(--gok-space-200, 8px);
		border-bottom: 1px solid var(--gok-color-border);
	}
	.intro,
	.desc {
		margin: 0;
		color: var(--gok-color-text-muted);
		font-size: var(--gok-type-body-small-size, 14px);
	}
	.situation {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--gok-space-300, 12px);
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
		gap: var(--gok-space-300, 12px);
	}
	.summary {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--gok-space-100, 4px) var(--gok-space-400, 16px);
		align-items: baseline;
		padding-top: var(--gok-space-300, 12px);
		border-top: 1px solid var(--gok-color-border);
	}
	.summary .v {
		font-variant-numeric: tabular-nums;
		font-weight: var(--gok-font-weight-medium, 500);
		text-align: end;
	}
	.plan {
		display: flex;
		flex-direction: column;
		gap: var(--gok-space-200, 8px);
		padding-top: var(--gok-space-400, 16px);
		border-top: 1px solid var(--gok-color-border);
	}
	.plan-head {
		display: flex;
		align-items: center;
		gap: var(--gok-space-300, 12px);
	}
	.plan h3 {
		margin: 0;
		font-size: var(--gok-type-body-regular-size, 16px);
		font-weight: var(--gok-font-weight-medium, 500);
	}
	.tag {
		display: inline-grid;
		place-items: center;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		flex: none;
		border: 1px solid var(--gok-color-border-strong, var(--gok-color-border));
		border-radius: var(--gok-radius-s);
		font-family: var(--gok-font-family-mono);
		font-size: 0.75rem;
		font-weight: var(--gok-font-weight-semibold, 600);
	}
	.muted {
		color: var(--gok-color-text-muted);
	}
	.rules {
		list-style: none;
		margin: var(--gok-space-300, 12px) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--gok-space-100, 4px);
	}
	.rules li {
		padding: var(--gok-space-200, 8px) var(--gok-space-300, 12px);
		border: 1px solid var(--gok-color-border);
		font-size: var(--gok-type-body-small-size, 14px);
		color: var(--gok-color-text-muted);
	}
	.rules li.on {
		border-color: var(--gok-color-primary);
		color: var(--gok-color-text);
		font-weight: var(--gok-font-weight-medium, 500);
	}
	.applies {
		color: var(--gok-color-primary);
	}
</style>
