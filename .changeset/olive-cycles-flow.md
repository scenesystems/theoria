---
"effect-math": patch
---

Harden numerical and maintenance correctness around advanced sampler math migration.

- `effect-math`: enforce SPD symmetry preconditions in linear solver kernels and add regression tests so non-symmetric matrices are rejected by Cholesky/SPD solve paths.
- `effect-math`: improve public API docstrings for solver and probability transform operations with clearer preconditions, failure semantics, and runnable examples.
