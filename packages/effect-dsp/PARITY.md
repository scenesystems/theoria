# DSPy compatibility ledger

Target: DSPy 3.4.0, GEPA 0.1.4, Optuna 4.9.0. Wave 0 is evidence infrastructure,
not a parity release. **No API is verified yet.** `implemented` means a related
Theoria API exists, not that its behavior matches upstream. `planned` identifies
later-wave work; `non-goal` identifies an intentional exclusion. `verified` is
reserved for completed differential coverage in the owning wave.

Inventory: every non-private, non-module value exported by the six DSPy 3.4.0
package namespaces below (including aliases and re-exported types). Namespace
modules themselves are navigation, not separate API claims. Inventory was read
from the pinned installed distribution, not the website's rolling API reference.

## Evidence and regeneration

`test/fixtures/dspy/manifest.json` has one Schema and no format/generator version
counter or compatibility path. `upstream-execution`
means a real DSPy program/optimizer ran; `upstream-kernel` means a real upstream
primitive ran. `local-regression` is reserved for future intentional Theoria-only
behavior: **there are zero such entries in Wave 0**. The former 36 fixtures and
their fixture-only consumers were removed, not promoted into upstream evidence.

Use Python 3.12.14 on Linux x86_64 (the recorded runtime and CI platform):

```sh
uv run --python 3.12.14 packages/effect-dsp/scripts/generate-dspy-fixtures.py
uv run --python 3.12.14 packages/effect-dsp/scripts/verify-dspy-fixtures.py --check
uv run --python 3.12.14 packages/effect-search/scripts/generate-optuna-fixtures.py --check
```

Checks rerun upstream and compare bytes and SHA-256 hashes. The test kit also
checks hashes, identity and explicit evidence-class claims before decoding a
payload. Runtime versions and pinned source commits are in the manifest. LM
history retains messages, effective temperature/max_tokens/model/rollout_id and
responses; transport UUIDs, timestamps and durations are deliberately omitted.
No optimizer algorithms are reimplemented by the harness. MIPRO observers
delegate to the original methods and Evaluate; GEPA uses upstream callbacks.

## Discriminators and known limits

| Fixture                                        | Owning wave | Current mismatch                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eval-failure-inclusive-001`                   | 1           | Successful-only denominator gives 1 instead of 0.5.                                                                                                                                                                                                                     |
| `bootstrap-teacher-trace-001`                  | 2           | Teacher output provenance already works; repeated second-stage trace demos are incorrectly deduplicated. The passing companion test checks teacher outputs differ from labels and no student LM calls occur.                                                            |
| `mipro-trial-budget-001`                       | 3           | Auto light with one predictor and demos executes 10 trials, not the current 9.                                                                                                                                                                                          |
| `mipro-best-fullval-001`                       | 3           | A minibatch score of 1 contaminates the full-validation best, which must remain 0.8 when that candidate scores 0.5 on full validation.                                                                                                                                  |
| `gepa-aggregate-best-001`                      | 3           | The first frontier member is returned instead of the aggregate-best generalist.                                                                                                                                                                                         |
| `optuna-mipro-categorical-001` (effect-search) | 3           | Joint categorical kernel differs structurally: Theoria smooths entire tuples; Optuna uses a mixture of product categorical kernels. This is not merely RNG draw order. The fixed-history joint-distribution comparison remains an expected failure, not a parity claim. |

Five DSPy tests and the Optuna differential use `it.effect.fails`; ordinary
companion tests validate fixture decoding and execution preconditions. Flip
these in the owning waves. Optuna compares 512 independent seeded draws after
replaying a history with one failed trial; failed observations are omitted from
fitting. The numerical corpus and MIPRO kernel now share the Optuna 4.9.0
generator and canonical lock. The verifier's lock path is a symlink to that lock;
there is no older pin or legacy generator.

GEPA's minimal aggregate discriminator disables merges; callback recording
supports merge events, but this fixture does not establish merge parity.
Teacher/student signatures must match including instructions, as required by
DSPy's compiler. The TypeScript recorder's settings/role/rollout fields remain
`Option.none` until the Wave 1 model-binding contract exists. Fixture IDs are
carried in example input/output until Example gains its own identity field.

## effect-search: Optuna 4.9 differences owned by Wave 3

Regeneration covers all 45 numerical/scenario payloads (50 JSON files including
the manifest and four invalid-input documents), plus the MIPRO kernel. Four
existing tests changed to `it.effect.fails`; together with the MIPRO discriminator,
effect-search has five expected failures. An ordinary manifest test decodes every
payload independently, so schema failures cannot masquerade as expected mismatches.
The generator's `--check` compares every generated payload and manifest byte,
including SHA-256 hashes. No implementation changes or tolerance increases were made.

These are measured first-failure witnesses, not an exhaustive bound on each
algorithm's error. Flip the owning test only after its entire scenario set passes.

| Sampler / component          | Scenario                                                         | Theoria               | Optuna 4.9                             | Magnitude / test                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------- | --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TPE continuous Parzen        | `continuous-kde.basic`, kernel at observation 0.4                | sigma 0.2             | sigma 0.29999999999999993              | Absolute difference 0.1; `Sampler/tpe/fixtureParity.test.ts` continuous test; tolerance 1e-10.                                    |
| Constrained TPE density      | `constrained-tpe.parity`, `two-constraints`, probe [-0.3, -0.1]  | 1.3471343219460463    | 1.1856949945071253                     | Absolute difference 0.16143932743892098; `Sampler/tpe/constrainedParity.test.ts`; tolerance 1e-9.                                 |
| TPE mixed-space EI           | `mixed-space.joint-trace`, learning-rate above-density `logG[0]` | -3.850077439599117    | -4.322409229408983                     | Absolute difference 0.472331789809866; `Sampler/tpe/mixedSpaceParity.test.ts`; tolerance 1e-9.                                    |
| TPE noise-aware bandwidth    | `noise-bandwidth.parity`, `low-noise-smooth`, first base sigma   | 0.31                  | 0.125                                  | Absolute difference 0.185 before the local noise adjustment; `Sampler/tpe/noiseBandwidthParity.test.ts`; precision 9.             |
| Multivariate categorical TPE | `optuna-mipro-categorical-001`, 512 fixed-history draws          | Joint-tuple smoothing | Mixture of product categorical kernels | Total variation 0.943359375 versus bound 0.15; `Sampler/tpe-optuna-kernel.test.ts`; pre-existing expected failure from this wave. |

The numerical corpus includes mathematical and Theoria-extension scenarios, not
only full upstream sampler executions. In particular, noise adjustment is local;
its base Parzen widths come from Optuna. Scenario/replay fixtures do not establish
RNG trajectory equivalence. None of these results promotes an API to `verified`.

## Public surface

| DSPy API                                      | Theoria API                 | Status      | Evidence fixture IDs                                                                                                   | Notes                                                                 |
| --------------------------------------------- | --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `teleprompt.AvatarOptimizer`                  | —                           | planned     | —                                                                                                                      | Legacy disposition, Wave 6.                                           |
| `teleprompt.BetterTogether`                   | —                           | planned     | —                                                                                                                      | Training, Wave 5.                                                     |
| `teleprompt.BootstrapFewShot`                 | `BootstrapFewShot`          | implemented | `bootstrap-teacher-trace-001`, `bootstrapfewshot-001`, `bootstrapfewshot-threshold-001`, `bootstrapfewshot-errors-001` | Wave 2.                                                               |
| `teleprompt.BootstrapFinetune`                | —                           | planned     | —                                                                                                                      | Wave 5.                                                               |
| `teleprompt.bootstrap_trace_data`             | `Trace`                     | planned     | `bootstrap-teacher-trace-001`                                                                                          | TeacherTrace contract, Wave 2.                                        |
| `teleprompt.COPRO`                            | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `teleprompt.Ensemble`                         | `Ensemble`                  | implemented | `majority-001`                                                                                                         | Kernel only; legacy compile signature audited in Wave 6.              |
| `teleprompt.InferRules`                       | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `teleprompt.KNNFewShot`                       | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `teleprompt.MIPROv2`                          | `MIPROv2`                   | implemented | `mipro-trial-budget-001`, `mipro-best-fullval-001`, `miprov2-medium-001`, `miprov2-heavy-001`, `miprov2-explicit-001`  | Wave 3.                                                               |
| `teleprompt.BootstrapFewShotWithRandomSearch` | `BootstrapRS`               | implemented | `bootstraprs-001`                                                                                                      | Wave 2.                                                               |
| `teleprompt.SIMBA`                            | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `teleprompt.Teleprompter`                     | Optimizer-owned Options/run | non-goal    | —                                                                                                                      | Python base-class hierarchy is not the target.                        |
| `teleprompt.BootstrapFewShotWithOptuna`       | —                           | planned     | —                                                                                                                      | Legacy optimizer disposition, Wave 6.                                 |
| `teleprompt.LabeledFewShot`                   | `LabeledFewShot`            | implemented | `labeledfewshot-001`                                                                                                   | Sampling policy, Wave 2; no RNG equality claim.                       |
| `teleprompt.GEPA`                             | `GEPA`                      | implemented | `gepa-aggregate-best-001`                                                                                              | Wave 3.                                                               |
| `predict.majority`                            | `Ensemble` reducer          | implemented | `majority-001`                                                                                                         | Exact strings and first-observed tie only.                            |
| `predict.BestOfN`                             | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `predict.ChainOfThought`                      | `Module.chainOfThought`     | implemented | `predict-trace-001`                                                                                                    | Reasoning output and trace tested; not complete surface verification. |
| `predict.CodeAct`                             | —                           | planned     | —                                                                                                                      | Wave 5.                                                               |
| `predict.KNN`                                 | —                           | planned     | —                                                                                                                      | Legacy disposition, Wave 6.                                           |
| `predict.MultiChainComparison`                | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `predict.Parallel`                            | Effect concurrency          | planned     | —                                                                                                                      | Batched module semantics, Wave 4.                                     |
| `predict.Predict`                             | `Module.predict`            | implemented | `predict-trace-001`                                                                                                    | Core contracts, Wave 1.                                               |
| `predict.ProgramOfThought`                    | —                           | planned     | —                                                                                                                      | Wave 5.                                                               |
| `predict.ReAct`                               | `Module.react`              | implemented | —                                                                                                                      | Wave 4 audit.                                                         |
| `predict.Tool`                                | `effect/ai` tools           | planned     | —                                                                                                                      | Wave 4/6 tool adaptation.                                             |
| `predict.ReActV2`                             | —                           | planned     | —                                                                                                                      | Wave 4/6 surface audit.                                               |
| `predict.Refine`                              | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `predict.RLM`                                 | —                           | planned     | —                                                                                                                      | Wave 5.                                                               |
| `evaluate.CompleteAndGrounded`                | —                           | planned     | —                                                                                                                      | Semantic metrics, Wave 4.                                             |
| `evaluate.SemanticF1`                         | —                           | planned     | —                                                                                                                      | Semantic metrics, Wave 4.                                             |
| `evaluate.Evaluate`                           | `Evaluate`                  | implemented | `eval-failure-inclusive-001`                                                                                           | Wave 1 failure semantics.                                             |
| `evaluate.EvaluationResult`                   | `Evaluate.Report`           | implemented | `eval-failure-inclusive-001`                                                                                           | Shape differs; behavioral target.                                     |
| `evaluate.EM`                                 | `Metric.exactMatch`         | implemented | —                                                                                                                      | Normalization audit required.                                         |
| `evaluate.answer_exact_match`                 | `Metric.exactMatch`         | implemented | —                                                                                                                      | Normalization audit required.                                         |
| `evaluate.answer_passage_match`               | —                           | planned     | —                                                                                                                      | Metric surface audit.                                                 |
| `evaluate.normalize_text`                     | —                           | planned     | —                                                                                                                      | Metric normalization.                                                 |
| `retrievers.Embeddings`                       | —                           | planned     | —                                                                                                                      | Wave 4; providers in effect-inference.                                |
| `retrievers.EmbeddingsWithScores`             | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `retrievers.Retrieve`                         | —                           | planned     | —                                                                                                                      | Wave 4.                                                               |
| `adapters.Adapter`                            | —                           | planned     | —                                                                                                                      | Wave 6 service.                                                       |
| `adapters.ChatAdapter`                        | Internal formatter/parser   | implemented | `chat-adapter-001`                                                                                                     | Kernel only; fallback/format audit remains.                           |
| `adapters.JSONAdapter`                        | Structured output strategy  | implemented | —                                                                                                                      | Not equivalent to full upstream adapter.                              |
| `adapters.TwoStepAdapter`                     | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.Audio`                              | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.Code`                               | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.File`                               | —                           | planned     | —                                                                                                                      | Wave 6 provider capability audit.                                     |
| `adapters.History`                            | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.Image`                              | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.Reasoning`                          | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `adapters.Tool`                               | `effect/ai` tools           | planned     | —                                                                                                                      | Wave 4/6.                                                             |
| `adapters.ToolCallResults`                    | `effect/ai` tool results    | planned     | —                                                                                                                      | Wave 6 adaptation.                                                    |
| `adapters.ToolCalls`                          | `effect/ai` tool calls      | planned     | —                                                                                                                      | Wave 6 adaptation.                                                    |
| `adapters.Type`                               | Effect Schema               | non-goal    | —                                                                                                                      | Python type hierarchy; field semantics audited individually.          |
| `adapters.XMLAdapter`                         | —                           | planned     | —                                                                                                                      | Wave 6.                                                               |
| `primitives.BaseModule`                       | `Module`                    | implemented | —                                                                                                                      | Functional construction rather than inheritance.                      |
| `primitives.CodeExecutionError`               | —                           | planned     | —                                                                                                                      | Wave 5 typed failures.                                                |
| `primitives.CodeInterpreter`                  | —                           | planned     | —                                                                                                                      | Wave 5 service.                                                       |
| `primitives.CodeInterpreterError`             | —                           | planned     | —                                                                                                                      | Wave 5 typed failures.                                                |
| `primitives.FinalOutput`                      | —                           | planned     | —                                                                                                                      | Wave 5 code programs.                                                 |
| `primitives.resolve_interpreter_factory`      | —                           | non-goal    | —                                                                                                                      | Python factory loading; use explicit Effect layers.                   |
| `primitives.Example`                          | `Example`                   | implemented | —                                                                                                                      | Wave 1 identity/input-key/metadata contracts.                         |
| `primitives.LocalInterpreter`                 | —                           | planned     | —                                                                                                                      | Wave 5 sandbox execution.                                             |
| `primitives.Module`                           | `Module`                    | implemented | `predict-trace-001`                                                                                                    | Wave 1 immutable binding and Wave 6 persistence.                      |
| `primitives.Completions`                      | —                           | planned     | —                                                                                                                      | Wave 6 multiple completions.                                          |
| `primitives.Prediction`                       | Typed module output         | implemented | `predict-trace-001`                                                                                                    | Mapping semantics, not Python object identity.                        |
| `primitives.PythonInterpreter`                | —                           | planned     | —                                                                                                                      | Wave 5 sandbox capability.                                            |
| `primitives.SandboxSerializable`              | Schema codecs               | planned     | —                                                                                                                      | Wave 5/6 explicit safe serialization.                                 |
