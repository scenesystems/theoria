---
"effect-math": minor
---

Expand `effect-math/Calculus` with limit-accurate differential operators and adaptive quadrature.

- add Ridder-based derivative estimates with convergence metadata for first and second derivatives
- add multivariate operators including gradient, Jacobian, Hessian, directional derivative, divergence, and Laplacian, with validated and policy-aware counterparts
- add adaptive Simpson integration and extend fixture-backed calculus parity coverage to distinguish SciPy-backed quadrature expectations from analytic reference operators
