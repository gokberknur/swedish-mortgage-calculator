/**
 * Shared reactive model for the Swedish mortgage calculator UI variants.
 *
 * The pure math lives in `./mortgage`. This module wires the inputs as `$state`
 * and every output as `$derived`, so each variant only owns presentation. Use it
 * from a component's init: `const m = createMortgageModel();` then read `m.*`
 * (don't destructure: that would snapshot the values and lose reactivity).
 */
import {
	calculateLoanAmount,
	calculateLTV,
	calculateLTI,
	calculateSwedishAmortization,
	calculateMonthlyInterest,
	calculateMonthlyTaxBenefit,
	calculateMonthlyAmortization,
	calculatePayoffTime,
	interestOver,
	calculateInvestmentGrowth,
	buildScenarioSchedule,
	formatCurrency,
	minDownShare,
	netPosition,
	type PayoffTime,
	type ScenarioSchedule
} from './mortgage';

export type ScenarioId = 'A' | 'B' | 'C';

export interface ScenarioRow {
	id: ScenarioId;
	title: string;
	tag: string;
	desc: string;
	rate: number;
	amort: number;
	invest: number;
	mortgageCost: number;
	total: number;
	payoff: PayoffTime;
}

export interface PlanResult {
	interestPaid: number;
	investment: number;
	net: number;
}

export interface PlanPayoff {
	interestPaid: number;
	investment: number;
	totalPaid: number;
	payoffDisplay: string;
}

const META: Record<ScenarioId, { title: string; tag: string; desc: string }> = {
	A: {
		title: 'Pay it down',
		tag: 'A',
		desc: 'Amortize fast, invest nothing.'
	},
	B: {
		title: 'Invest the difference',
		tag: 'B',
		desc: 'Amortize less, invest the rest.'
	},
	C: {
		title: 'Hybrid',
		tag: 'C',
		desc: 'Your own rate, plus a fixed monthly sum.'
	}
};

/** Chart series names: the plan letters used everywhere else, so line-end labels never truncate. */
const SHORT: Record<ScenarioId, string> = { A: 'A', B: 'B', C: 'C' };

export function createMortgageModel() {
	const inputs = $state({
		propertyValue: 4000000,
		downPayment: 600000,
		annualSalary: 600000,
		interestRate: 3.0,
		monthlyFee: 3000,
		aRate: 3.0,
		bRate: 2.0,
		cRate: 2.5,
		investmentReturn: 5.0,
		cInvestmentAmount: 2000,
		/** Loan taken before 1 April 2026: keeps the 85% cap and the +1% income rule. */
		legacy: false,
		borrowers: 1
	});

	const loanAmount = $derived(calculateLoanAmount(inputs.propertyValue, inputs.downPayment));
	const ltv = $derived(calculateLTV(loanAmount, inputs.propertyValue));
	const lti = $derived(calculateLTI(loanAmount, inputs.annualSalary));
	const minAmortization = $derived(calculateSwedishAmortization(ltv, lti, inputs.legacy));
	const downShare = $derived(minDownShare(inputs.legacy));
	const minDownPayment = $derived(inputs.propertyValue * downShare);
	const downPaymentError = $derived(
		inputs.downPayment < minDownPayment && inputs.propertyValue > 0
			? `Enter at least ${formatCurrency(minDownPayment)} (${downShare * 100}% of the property value)`
			: ''
	);
	const propertyError = $derived(
		inputs.propertyValue > 0 && loanAmount <= 0
			? `Enter a value above your down payment of ${formatCurrency(inputs.downPayment)}`
			: ''
	);
	const meetsRequirement = $derived(inputs.aRate >= minAmortization);

	const monthlyInterest = $derived(calculateMonthlyInterest(loanAmount, inputs.interestRate));
	const monthlyTaxBenefit = $derived(calculateMonthlyTaxBenefit(monthlyInterest, inputs.borrowers));

	const amortA = $derived(calculateMonthlyAmortization(loanAmount, inputs.aRate));
	const amortB = $derived(calculateMonthlyAmortization(loanAmount, inputs.bRate));
	const amortC = $derived(calculateMonthlyAmortization(loanAmount, inputs.cRate));
	const investB = $derived(Math.max(0, amortA - amortB));

	const scenarios = $derived<ScenarioRow[]>([
		{
			id: 'A',
			...META.A,
			rate: inputs.aRate,
			amort: amortA,
			invest: 0,
			mortgageCost: monthlyInterest + amortA,
			total: monthlyInterest + amortA + inputs.monthlyFee,
			payoff: calculatePayoffTime(loanAmount, amortA)
		},
		{
			id: 'B',
			...META.B,
			rate: inputs.bRate,
			amort: amortB,
			invest: investB,
			mortgageCost: monthlyInterest + amortB + investB,
			total: monthlyInterest + amortB + investB + inputs.monthlyFee,
			payoff: calculatePayoffTime(loanAmount, amortB)
		},
		{
			id: 'C',
			...META.C,
			rate: inputs.cRate,
			amort: amortC,
			invest: inputs.cInvestmentAmount,
			mortgageCost: monthlyInterest + amortC + inputs.cInvestmentAmount,
			total: monthlyInterest + amortC + inputs.cInvestmentAmount + inputs.monthlyFee,
			payoff: calculatePayoffTime(loanAmount, amortC)
		}
	]);

	const comparison = $derived.by(() => {
		const a = scenarios[0].payoff;
		const months = a.totalMonths;
		if (!isFinite(months)) return null;

		const plans: Record<ScenarioId, { rate: number; monthly: number }> = {
			A: { rate: inputs.aRate, monthly: 0 },
			B: { rate: inputs.bRate, monthly: investB },
			C: { rate: inputs.cRate, monthly: inputs.cInvestmentAmount }
		};
		const at = (id: ScenarioId, n: number) => ({
			interestPaid: interestOver(
				loanAmount,
				calculateMonthlyAmortization(loanAmount, plans[id].rate),
				inputs.interestRate,
				n
			).interest,
			investment: calculateInvestmentGrowth(plans[id].monthly, inputs.investmentReturn, n)
		});
		const net = (id: ScenarioId, n: number) =>
			netPosition({
				loanAmount,
				interestRate: inputs.interestRate,
				amortizationRate: plans[id].rate,
				baselineRate: inputs.aRate,
				monthlyInvestment: plans[id].monthly,
				investmentReturn: inputs.investmentReturn,
				month: n,
				borrowers: inputs.borrowers
			});

		// Every plan judged on the day plan A clears the loan; plan A scores 0 by definition.
		const same = {} as Record<ScenarioId, PlanResult>;
		for (const id of ['A', 'B', 'C'] as const)
			same[id] = { ...at(id, months), net: net(id, months) };

		// Each plan run to its own payoff; null when it never pays off.
		const full = (id: 'B' | 'C'): PlanPayoff | null => {
			const payoff = scenarios.find((s) => s.id === id)!.payoff;
			if (!isFinite(payoff.totalMonths)) return null;
			const r = at(id, payoff.totalMonths);
			return { ...r, totalPaid: loanAmount + r.interestPaid, payoffDisplay: payoff.display };
		};

		return {
			months,
			payoffDisplay: a.display,
			same,
			full: { B: full('B'), C: full('C') }
		};
	});

	// Plan B only exists when it amortizes less than A; otherwise it has nothing to invest and its
	// field shows an error, so it sits out of the ranking instead of feeding it a rejected value.
	const rankedIds = $derived(
		(['A', 'B', 'C'] as const).filter((id) => id !== 'B' || inputs.bRate < inputs.aRate)
	);

	const verdict = $derived.by(() => {
		if (!comparison) return null;
		const ranked = rankedIds
			.map((id) => ({ id, title: META[id].title, fp: comparison.same[id].net }))
			.sort((x, y) => y.fp - x.fp);
		return {
			best: ranked[0],
			lead: ranked[0].fp - ranked[1].fp,
			payoff: comparison.payoffDisplay
		};
	});

	const schedules = $derived<Record<ScenarioId, ScenarioSchedule>>({
		A: buildScenarioSchedule(loanAmount, inputs.interestRate, inputs.aRate, 0, 0),
		B: buildScenarioSchedule(
			loanAmount,
			inputs.interestRate,
			inputs.bRate,
			investB,
			inputs.investmentReturn
		),
		C: buildScenarioSchedule(
			loanAmount,
			inputs.interestRate,
			inputs.cRate,
			inputs.cInvestmentAmount,
			inputs.investmentReturn
		)
	});

	const chart = $derived.by(() => {
		if (!comparison) return null;
		const horizon = Math.min(comparison.months, 600);
		if (horizon < 2) return null;

		const plans = [
			{ id: 'A' as const, rate: inputs.aRate, monthly: 0 },
			{ id: 'B' as const, rate: inputs.bRate, monthly: investB },
			{ id: 'C' as const, rate: inputs.cRate, monthly: inputs.cInvestmentAmount }
		];
		const netAt = (p: (typeof plans)[number], month: number) =>
			netPosition({
				loanAmount,
				interestRate: inputs.interestRate,
				amortizationRate: p.rate,
				baselineRate: inputs.aRate,
				monthlyInvestment: p.monthly,
				investmentReturn: inputs.investmentReturn,
				month,
				borrowers: inputs.borrowers
			});

		// gok-chart data, sampled once a year plus the final month.
		const months: number[] = [];
		for (let i = 0; i <= horizon; i += 12) months.push(i);
		if (months.at(-1) !== horizon) months.push(horizon);

		return {
			labels: months.map((i) => `${+(i / 12).toFixed(1)} y`),
			series: plans.map((p) => ({
				name: SHORT[p.id],
				values: months.map((i) => Math.round(netAt(p, i)))
			}))
		};
	});

	return {
		inputs,
		get loanAmount() {
			return loanAmount;
		},
		get ltv() {
			return ltv;
		},
		get lti() {
			return lti;
		},
		get minAmortization() {
			return minAmortization;
		},
		get downShare() {
			return downShare;
		},
		get downPaymentError() {
			return downPaymentError;
		},
		get propertyError() {
			return propertyError;
		},
		get meetsRequirement() {
			return meetsRequirement;
		},
		get monthlyInterest() {
			return monthlyInterest;
		},
		get monthlyTaxBenefit() {
			return monthlyTaxBenefit;
		},
		get scenarios() {
			return scenarios;
		},
		get comparison() {
			return comparison;
		},
		get rankedIds() {
			return rankedIds;
		},
		get verdict() {
			return verdict;
		},
		get schedules() {
			return schedules;
		},
		get chart() {
			return chart;
		}
	};
}

export type MortgageModel = ReturnType<typeof createMortgageModel>;
