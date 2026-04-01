---
"effect-search": patch
---

Reduce hot-path TPE overhead in `effect-search` so deterministic optimization stays within local test budgets.

- remove per-candidate Effect wrapper overhead from the univariate float and int TPE trace builders
- reduce continuous Parzen sampling and density overhead by reusing kernel parameter objects in the hot path
- route continuous Parzen and multivariate Gaussian log-density aggregation through the shared `effect-math` `logSumExp` authority so the sampler stays aligned to the math source of truth
