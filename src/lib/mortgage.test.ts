// Runs with `npm test` (node --test; Node 24 strips the types).
// Locks the default-input result so a refactor or layout change cannot move the numbers by accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	calculateLoanAmount,
	calculateLTV,
	calculateLTI,
	calculateSwedishAmortization,
	calculateScenario,
	calculateInvestmentGrowth
} from './mortgage.ts';

// The model's defaults (mortgageModel.svelte.ts).
const loan = calculateLoanAmount(4_000_000, 600_000);
const rate = 3;
const ret = 5;

test('default loan and amortization requirement', () => {
	assert.equal(loan, 3_400_000);
	assert.equal(Math.round(calculateLTV(loan, 4_000_000)), 85);
	const req = calculateSwedishAmortization(
		calculateLTV(loan, 4_000_000),
		calculateLTI(loan, 600_000)
	);
	assert.equal(req.totalMinimum, 3);
});

test('default verdict: Invest the difference ahead by 288 571 kr', () => {
	const a = calculateScenario(loan, rate, 3);
	const b = calculateScenario(loan, rate, 2);
	const c = calculateScenario(loan, rate, 2.5);
	const n = a.payoffTime.totalMonths;
	const net = (s: typeof a, monthly: number) =>
		calculateInvestmentGrowth(monthly, ret, n) - Math.max(0, loan - s.monthlyAmortization * n);
	const bNet = net(b, a.monthlyAmortization - b.monthlyAmortization);
	const cNet = net(c, 2000);
	assert.equal(Math.round(bNet), 1_774_475);
	assert.equal(Math.round(cNet), 1_485_904);
	assert.equal(Math.round(bNet - cNet), 288_571);
});
