# Mortgage calculator: standalone public repo

Moves the Swedish Mortgage Calculator out of this site into its own public SvelteKit repo, the way
gökberk bank lives in `gokberknur/gokberk-bank`. Comes before `2026-11-08-mortgage-layout.md`: the
layout redesign then happens in the new repo.

## Where the code is today

- **Original:** plain JS from StackBlitz, in the private repo `gokberknur/mortageCalculator` (one
  commit) and the local folders `~/Desktop/personal/mortageCALC` and `~/Desktop/personal/mortage`.
- **Current:** a Svelte 5 port inside this private site repo (`gokberknur/webpage`), commit `35ef9c9`
  plus three review rounds. Four files carry it:

  | File                                                | Role                                               |
  | --------------------------------------------------- | -------------------------------------------------- |
  | `src/lib/mortgage.ts`                               | Pure maths, no UI                                  |
  | `src/lib/mortgageModel.svelte.ts`                   | Inputs as `$state`, every output as `$derived`     |
  | `src/lib/components/mortgage/Setup.svelte`          | Loan inputs, plan cards, amortization rules dialog |
  | `src/lib/components/mortgage/ScheduleDialog.svelte` | 60-month schedule table                            |
  | `src/routes/mortgage-calculator/+page.svelte`       | Verdict, comparison table, chart, details          |

  The page also uses two site components, `Seo.svelte` and `Eyebrow.svelte`, and the site's global
  styles (`.page-head`, `.meta-label`, the glass surface, the theme toggle).

No rewrite is needed. The work is extraction: the Svelte code moves as it is.

## Assumptions

1. New public repo `gokberknur/swedish-mortgage-calculator`, created under the personal account.
2. Same stack as gokberk-bank: SvelteKit with `adapter-static`, Svelte 5, Vite, TypeScript,
   `@gokberknur/design-system` 0.30 from public npm. The calculator is client-side only, so a static
   build is enough.
3. The app is one page at `/`. Fonts, theme toggle and glass surface come from the design system,
   and the few site styles it needs are copied in as a small `app.css`.
4. The private `mortageCalculator` repo is left alone (archive it later if you want).
5. History starts fresh in the new repo; this site's history is not carried over.
6. Deploying to a subdomain is a later step, not part of this spec.

## Success criteria

1. `npm ci && npm run build` succeeds in the new repo on a clean clone.
2. `npm run dev` shows the calculator at `/` with the same figures as the site at default inputs
   (verdict "Invest the difference comes out ahead", lead +288 571 kr).
3. `npm run check` reports 0 errors; `svelte-autofixer` from the Svelte MCP is clean on every
   `.svelte` file.
4. One check covers the maths: a small test asserts the default-input verdict and lead, so the
   layout work cannot change the numbers by accident.
5. A README says what the tool does, how to run it, and the rules it models.
6. No secrets, personal data, or `.env` files in the repo; licence chosen (see open questions).
7. Repo pushed and public under `gokberknur`, verified with `gh repo view --json visibility`.
8. This site's projects table lists the repo URL and visibility.

## Phase 2: update to the rules in force since 1 April 2026

Runs after extraction and before the layout work, in the new repo, as its own commit with tests.
The extraction itself keeps the maths unchanged so the two steps can be checked separately.

### What changed

Researched 2026-11-08 from the government's press releases (17 June 2025, 5 March 2026) and
Swedbank's rules page. Sources are listed at the end of this section.

| Rule                     | Before 1 April 2026                             | Since 1 April 2026                                                                             |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Bolånetak (new purchase) | 85% of value, so 15% kontantinsats              | **90%**, so **10%** kontantinsats                                                              |
| Skärpt amorteringskrav   | +1%/yr when debt is over 4.5× income            | **Removed** for new loans. Existing loans keep it until the borrower and bank agree to drop it |
| Base amorteringskrav     | 2% above 70% LTV, 1% at 50–70%, 0 below 50%     | Unchanged                                                                                      |
| Tilläggslån cap          | 85% of value                                    | **80%**                                                                                        |
| Omvärdering              | Once per 5 years to lower amortization          | Same 5-year limit, now also for borrowing more                                                 |
| Ränteavdrag              | 30% up to 100 000 kr interest a year, 21% above | Unchanged for mortgages (unsecured loans lost theirs in 2026)                                  |

The limits also moved from Finansinspektionen's regulations into a new law. That changes the legal
form, not the numbers. Banks still stress-test with their own kalkylränta (roughly 6–7%; banks
differ and the sources I found disagree on exact figures). No rule sets it, so the calculator
should not model it.

### What the calculator gets wrong today

Checked against `src/lib/mortgage.ts`:

1. Requires 15% down (`minDownPayment`, the warning, the intro copy). Should be 10%.
2. Adds the +1% LTI requirement (`calculateSwedishAmortization`). At default inputs (3.4 M kr loan,
   600 000 kr salary, LTI 5.7×) this raises the minimum from 2% to 3%, which is why plan A
   defaults to 3%. For a loan taken today the minimum is 2%.
3. Ränteavdrag is a flat 30% with no 21% tier. At default inputs the interest is 102 000 kr a year,
   just over the 100 000 kr threshold, so the error is small but real.

### Phase 2 success criteria

1. Minimum down payment is 10%; copy and the rules dialog say 90% bolånetak.
2. The amortization minimum depends on LTV only for a new loan.
3. Ränteavdrag applies 30% up to 100 000 kr of yearly interest and 21% above it, per borrower.
4. The rules dialog states the date the rules took effect and links to the government source.
5. A switch "Loan taken before 1 April 2026" (off by default) brings back the 85% cap, 15% down and
   the +1% LTI requirement. The salary field shows only while the switch is on, since nothing else
   uses it.
6. A "One borrower / Two borrowers" choice (one by default) sets the 100 000 kr ränteavdrag threshold
   to 100 000 kr or 200 000 kr of yearly interest, assuming the loan is shared equally.
7. Tests cover each band edge (49.9%, 50%, 70%, 70.1% LTV), the 10% down boundary, and the
   100 000 kr tier, plus the updated default verdict.

### Sources

- [Regeringen, 5 March 2026: Nya lagändringar ska ge fler möjlighet att äga sin bostad](https://www.regeringen.se/pressmeddelanden/2026/03/nya-lagandringar-ska-ge-fler-mojlighet-att-aga-sin-bostad/)
- [Regeringen, 17 June 2025: Föreslagna förändringar av amorteringskrav och bolånetak](https://www.regeringen.se/pressmeddelanden/2025/06/foreslagna-forandringar-av-amorteringskrav-och-bolanetak/)
- [Swedbank: Nya bolåneregler](https://www.swedbank.se/privat/boende-och-bolan/rakna-pa-ditt-bolan/amortering-och-amorteringskrav/nya-amorteringsregler---sa-paverkas-du.html)
- [Handelsbanken: Nya regler för ränteavdrag](https://www.handelsbanken.se/sv/ekonomi-i-livet/privatekonomi/vardagshjalp/vardagsekonomi/nya-regler-for-ranteavdrag)
- [Skatteverket: Ränteavdrag](https://skatteverket.se/ranteavdrag)

Not read: the bill (prop. 2025/26:119) and the law text, so transitional details beyond the press
releases are unverified.

## Boundaries

- **Always:** use the personal account (`gh auth status` before any `gh` write), check in
  Chrome at 390px and 1280px, light and dark.
- **Ask first:** changing the site's `/mortgage-calculator` route, making the old repo public or
  deleting it, picking a domain.
- **Never:** change the maths during extraction, push to `main` of the site repo.

Pushing the first commit straight to `main` of a brand-new empty repo is the one exception that
needs your explicit OK, because there is no branch to open a PR against yet.

## Open questions

1. ~~Repo name?~~ Decided: `swedish-mortgage-calculator`.
2. ~~Licence?~~ Decided: MIT.
3. ~~Site route after extraction?~~ Decided: keep the site's copy untouched until the standalone
   version is deployed, then decide on a redirect.
4. ~~First commit straight to `main`?~~ Decided: yes, for the initial commit only.
5. Decided 2026-11-08: phase 2 also fixes net position so it counts the extra interest plans B and C
   pay compared with A (after ränteavdrag), with a test showing the verdict at default inputs.
6. ~~New loans only, or a switch?~~ Decided 2026-11-08: a switch (phase 2, criterion 5).
7. ~~One or two borrowers?~~ Decided 2026-11-08: an option (phase 2, criterion 6).
