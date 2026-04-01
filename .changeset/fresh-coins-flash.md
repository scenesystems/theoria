---
"effect-search": patch
---

Reduce hot-path TPE overhead in `effect-search` so deterministic optimization stays within local test budgets.

- remove per-candidate Effect wrapper overhead from the univariate float and int TPE trace builders
- reduce continuous Parzen sampling and density allocation costs by reusing kernel parameter objects and array-native log-sum-exp paths
- apply the same log-density aggregation optimization to multivariate Gaussian scoring so correlated TPE runs remain competitive under repeated local verification
