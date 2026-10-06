---
"@scenesystems/effect-dsp": minor
---

Align MIPROv2 compile defaults, auto budgets, validation splitting, and seeded multivariate TPE trial scheduling with DSPy 3.4.0. Record baseline, sampled trials, and inserted full-validation checkpoints separately; choose checkpoints by mean minibatch score and return only the best full-validation program. Expose trial evidence in events and reports, preserve zero-shot proposer evidence without a demo search dimension, and report invalid datasets/options and exhausted checkpoint combinations as typed MIPROv2 errors.

Verify full-compile seeded prefixes against pinned upstream runs and test the remaining trial-selection policy using local scores beyond libm-sensitive ties. Include fully strict auto-minibatch coverage and Python-compatible percentage rounding.
