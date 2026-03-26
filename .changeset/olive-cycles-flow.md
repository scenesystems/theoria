---
"effect-math": patch
"effect-search": patch
---

Harden numerical and maintenance correctness around advanced sampler math migration.

- `effect-math`: enforce SPD symmetry preconditions in linear solver kernels and add regression tests so non-symmetric matrices are rejected by Cholesky/SPD solve paths.
- `effect-math`: improve public API docstrings for solver and probability transform operations with clearer preconditions, failure semantics, and runnable examples.
- `effect-search`: extend fixture verification coverage to include advanced sampler parity fixtures so manifest entries are actively validated during `fixtures:verify`.
