# Todo: standalone mortgage calculator

See `tasks/plan.md`.

- [x] T1: Scaffold `swedish-mortgage-calculator`, copy the calculator, add the baseline test
  - Acceptance: app renders at `/` with the site's default figures (verdict "Invest the difference",
    lead +288 571 kr); MIT `LICENSE`; README covers what it does, how to run it, the rules modelled
  - Verify: `npm run build`, `npm run check`, `npm test`, `svelte-autofixer` on each `.svelte` file
  - Files: new repo skeleton, `src/lib/mortgage*.ts`, `src/lib/components/*`, `src/routes/+page.svelte`
- [x] T2: Checkpoint and publish
  - Acceptance: no console errors, no horizontal scroll at 390/1280, both themes; repo public under
    `gokberknur`; initial commit on `main`
  - Verify: Chrome DevTools pass; `gh auth status`; `gh repo view --json visibility`
- [x] T3: 2026 rules (branch `feat/rules-2026`)
  - Acceptance: phase 2 criteria 1–7 in the standalone spec, plus the net-position fix
  - Verify: `npm test` (band edges, 10% boundary, 100 000 / 200 000 kr tiers, switch on/off, new verdict)
  - Files: `mortgage.ts`, `mortgageModel.svelte.ts`, `Setup.svelte`, `+page.svelte`, `mortgage.test.ts`
- [x] T4: Checkpoint, site registry row, PR
  - Verify: Chrome pass; projects registry in the personal site shows repo URL and **public**
- [x] T5: Three layout sketches in the Design Hub, Feature development tab
  - Acceptance: split pane, results first, plan columns; each at 390 and 1280
- [ ] T6: Build the chosen direction (branch)
  - Verify: layout spec success criteria 1–7
- [ ] T7: Review loop, max 3 rounds, logged in the layout spec
- [ ] T8: Final checkpoint and PR
