/**
 * Swedish mortgage calculation engine.
 *
 * A DOM-free port of the original vanilla-JS calculator. The original model's
 * quirks are preserved deliberately:
 *   1. Amortization is straight-line on the ORIGINAL loan (fixed kr/month).
 *   2. Headline monthly interest uses the full original balance (does not decline);
 *      only the simulation helpers use a declining balance.
 *   3. Monthly fee (avgift) is excluded from all cumulative/total/net-position math.
 *
 * Rules are the ones in force since 1 April 2026 (90% bolånetak, no income-based extra
 * amortization), with a `legacy` flag for loans taken before that date.
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
export const RANTEAVDRAG_THRESHOLD = 100_000;

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

export interface AmortRequirement {
	ltvRequirement: number;
	ltiRequirement: number;
	totalMinimum: number;
}

/**
 * Amorteringskrav: Sweden's mandatory amortization minimum.
 *   LTV > 70%  → 2%/yr,  50–70% → 1%/yr,  < 50% → 0%.
 *   Loans taken before 1 April 2026 (`legacy`) also keep: LTI > 4.5× → +1%/yr.
 */
export function calculateSwedishAmortization(
	ltv: number,
	lti: number,
	legacy = false
): AmortRequirement {
	let ltvRequirement = 0;
	let ltiRequirement = 0;

	if (ltv > 70) {
		ltvRequirement = 2;
	} else if (ltv >= 50) {
		ltvRequirement = 1;
	}

	if (legacy && lti > 4.5) {
		ltiRequirement = 1;
	}

	return {
		ltvRequirement,
		ltiRequirement,
		totalMinimum: ltvRequirement + ltiRequirement
	};
}

export interface Scenario {
	loanAmount: number;
	monthlyInterest: number;
	monthlyAmortization: number;
	monthlyTaxBenefit: number;
	totalMonthly: number;
	payoffTime: PayoffTime;
}

export function calculateScenario(
	loanAmount: number,
	interestRate: number,
	amortizationRate: number,
	borrowers = 1
): Scenario {
	const monthlyInterest = calculateMonthlyInterest(loanAmount, interestRate);
	const monthlyAmortization = calculateMonthlyAmortization(loanAmount, amortizationRate);
	const monthlyTaxBenefit = calculateMonthlyTaxBenefit(monthlyInterest, borrowers);
	const payoffTime = calculatePayoffTime(loanAmount, monthlyAmortization);

	return {
		loanAmount,
		monthlyInterest,
		monthlyAmortization,
		monthlyTaxBenefit,
		totalMonthly: monthlyInterest + monthlyAmortization,
		payoffTime
	};
}

/** Total interest over `months`, on a DECLINING balance with fixed amortization. */
export function calculateTotalInterestPaid(
	initialLoan: number,
	monthlyAmortization: number,
	annualInterestRate: number,
	months: number
): number {
	if (monthlyAmortization <= 0 || months <= 0 || initialLoan <= 0) return 0;

	let remainingBalance = initialLoan;
	let totalInterest = 0;
	const monthlyRate = annualInterestRate / 100 / 12;

	for (let i = 0; i < months; i++) {
		if (remainingBalance <= 0) break;
		totalInterest += remainingBalance * monthlyRate;
		remainingBalance -= monthlyAmortization;
	}

	return totalInterest;
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

export interface LoanPaymentMonth {
	month: number;
	remainingLoan: number;
	monthlyInterest: number;
	monthlyAmortization: number;
	monthlyTaxBenefit: number;
	cumulativeInterest: number;
	cumulativeAmortization: number;
	cumulativeTaxBenefit: number;
	isPayoff: boolean;
}

export interface LoanSimulation {
	results: LoanPaymentMonth[];
	payoffMonth: number | null;
}

export function simulateLoanPayments(
	initialLoan: number,
	annualInterestRate: number,
	annualAmortizationRate: number,
	months: number,
	borrowers = 1
): LoanSimulation {
	const results: LoanPaymentMonth[] = [];
	let remainingLoan = initialLoan;
	let cumulativeInterest = 0;
	let cumulativeAmortization = 0;
	let cumulativeTaxBenefit = 0;
	const monthlyAmortization = (initialLoan * (annualAmortizationRate / 100)) / 12;
	let payoffMonth: number | null = null;

	for (let month = 0; month <= months; month++) {
		const monthlyInterest = (remainingLoan * (annualInterestRate / 100)) / 12;
		const monthlyAmortPayment =
			remainingLoan > 0 ? Math.min(monthlyAmortization, remainingLoan) : 0;
		const monthlyTaxBenefit = calculateMonthlyTaxBenefit(monthlyInterest, borrowers);

		if (month > 0) {
			cumulativeInterest += monthlyInterest;
			const actualAmortPaid = Math.min(monthlyAmortization, remainingLoan);
			cumulativeAmortization += actualAmortPaid;
			cumulativeTaxBenefit += monthlyTaxBenefit;
			remainingLoan = Math.max(0, remainingLoan - monthlyAmortization);
		}

		results.push({
			month,
			remainingLoan,
			monthlyInterest,
			monthlyAmortization: monthlyAmortPayment,
			monthlyTaxBenefit,
			cumulativeInterest,
			cumulativeAmortization,
			cumulativeTaxBenefit,
			isPayoff: false
		});

		if (remainingLoan === 0 && month > 0 && payoffMonth === null) {
			payoffMonth = month;
			results[results.length - 1].isPayoff = true;
		}
	}

	return { results, payoffMonth };
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
	const b = p.borrowers ?? 1;
	const at = (rate: number) =>
		simulateLoanPayments(p.loanAmount, p.interestRate, rate, p.month, b).results[p.month];
	const plan = at(p.amortizationRate);
	const base = at(p.baselineRate);
	const extraInterest =
		plan.cumulativeInterest -
		plan.cumulativeTaxBenefit -
		(base.cumulativeInterest - base.cumulativeTaxBenefit);
	return (
		calculateInvestmentGrowth(p.monthlyInvestment, p.investmentReturn, p.month) -
		plan.remainingLoan -
		extraInterest
	);
}
