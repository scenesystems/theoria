---
"@scenesystems/effect-math": minor
"@scenesystems/effect-search": minor
---

Add `PseudoRandom` CPython and NumPy legacy streams over one MT19937 engine, with portable checkpoints and bit-exact upstream random/sequence fixtures. Move DSP sampling to the numerical package without a re-export shim. Add NumPy-order `Numeric.sumPairwise` and use it in `logSumExp`.

Align seeded categorical RandomSampler and TPE with Optuna's persistent startup and model streams, singleton handling, categorical draw order, and product-mixture scoring. Persist both streams through JSON optimization checkpoints. Exact trajectory checks stop before libm-sensitive acquisition ties; identical-input ties retain the earliest candidate.
