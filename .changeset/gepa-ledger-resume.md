---
"@scenesystems/effect-dsp": minor
---

Align GEPA's train/validation split, epoch-shuffled reflection batches, coverage-pruned parent choice, aggregate-best return, common-ancestor merges, and iteration-boundary metric ledger with pinned DSPy 3.4.0 / GEPA 0.1.4 execution. Expose targeted feedback calls separately from the metric budget, route reflection through critic settings, and retain actual predictor input/raw output for format-failure feedback.

Add serializable GEPA checkpoints and exact local continuation, including both CPython random streams and epoch/merge scheduler state. Verify accepted and rejected merge orchestration and budget overshoot against upstream, retire the aggregate-best expected failure, and document bounded core algorithm parity and deliberate native-prompt, ordering, and stronger-resume differences.

Use CPython-compatible compensated sums for aggregate selection, coverage tie-breaking, mutation/merge acceptance, and ancestor weights. Exact upstream tie fixtures prevent floating-point accumulation from turning an equal score into an improvement. Preserve the uncompensated cumulative-weight scan used by Python `random.choices`.
