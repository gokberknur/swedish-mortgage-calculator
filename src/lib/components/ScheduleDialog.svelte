<script lang="ts">
	import { formatCurrency } from '$lib/mortgage';
	import type { ScenarioSchedule } from '$lib/mortgage';

	let {
		open = false,
		title = '',
		schedule = null,
		onclose
	}: {
		open?: boolean;
		title?: string;
		schedule?: ScenarioSchedule | null;
		onclose: () => void;
	} = $props();

	let el = $state<(HTMLElement & { open: boolean }) | undefined>();
	$effect(() => {
		if (el) el.open = open;
	});

	function onCloseEvent(node: HTMLElement, handler: () => void) {
		const fn = () => handler();
		node.addEventListener('gok-close', fn);
		return { destroy: () => node.removeEventListener('gok-close', fn) };
	}
	function onClick(node: HTMLElement, handler: () => void) {
		const fn = () => handler();
		node.addEventListener('click', fn);
		return { destroy: () => node.removeEventListener('click', fn) };
	}
</script>

<gok-dialog
	bind:this={el}
	heading={title}
	scale="60 months"
	size="l"
	style="--gok-dialog-max-inline-size: 52rem"
	use:onCloseEvent={onclose}
>
	{#if schedule}
		<!-- The schedule scrolls, so its box must take focus for keyboard scrolling outside Chrome. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="wrap" tabindex="0" role="region" aria-label={title}>
			<table>
				<thead>
					<tr>
						<th>Month</th>
						<th>Total</th>
						<th>Interest</th>
						<th>Amortization</th>
						<th>Investment</th>
						<th>Investment balance</th>
					</tr>
				</thead>
				<tbody>
					{#each schedule.rows as row (row.month)}
						<tr>
							<td>{row.month}</td>
							<td>{formatCurrency(row.monthlyTotal)}</td>
							<td>{formatCurrency(row.monthlyInterest)}</td>
							<td>{formatCurrency(row.monthlyAmortization)}</td>
							<td>{formatCurrency(row.monthlyInvestment)}</td>
							<td>{formatCurrency(row.investmentValue)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td>Total</td>
						<td>{formatCurrency(schedule.totalPaid)}</td>
						<td>{formatCurrency(schedule.totalInterest)}</td>
						<td>{formatCurrency(schedule.totalAmortization)}</td>
						<td>{formatCurrency(schedule.totalInvested)}</td>
						<td><span class="end">{'end '}</span>{formatCurrency(schedule.finalInvestmentValue)}</td
						>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
	<gok-button slot="footer" variant="secondary" use:onClick={onclose}>Close</gok-button>
</gok-dialog>

<style>
	.wrap {
		overflow-x: auto;
		max-height: 60vh;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--gok-type-body-small-size, 14px);
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		text-align: right;
		padding: var(--gok-space-100, 4px) var(--gok-space-300, 12px);
		border-bottom: 1px solid var(--gok-color-border);
		white-space: nowrap;
	}
	th:first-child,
	td:first-child {
		text-align: left;
		position: sticky;
		inset-inline-start: 0;
		background: var(--gok-color-surface);
	}
	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--gok-color-surface);
		color: var(--gok-color-text-muted);
		font-weight: var(--gok-font-weight-medium, 500);
	}
	.end {
		color: var(--gok-color-text-muted);
		font-weight: var(--gok-font-weight-regular, 400);
	}
	tfoot td {
		font-weight: var(--gok-font-weight-semibold, 600);
		border-top: 2px solid var(--gok-color-border-strong, var(--gok-color-border));
	}
</style>
