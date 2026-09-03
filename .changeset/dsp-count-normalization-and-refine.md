---
"@scenesystems/effect-dsp": patch
---

- `Module.load` validates every saved entry before writing and applies the ref updates uninterruptibly, so a failure or interruption during validation leaves the module tree unchanged.
- `Module.refine` serializes concurrent `forward` calls and restores the inner module parameters through `acquireUseRelease`, so an interrupted refinement no longer leaves accumulated feedback in the inner module.
- Count options (`bestOfN.N`, `refine.N`, `react.maxIterations`, parse `maxRetries`, few-shot `k`/`maxBootstrappedDemos`, GEPA `maxIterations`/`maxMergeInvocations`, Ensemble `size`, MIPROv2 budgets and cadence) floor fractional values and fall back to their minimum for non-finite input instead of iterating a fractional or `NaN` count.
- `Signature.Input` and `Signature.Output` accept any carrier with an `inputSchema` or `outputSchema` field, so they derive types from `Signature` subclasses and structural stand-ins.
