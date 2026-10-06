---
"@scenesystems/effect-dsp": minor
---

Align MIPROv2 grounded instruction proposals with DSPy 3.4.0: cached dataset summaries, program and predictor descriptions, augmented demonstration rotation, awareness flags, and a shared CPython stream for tips and rollout IDs. Generate proposal zero before preserving the original instruction. Replace cache-marker and cyclic-tip options with grounded proposer settings and recorded rollout partitions.

Persist `Demonstration.augmented` as a required boolean with constructor default false, marking only teacher-generated evidence true. Demonstration equivalence remains encoded input/output based. Defer the SavedState parameter schema reference so direct ParameterSet imports can round-trip the new demonstration shape without an initialization cycle.
