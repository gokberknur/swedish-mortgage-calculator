# Plan: standalone mortgage calculator, 2026 rules, layout loop

Specs: `docs/specs/2026-11-08-mortgage-standalone.md` (phases 1 and 2) and
`docs/specs/2026-11-08-mortgage-layout.md`.

> Supersedes the music record crate plan (completed; recoverable via `git show 950d20a:tasks/plan.md`).

The plan lives here until the new repo exists; T1 copies it and the two specs into that repo, and
from then on the new repo's `tasks/` is the one that gets updated.

## Approach

- **New repo** at `~/Desktop/personal/swedish-mortgage-calculator`: SvelteKit + `adapter-static`,
  Svelte 5, TypeScript, Vite, `@gokberknur/design-system` ^0.30. Same skeleton as gokberk-bank.
- **The app is one route (`/`).** The five calculator files are copied as they are. `Seo` and `Eyebrow`
  are copied too (both are tiny). The few global rules the page leans on (`.page-head`,
  `.meta-label`, page width, glass background) move into one `src/app.css`; the dark-default theme
  script and `data-surface="glass"` go into `app.html`. A small theme toggle reuses the site's
  `ThemeToggle.svelte`.
- **Maths check:** `node --test` runs a `.test.ts` file directly (Node 24 strips types), so no test
  framework is added. `src/lib/mortgage.test.ts` locks the default-input numbers in T1, then grows
  with the rule edges in T3.
- **Svelte MCP:** every touched `.svelte` file goes through `svelte-autofixer` until clean.

## Order

```
T1  Scaffold new repo, copy calculator, baseline test           (phase 1)
T2  CP: build, check, test, Chrome 390/1280 light+dark; create public repo; first push to main
T3  2026 rules + pre-April switch + borrowers option + net-position fix, with tests   (phase 2, branch + PR)
T4  CP: test, check, Chrome; site registry row; PR for review
T5  Three layout sketches in the Design Hub (390 + 1280 each)
--  You pick a direction
T6  Build chosen layout (branch)
T7  Review loop: better-interface review → fix HIGH/MEDIUM → Chrome verify; up to 3 rounds (/loop)
T8  CP: everything green, round log written, PR
```

## Risks

- **DS standalone loading.** The site imports `@gokberknur/design-system/standalone` in `onMount`;
  the new app must do the same or the `gok-*` elements never register. Caught in T2's Chrome pass.
- **The net-position fix changes the verdict.** Expected, and the reason it ships before the layout
  work. T3's test records the new default verdict, and the PR description states old versus new.
- **Two `main`-branch rules.** Only T2's initial commit goes straight to `main`, as agreed. Every later
  task uses a branch and a PR. PRs are opened in the new repo only, since its Actions minutes are
  separate from this site's. If the new repo gets CI, the workflow runs locally first.
- **Site copy drifts.** The site's `/mortgage-calculator` keeps the old rules until it is redirected.
  Accepted for now (decided 2026-11-08).
