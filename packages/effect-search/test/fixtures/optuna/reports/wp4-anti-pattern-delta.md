# WP-4 Anti-Pattern Delta

Date: 2026-03-16

## Scope Update (Work Package 6)

1. Runtime/orchestration hotspots were hardened to Effect-native collection/control-flow in `src/Study/{api,best,pareto}.ts` and `src/internal/constantLiar.ts`.
2. Residual sampler/math hardening landed in `src/internal/tpe/multivariateCategorical.ts` and `src/internal/tpe/continuousParzen/kernels.ts` (lookup composition and record assembly now use Effect structures).
3. FM-8 continuous parity depth was expanded with three additional Optuna-derived families: `continuous-kde.micro-positive-span`, `continuous-kde.extreme-asymmetric-range`, and `continuous-kde.upper-boundary-cluster`.
4. Truncated-normal stress depth was expanded with four additional cases in `truncated-normal.edge-cases`: `micro-support-far-right-mean`, `micro-support-far-left-mean`, `mean-near-low-bound-tiny-window`, `mean-near-high-bound-tiny-window`.
5. Fixture governance and replay/property proofs were updated in lockstep (`test/helpers/fixtures/{schemas,fmMatrix}.ts`, `test/Sampler/tpe/fixture-parity.test.ts`, `test/properties/{continuous-kde-invariants,truncatedNormal-invariants}.test.ts`, `test/internal/truncatedNormal.test.ts`).
6. Increment proof closure is green: `bun run fixtures:generate`, `bun run fixtures:check`, `bun run fixtures:verify`, `bun run lint`, `bun run check`, `bun run test`, `bun run build`.

## Delta Summary

1. The last open WP-4 done-when gate in M341 (runtime/orchestration anti-pattern hotspot replacement) is now satisfied in the tracked hotspot set.
2. FM-8 non-mixed continuous/truncated parity breadth now includes additional narrow-span, asymmetric-range, boundary-cluster, and micro-support far-mean stress families sourced from Optuna internals.
3. Governance evidence remains synchronized through schema unions, FM matrix fixtures, manifest decode, replay suites, and live verifier checks.

## Remaining Hotspots

1. None in the M341-scoped WP-4 hotspot inventory for this closure pass.
