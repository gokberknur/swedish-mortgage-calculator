# Swedish Mortgage Calculator

Pay off your Swedish mortgage faster, or invest instead? Live at
[mortgage.gokberk.se](https://mortgage.gokberk.se).

It compares three plans for one loan on the day the fastest one clears it:

- **A · Pay it down:** amortize fast, invest nothing.
- **B · Invest the difference:** amortize less, invest what A amortizes on top.
- **C · Hybrid:** your own rate, plus a fixed monthly investment.

Net position is investment value, minus any debt left, minus the extra interest (after ränteavdrag)
a plan pays compared with A. Everything runs in your browser.

## Rules

Swedish rules since 1 April 2026: at least 10% down; amortization of 2% a year above 70%
loan-to-value and 1% at 50–70%; ränteavdrag of 30% on the first 100 000 kr of yearly interest per
borrower and 21% above. A switch covers loans taken before that date (15% down, plus 1% when the
loan is over 4.5 times household income).

For information only, not financial advice.

## Run it

Needs Node 24.

```sh
npm install
npm run dev      # http://localhost:5173
npm test
npm run deploy   # build and publish (Cloudflare)
```

SvelteKit, Svelte 5 and [`@gokberknur/design-system`](https://www.npmjs.com/package/@gokberknur/design-system). MIT licence.
