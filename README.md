# Swedish Mortgage Calculator

Should you pay your Swedish mortgage down fast, or amortize the minimum and invest the difference?
This calculator takes one loan and compares three plans:

- **A · Pay it down:** amortize fast, invest nothing. The baseline.
- **B · Invest the difference:** amortize less, and invest what plan A would have amortized on top.
- **C · Hybrid:** amortize at your own rate and invest a fixed amount each month.

It judges every plan on the day plan A clears the loan, using net position (defined below). Everything runs in the browser; nothing you type is sent anywhere.

## Rules it models

The rules in force since 1 April 2026
([Regeringen](https://www.regeringen.se/pressmeddelanden/2026/03/nya-lagandringar-ska-ge-fler-mojlighet-att-aga-sin-bostad/)):

- **Kontantinsats:** at least 10% down (the bolånetak is 90%).
- **Amorteringskrav:** 2% a year above 70% loan-to-value, 1% at 50–70%, nothing below 50%.
- **Ränteavdrag:** 30% of the first 100 000 kr of yearly interest per borrower, 21% above. Choose one
  or two borrowers; the loan is split equally.

A switch covers loans taken before 1 April 2026: 15% down, plus 1% extra amortization when the loan
is over 4.5 times gross yearly income. Those loans keep the old rule until the borrower and the bank
agree to drop it.

Net position is investment value, minus any debt left, minus the extra interest (after ränteavdrag)
the plan paid compared with Pay it down. Amortizing less means a bigger balance and a bigger interest bill, and that cash counts
against the plan.

For information only, not financial advice.

## Run it

Needs Node 24.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # maths checks (node --test)
npm run check    # types and Svelte
npm run build    # static site in build/
```

## Stack

SvelteKit with `adapter-static`, Svelte 5, TypeScript, and the
[`@gokberknur/design-system`](https://www.npmjs.com/package/@gokberknur/design-system) web components.

- `src/lib/mortgage.ts`: the maths, no UI.
- `src/lib/mortgageModel.svelte.ts`: inputs as `$state`, every result as `$derived`.
- `src/lib/components/`: loan and plan inputs, the schedule dialog.
- `src/routes/+page.svelte`: verdict, comparison, chart and details.

## Licence

MIT
