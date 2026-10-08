---
"@scenesystems/effect-search": minor
---

Align TPE kernels and trial-history handling with pinned Optuna 4.9.0. Use shared mixture components for joint categorical and mixed-space sampling, observation-only bandwidth neighbors, constraint-violation ordering, and greedy hypervolume subset selection.

Add `Context.pruned` with intermediate reports and retain reports in pruned trial state. Keep pending reservations separate from completed observations: the new `constantLiar` option defaults to false; enabling it places running trials above without counting them toward startup. Other samplers no longer receive imputed pending objectives. Trial reporting retains the first value for a duplicate step and accepts unseen decreasing steps. Policies receive step-ordered reports; `Pruning.lastStepReport` selects the greatest step independently of arrival order.

Breaking: pruned trials retain their intermediate reports. `Trial.prune` takes a required `reports` argument (data-first arity 6, data-last arity 5), the `Pruned` variant of `Trial.State` requires `reports`, and persisted pruned trials without it are not decoded. No overload without reports is provided. `Sampler.Context.pruned` exposes `Sampler.PrunedObservation` values to samplers.

Breaking: default TPE pending handling and numeric trajectories change to match the pinned independent routing and component-before-value RNG draw order. Pruned configurations participate in constraint evaluation. Feasible-only multi-objective fronts, MOTPE contribution weights, quantized float cell densities and lazy hypervolume subset selection replace the previous policies. The many-objective splitter retains exact recorded identities without recursively recomputing every candidate volume. Continuous inverse-CDF and 3-D BLAS-weight comparisons retain explicit numerical tolerances; multivariate numeric trajectory identity is not claimed.
