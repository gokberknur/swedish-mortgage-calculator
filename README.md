# Swedish Mortgage Calculator

Should you pay your Swedish mortgage down fast, or amortize the minimum and invest the difference?
This calculator takes one loan and compares three plans:

- **A · Pay it down:** amortize fast, invest nothing. The baseline.
- **B · Invest the difference:** amortize less, and invest what plan A would have amortized on top.
- **C · Hybrid:** amortize at your own rate and invest a fixed amount each month.

It judges every plan on the day plan A clears the loan, using net position: investment value minus
any debt left. Everything runs in the browser; nothing you type is sent anywhere.

## Rules it models

- **Amorteringskrav:** 2% a year above 70% loan-to-value, 1% at 50–70%, nothing below 50%.
- **Skärpt amorteringskrav:** +1% a year when the loan is over 4.5 times gross yearly income.
- **Kontantinsats:** at least 15% down.
- **Ränteavdrag:** 30% of interest back as a tax reduction.

These are the rules from before 1 April 2026. The update to the current rules (90% loan cap, no
income-based extra amortization, the 21% ränteavdrag tier above 100 000 kr) is in progress; see
`docs/specs/2026-11-08-mortgage-standalone.md`.

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
