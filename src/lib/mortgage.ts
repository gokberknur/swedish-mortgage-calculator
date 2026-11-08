/**
 * Swedish mortgage maths, no UI. Model assumptions:
 *   1. Amortization is straight-line on the original loan (fixed kr/month).
 *   2. The headline monthly interest uses the original balance; `interestOver` uses the declining one.
 *   3. The monthly fee (avgift) is left out of every total and of net position.
 * Rules are the ones in force since 1 April 2026, with a `legacy` flag for older loans.
 */

/** The date the current Swedish mortgage rules took effect. */
export const RULES_DATE = '1 April 2026';
export const RULES_SOURCE =
	'https://www.regeringen.se/pressmeddelanden/2026/03/nya-lagandringar-ska-ge-fler-mojlighet-att-aga-sin-bostad/';

/** Minimum kontantinsats as a share of the property value: 10% since 1 April 2026, 15% before. */
export function minDownShare(legacy = false): number {
	return legacy ? 0.15 : 0.1;
}

/** Ränteavdrag threshold: 30% on the first 100 000 kr of yearly interest per borrower, 21% above. */
const RANTEAVDRAG_THRESHOLD = 100_000;

/** Yearly tax reduction for `annualInterest` kr of interest, shared equally by `borrowers`. */
export function annualTaxReduction(annualInterest: number, borrowers = 1): number {
	const cap = RANTEAVDRAG_THRESHOLD * borrowers;
	return 0.3 * Math.min(annualInterest, cap) + 0.21 * Math.max(0, annualInterest - cap);
}

const currencyFormatter = new Intl.NumberFormat('sv-SE', {
	style: 'currency',
	currency: 'SEK',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});

export function formatCurrency(amount: number): string {
	return currencyFormatter.format(amount);
}

export function calculateMonthlyInterest(loanAmount: number, interestRate: number): number {
	return (loanAmount * (interestRate / 100)) / 12;
}

/**
 * Ränteavdrag for one month, applying the yearly tiers to this month's interest run at a year's pace.
 * ponytail: exact when interest is flat within a year; on a declining balance it differs from
 * Skatteverket's yearly sum by a few kronor a year. Sum per calendar year if that ever matters.
 */
export function calculateMonthlyTaxBenefit(monthlyInterest: number, borrowers = 1): number {
	return annualTaxReduction(monthlyInterest * 12, borrowers) / 12;
}

/** Straight-line amortization: a fixed share of the ORIGINAL loan per month. */
export function calculateMonthlyAmortization(loanAmount: number, amortizationRate: number): number {
	return (loanAmount * (amortizationRate / 100)) / 12;
}

export interface PayoffTime {
	years: number;
	months: number;
	totalMonths: number;
	display: string;
}

export function calculatePayoffTime(loanAmount: number, monthlyAmortization: number): PayoffTime {
	if (monthlyAmortization <= 0 || loanAmount <= 0) {
		return {
			years: Infinity,
			months: Infinity,
			totalMonths: Infinity,
			display: 'Never (0% amortization)'
		};
	}

	const totalMonths = Math.ceil(loanAmount / monthlyAmortization);
	const years = Math.floor(totalMonths / 12);
	const months = totalMonths % 12;

	let display = '';
	if (years > 0) {
		display += years + (years === 1 ? ' year' : ' years');
	}
	if (months > 0) {
		if (years > 0) display += ' ';
		display += months + (months === 1 ? ' month' : ' months');
	}

	return { years, months, totalMonths, display };
}

export function calculateLoanAmount(propertyValue: number, downPayment: number): number {
	return Math.max(0, propertyValue - downPayment);
}

/** Belåningsgrad: loan-to-value, as a percentage. */
export function calculateLTV(loanAmount: number, propertyValue: number): number {
	if (propertyValue === 0) return 0;
	return (loanAmount / propertyValue) * 100;
}

/** Skuldkvot: loan-to-income, as a multiple of gross annual salary. */
export function calculateLTI(loanAmount: number, annualSalary: number): number {
	if (annualSalary === 0) return 0;
	return loanAmount / annualSalary;
}

/**
 * Amorteringskrav: Sweden's mandatory amortization minimum, in %/yr.
 *   LTV > 70%  → 2%/yr,  50–70% → 1%/yr,  < 50% → 0%.
 *   Loans taken before 1 April 2026 (`legacy`) also keep: LTI > 4.5× → +1%/yr.
 */
export function calculateSwedishAmortization(ltv: number, lti: number, legacy = false): number {
	return (ltv > 70 ? 2 : ltv >= 50 ? 1 : 0) + (legacy && lti > 4.5 ? 1 : 0);
}

/**
 * Interest over `months` on a declining balance with fixed amortization, the ränteavdrag on it, and
 * the balance left at the end.
 */
export function interestOver(
	loan: number,
	monthlyAmortization: number,
	annualRate: number,
	months: number,
	borrowers = 1
) {
	let balance = loan;
	let interest = 0;
	let deduction = 0;
	for (let i = 0; i < months && balance > 0; i++) {
		const m = (balance * annualRate) / 1200;
		interest += m;
		deduction += calculateMonthlyTaxBenefit(m, borrowers);
		balance = Math.max(0, balance - monthlyAmortization);
	}
	return { interest, deduction, balance };
}

/** Future value of an ordinary annuity (contribution at the end of each month). */
export function calculateInvestmentGrowth(
	monthlyContribution: number,
	annualReturn: number,
	months: number
): number {
	if (monthlyContribution <= 0 || months <= 0) return 0;

	const monthlyRate = annualReturn / 100 / 12;
	if (monthlyRate === 0) {
		return monthlyContribution * months;
	}

	return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

export interface ScheduleRow {
	month: number;
	monthlyInterest: number;
	monthlyAmortization: number;
	monthlyInvestment: number;
	investmentValue: number;
	monthlyTotal: number;
}

export interface ScenarioSchedule {
	rows: ScheduleRow[];
	totalInterest: number;
	totalAmortization: number;
	totalInvested: number;
	finalInvestmentValue: number;
	totalPaid: number;
}

/**
 * Month-by-month payment schedule (default 60 months), matching the original
 * `generateScenarioTable`. Note the ordering quirk: the investment is compounded
 * THEN the contribution is added (`value*(1+r) + contribution`).
 */
export function buildScenarioSchedule(
	initialLoan: number,
	interestRate: number,
	amortizationRate: number,
	monthlyInvestment: number,
	investmentReturn: number,
	months = 60
): ScenarioSchedule {
	const rows: ScheduleRow[] = [];
	let currentLoan = initialLoan;
	let investmentValue = 0;
	let totalInterest = 0;
	let totalAmortization = 0;
	let totalInvested = 0;
	let totalPaid = 0;

	const monthlyReturnRate = investmentReturn / 100 / 12;

	for (let month = 1; month <= months; month++) {
		const monthlyInterest = calculateMonthlyInterest(currentLoan, interestRate);
		const monthlyAmortization = Math.min(
			calculateMonthlyAmortization(initialLoan, amortizationRate),
			currentLoan
		);

		investmentValue = investmentValue * (1 + monthlyReturnRate) + monthlyInvestment;

		const monthlyTotal = monthlyInterest + monthlyAmortization + monthlyInvestment;

		totalInterest += monthlyInterest;
		totalAmortization += monthlyAmortization;
		totalInvested += monthlyInvestment;
		totalPaid += monthlyTotal;

		rows.push({
			month,
			monthlyInterest,
			monthlyAmortization,
			monthlyInvestment,
			investmentValue,
			monthlyTotal
		});

		currentLoan = Math.max(0, currentLoan - monthlyAmortization);
	}

	return {
		rows,
		totalInterest,
		totalAmortization,
		totalInvested,
		finalInvestmentValue: investmentValue,
		totalPaid
	};
}

export interface NetPositionInput {
	loanAmount: number;
	interestRate: number;
	/** This plan's amortization, %/yr of the original loan. */
	amortizationRate: number;
	/** Plan A's amortization: the baseline whose interest bill the plan is measured against. */
	baselineRate: number;
	monthlyInvestment: number;
	investmentReturn: number;
	month: number;
	borrowers?: number;
}

/**
 * A plan's net position after `month` months: investment value − remaining debt − the extra
 * interest (after ränteavdrag) it has paid compared with the baseline plan. A plan that amortizes
 * less keeps a bigger balance and so pays more interest; that cash would otherwise have been
 * invested or kept, so it counts against the plan. The baseline itself always scores 0.
 */
export function netPosition(p: NetPositionInput): number {
	const at = (rate: number) =>
		interestOver(
			p.loanAmount,
			calculateMonthlyAmortization(p.loanAmount, rate),
			p.interestRate,
			p.month,
			p.borrowers
		);
	const plan = at(p.amortizationRate);
	const base = at(p.baselineRate);
	const extraInterest = plan.interest - plan.deduction - (base.interest - base.deduction);
	return (
		calculateInvestmentGrowth(p.monthlyInvestment, p.investmentReturn, p.month) -
		plan.balance -
		extraInterest
	);
}
