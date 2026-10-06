---
"@scenesystems/effect-search": minor
---

Align TPE kernels and trial-history handling with pinned Optuna 4.9.0. Use shared mixture components for joint categorical and mixed-space sampling, observation-only bandwidth neighbors, constraint-violation ordering, and greedy hypervolume subset selection.

Add `Context.pruned` with intermediate reports and retain reports in pruned trial state. Keep pending reservations separate from completed observations: TPE places running trials above and excludes them from startup counts; other samplers no longer receive imputed pending objectives. Trial reporting retains the first value for a duplicate step and accepts unseen decreasing steps.
