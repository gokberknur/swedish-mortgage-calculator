// Runs with `npm test` (node --test; Node 24 strips the types).
// Locks the rules and the default-input result so a refactor or layout change cannot move the
// numbers by accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	annualTaxReduction,
	calculateMonthlyAmortization,
	calculateScenario,
	calculateSwedishAmortization,
	minDownShare,
	netPosition
} from './mortgage.ts';

test('amorteringskrav bands by loan-to-value', () => {
	assert.equal(calculateSwedishAmortization(49.9, 0).totalMinimum, 0);
	assert.equal(calculateSwedishAmortization(50, 0).totalMinimum, 1);
	assert.equal(calculateSwedishAmortization(70, 0).totalMinimum, 1);
	assert.equal(calculateSwedishAmortization(70.1, 0).totalMinimum, 2);
});

test('the +1% income rule applies only to loans taken before 1 April 2026', () => {
	assert.equal(calculateSwedishAmortization(85, 5.7).totalMinimum, 2);
	assert.equal(calculateSwedishAmortization(85, 5.7, true).totalMinimum, 3);
	assert.equal(calculateSwedishAmortization(85, 4.5, true).totalMinimum, 2);
});

test('minimum down payment: 10% now, 15% before 1 April 2026', () => {
	assert.equal(minDownShare(), 0.1);
	assert.equal(minDownShare(true), 0.15);
});

test('ränteavdrag: 30% up to 100 000 kr of interest per borrower, 21% above', () => {
	assert.equal(annualTaxReduction(100_000), 30_000);
	assert.equal(Math.round(annualTaxReduction(102_000)), 30_420);
	assert.equal(annualTaxReduction(102_000, 2), 30_600);
	assert.equal(Math.round(annualTaxReduction(250_000, 2)), 70_500);
});

// The model's defaults: 4 000 000 kr property, 600 000 kr down, 3% interest, 5% return,
// plans A 3%, B 2%, C 2.5% + 2 000 kr/month.
const loan = 3_400_000;
const month = calculateScenario(loan, 3, 3).payoffTime.totalMonths;
const at = (amortizationRate: number, monthlyInvestment: number, borrowers = 1) =>
	Math.round(
		netPosition({
			loanAmount: loan,
			interestRate: 3,
			amortizationRate,
			baselineRate: 3,
			monthlyInvestment,
			investmentReturn: 5,
			month,
			borrowers
		})
	);
const diff = calculateMonthlyAmortization(loan, 3) - calculateMonthlyAmortization(loan, 2);

test('net position: the baseline plan scores 0 at its payoff', () => {
	assert.equal(month, 400);
	assert.equal(at(3, 0), 0);
});

test('default verdict: Invest the difference ahead of Hybrid by 90 716 kr', () => {
	// Investment − remaining debt alone gave 1 774 475 and 1 485 904 (a 288 571 kr lead); the
	// extra after-tax interest each plan pays versus Pay it down now counts against it.
	const b = at(2, diff);
	const c = at(2.5, 2000);
	assert.equal(b, 1_378_771);
	assert.equal(c, 1_288_055);
	assert.equal(b - c, 90_716);
});

test('two borrowers keep more of the deduction', () => {
	assert.ok(at(2, diff, 2) > at(2, diff, 1));
});
