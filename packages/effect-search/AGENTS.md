# effect-search

- Search owns samplers, ranking, pruning, optimization snapshots, and checkpoint
  replay. Generic evaluation, trial history, stop controls, storage, and artifact
  delivery belong to `effect-study`; study must not depend on search.
- `OptimizationStorage` specializes study storage with checkpoint/replay policy.
  Persistence does not require artifact delivery services. Do not re-export study
  capabilities under compatibility aliases.
- Keep runtime dependencies domain-independent: mathematical/study foundations
  and cryptographic boundary authorities, not app or Scene domain packages.
- Optuna reference fixtures live in `test/fixtures/optuna/`. Load
  `maintaining-fixtures` for generator or fixture changes. Use the package's
  `fixtures:check` and `fixtures:verify` scripts to validate them.
