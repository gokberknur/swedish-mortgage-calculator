# Mortgage calculator: layout redesign

Route: `/mortgage-calculator`. Follows `2026-11-08-glass-and-mortgage.md`, which polished details in
three review rounds but kept the page's top-to-bottom layout. This spec is about that layout.

## The product

One Swedish home loan, three ways to handle it:

- **A · Pay it down**: amortize fast, invest nothing. The baseline.
- **B · Invest the difference**: amortize less, invest what A would have amortized on top.
- **C · Hybrid**: amortize at your own rate and invest a fixed amount each month.

The page answers one question: which plan leaves me better off on the day A clears the loan? It applies
the Swedish rules (amorteringskrav, ränteavdrag, kontantinsats). The code still uses the rules from
before 1 April 2026; `2026-11-08-mortgage-standalone.md` phase 2 updates them before this layout work.

The reader is someone buying or holding a Swedish home who wants to try "what if" numbers. The core
loop is: change a number, watch the verdict move. Ten inputs drive it: five for the loan, one expected
return, and four plan settings.

## What is wrong with the layout today

Measured in Chrome with the default inputs.

1. **The answer sits far from the controls.** At 1280×800 the verdict starts at 1225px, below the
   fold. At 390×844 it starts at 2397px, almost three screens down. Every edit means scrolling down to
   see its effect and back up to make the next one.
2. **The phone comparison hides the winner.** The table shows 342px of its 509px, so a reader sees
   plan A and half of B. The winning column is often off-screen.
3. **Plan settings are long on phones.** Three stacked cards take about 1100px before any result.
4. **The chart's end labels collide.** "Invest the di…" is truncated on desktop, and on phones the
   x-axis shows three ticks for a 33-year span.
5. **First-month outlay is shown twice**, in each plan card and in the comparison table.

## Goal

Make the change-a-number, see-the-answer loop work on one screen, on a phone and on a desktop.

## Success criteria

1. At 1280×800, after editing any input, the verdict line and each plan's net position are visible
   without scrolling.
2. At 390×844, a summary of the verdict (winner and lead) stays visible while any input is being
   edited, and one tap reaches the full results.
3. On a 390px phone, all three plans' net positions are readable without horizontal scrolling.
4. No page-level horizontal scroll from 320px to 1440px, light and dark.
5. The verdict keeps its live region, and keyboard tab order follows the visual order.
6. `src/lib/mortgage.ts` and the maths in `mortgageModel.svelte.ts` are unchanged.
7. `npm run check`, `npm run lint`, `npm run build` and `npm run smoke` pass; `svelte-autofixer` is
   clean on every touched `.svelte` file.

## How we loop

1. **Sketch.** Three static layout directions, each at 390px and 1280px, as files in the Design Hub
   (Feature development tab). No code in the site yet. You pick one, or mix parts.
2. **Build** the chosen direction on a branch, composing `gok-*` components.
3. **Review loop.** A fresh-context `better-interface` review, then fix every HIGH and MEDIUM
   finding, then verify in Chrome at both widths. Repeat until the review says Approve or three
   rounds have run. Each round is logged at the end of this file.

Starting directions for the sketches:

- **Split pane.** Desktop: inputs in a sticky left column, results on the right. Phone: inputs first
  with a sticky bottom bar showing the winner and lead, tapping it jumps to results.
- **Results first.** The verdict and comparison lead the page; inputs sit in a compact "Your numbers"
  panel above them that can be collapsed. Phone: `gok-segmented` switches between Numbers and Results.
- **Plan columns.** Each plan becomes one column holding its own settings and its outcomes, merging
  the cards and the table. Phone: `gok-segmented` picks the plan, with the verdict pinned above.

## Boundaries

- **Always:** compose `gok-*` components, use `--gok-*` tokens, keep numbers mono and tabular, check
  both themes and both widths, keep "before ränteavdrag" labels.
- **Ask first:** removing any figure from the page, adding a dependency, changing copy beyond labels.
- **Never:** change the maths, push to `main`, open a PR without being asked (Actions minutes).

## Open questions

All decided 2026-11-08:

1. The net-position maths issue is fixed first, in phase 2 of `2026-11-08-mortgage-standalone.md`.
2. Phone and desktop carry equal weight; neither may be traded off against the success criteria.
3. Duplicates may merge and detail sections may move, as long as no figure leaves the page.

This work happens in the new `swedish-mortgage-calculator` repo, not in this site.

## Round log

Direction chosen 2026-11-08: **split pane** (sketch 1 in the Design Hub).

### Round 1: Block (2 HIGH, 4 MEDIUM, 3 LOW)

All fixed:

- HIGH: on phones the bottom bar covered the field you tabbed to. The page now keeps focused fields
  clear of it (`scroll-padding-bottom`).
- HIGH: the verdict could recommend a plan a bank would refuse, or one that wins only by spending
  more each month. A warning under the verdict now says so in either case. Hybrid's monthly
  investment is capped at 1 000 000 kr.
- MEDIUM: screen readers heard nothing when the lead changed but the winner didn't. The live region
  now includes the lead.
- MEDIUM: the input column trapped the scroll wheel on desktop. It now passes the scroll to the page.
- MEDIUM: the chart used three hues. The winner now takes the accent and the other two are greys;
  line ends use short tagged names ("B · Invest") so they no longer truncate.
- MEDIUM: "Total" meant two things. The schedule says "Payment (excl. avgift)" and "Interest
  (before ränteavdrag)".
- LOW: pinned table labels follow the results column width; the bottom bar comes right after the
  inputs in tab order; non-winning bars are quieter in dark mode.
