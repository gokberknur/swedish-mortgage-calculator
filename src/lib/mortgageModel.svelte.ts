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
	calculateScenario,
	calculateTotalInterestPaid,
	calculateInvestmentGrowth,
	simulateLoanPayments,
	simulateInvestmentGrowthMonthly,
	buildScenarioSchedule,
	formatCurrency,
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

export interface CardSame {
	amortPaid: number;
	interestPaid: number;
	remainingDebt: number;
	investment: number;
	financialPosition: number;
	payments: number;
	rate: number;
}

export interface CardFull {
	amortPaid: number;
	interestPaid: number;
	totalPaid: number;
	investment: number;
	payoffDisplay: string;
	payments: number;
	rate: number;
}

const META: Record<ScenarioId, { title: string; tag: string; desc: string }> = {
	A: {
		title: 'Pay it down',
		tag: 'A',
		desc: 'Amortize fast, no investing. The baseline everything else is measured against.'
	},
	B: {
		title: 'Invest the difference',
		tag: 'B',
		desc: 'Amortize less and invest the monthly difference vs. Pay it down.'
	},
	C: {
		title: 'Hybrid',
		tag: 'C',
		desc: 'Amortize at your own rate and invest a fixed amount each month.'
	}
};

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
		cInvestmentAmount: 2000
	});

	const loanAmount = $derived(calculateLoanAmount(inputs.propertyValue, inputs.downPayment));
	const ltv = $derived(calculateLTV(loanAmount, inputs.propertyValue));
	const lti = $derived(calculateLTI(loanAmount, inputs.annualSalary));
	const requirements = $derived(calculateSwedishAmortization(ltv, lti));
	const minDownPayment = $derived(inputs.propertyValue * 0.15);
	const downPaymentError = $derived(
		inputs.downPayment < minDownPayment && inputs.propertyValue > 0
			? `Enter at least ${formatCurrency(minDownPayment)} (15% of the property value)`
			: ''
	);
	const propertyError = $derived(
		inputs.propertyValue > 0 && loanAmount <= 0
			? `Enter a value above your down payment of ${formatCurrency(inputs.downPayment)}`
			: ''
	);
	const meetsRequirement = $derived(inputs.aRate >= requirements.totalMinimum);

	const monthlyInterest = $derived(calculateMonthlyInterest(loanAmount, inputs.interestRate));
	const monthlyTaxBenefit = $derived(calculateMonthlyTaxBenefit(monthlyInterest));

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
		const scenarioA = calculateScenario(loanAmount, inputs.interestRate, inputs.aRate);
		const payoffMonths = scenarioA.payoffTime.totalMonths;
		if (!isFinite(payoffMonths)) return null;

		const scenarioB = calculateScenario(loanAmount, inputs.interestRate, inputs.bRate);
		const scenarioC = calculateScenario(loanAmount, inputs.interestRate, inputs.cRate);
		const investmentB = calculateInvestmentGrowth(
			scenarioA.monthlyAmortization - scenarioB.monthlyAmortization,
			inputs.investmentReturn,
			payoffMonths
		);
		const investmentC = calculateInvestmentGrowth(
			inputs.cInvestmentAmount,
			inputs.investmentReturn,
			payoffMonths
		);

		const interestPaidA = calculateTotalInterestPaid(
			loanAmount,
			scenarioA.monthlyAmortization,
			inputs.interestRate,
			payoffMonths
		);
		const aCard = {
			amortPaid: loanAmount,
			interestPaid: interestPaidA,
			totalPaid: loanAmount + interestPaidA,
			payoffDisplay: scenarioA.payoffTime.display,
			payments: payoffMonths,
			rate: inputs.aRate
		};

		const sameAt = (s: typeof scenarioB, investment: number, rate: number): CardSame => {
			const remainingDebt = Math.max(0, loanAmount - s.monthlyAmortization * payoffMonths);
			const interestPaid = calculateTotalInterestPaid(
				loanAmount,
				s.monthlyAmortization,
				inputs.interestRate,
				payoffMonths
			);
			return {
				amortPaid: s.monthlyAmortization * payoffMonths,
				interestPaid,
				remainingDebt,
				investment,
				financialPosition: investment - remainingDebt,
				payments: payoffMonths,
				rate
			};
		};
		const bSame = sameAt(scenarioB, investmentB, inputs.bRate);
		const cSame = sameAt(scenarioC, investmentC, inputs.cRate);

		const fullAt = (
			s: typeof scenarioB,
			monthlyContribution: number,
			rate: number
		): CardFull | null => {
			const months = s.payoffTime.totalMonths;
			if (!isFinite(months)) return null;
			const interestPaid = calculateTotalInterestPaid(
				loanAmount,
				s.monthlyAmortization,
				inputs.interestRate,
				months
			);
			return {
				amortPaid: loanAmount,
				interestPaid,
				totalPaid: loanAmount + interestPaid,
				investment: calculateInvestmentGrowth(monthlyContribution, inputs.investmentReturn, months),
				payoffDisplay: s.payoffTime.display,
				payments: months,
				rate
			};
		};
		const bFull = fullAt(
			scenarioB,
			scenarioA.monthlyAmortization - scenarioB.monthlyAmortization,
			inputs.bRate
		);
		const cFull = fullAt(scenarioC, inputs.cInvestmentAmount, inputs.cRate);

		return { aCard, bSame, cSame, bFull, cFull };
	});

	const verdict = $derived.by(() => {
		if (!comparison) return null;
		const entries = [
			{ id: 'A' as const, title: META.A.title, fp: 0 },
			{ id: 'B' as const, title: META.B.title, fp: comparison.bSame.financialPosition },
			{ id: 'C' as const, title: META.C.title, fp: comparison.cSame.financialPosition }
		].sort((x, y) => y.fp - x.fp);
		return {
			best: entries[0],
			lead: entries[0].fp - entries[1].fp,
			payoff: comparison.aCard.payoffDisplay
		};
	});

	const netBarMax = $derived(
		comparison
			? Math.max(1, 0, comparison.bSame.financialPosition, comparison.cSame.financialPosition)
			: 1
	);

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
		const horizon = Math.min(comparison.aCard.payments, 600);
		if (horizon < 2) return null;

		const series = [
			{
				id: 'A' as const,
				sim: simulateLoanPayments(loanAmount, inputs.interestRate, inputs.aRate, horizon),
				inv: simulateInvestmentGrowthMonthly(0, inputs.investmentReturn, horizon)
			},
			{
				id: 'B' as const,
				sim: simulateLoanPayments(loanAmount, inputs.interestRate, inputs.bRate, horizon),
				inv: simulateInvestmentGrowthMonthly(investB, inputs.investmentReturn, horizon)
			},
			{
				id: 'C' as const,
				sim: simulateLoanPayments(loanAmount, inputs.interestRate, inputs.cRate, horizon),
				inv: simulateInvestmentGrowthMonthly(
					inputs.cInvestmentAmount,
					inputs.investmentReturn,
					horizon
				)
			}
		].map((s) => ({
			id: s.id,
			net: s.sim.results.map((r, i) => (s.inv[i]?.investmentBalance ?? 0) - r.remainingLoan)
		}));

		// gok-chart data, sampled once a year plus the final month.
		const months: number[] = [];
		for (let i = 0; i <= horizon; i += 12) months.push(i);
		if (months.at(-1) !== horizon) months.push(horizon);

		return {
			labels: months.map((i) => `${+(i / 12).toFixed(1)} y`),
			series: series.map((s) => ({
				name: META[s.id].title,
				values: months.map((i) => Math.round(s.net[i] ?? 0))
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
		get requirements() {
			return requirements;
		},
		get minDownPayment() {
			return minDownPayment;
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
		get verdict() {
			return verdict;
		},
		get netBarMax() {
			return netBarMax;
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
