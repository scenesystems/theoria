# DSPy parity ledger

Target: DSPy 3.4.0, GEPA 0.1.4, Optuna 4.9.0. Wave 0 is evidence infrastructure,
not a parity release. **No API is verified yet.** `implemented` means a related
Theoria API exists, not that its behavior matches upstream. `planned` identifies
later-wave work; `non-goal` identifies an intentional exclusion. `verified` is
reserved for completed differential coverage in the owning wave.

Wave 1.0 removes format-version fields from module snapshots, example reports,
and inference route provenance. Saved state retains caller metadata. This is
contract cleanup, not additional DSPy parity evidence; status claims stay unchanged.

Wave 1.1 binds effective generation settings and semantic roles to model requests.
Independent transport tests cover provider field mappings, retained defaults, role
fallback, and unsupported-setting failures before HTTP. Predictor tests cover
text, structured, tool turns, invocation overrides, and rollout identity. These
tests establish local contracts, not additional upstream parity claims.

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

Use Python 3.12.14 on Linux x86_64 (the recorded runtime and CI platform).
All generators and verifiers use the root `pyproject.toml`, `.python-version`,
and `uv.lock`: one environment, no script-specific locks or symlinks.

```sh
uv run --locked packages/effect-dsp/scripts/generate-dspy-fixtures.py
uv run --locked packages/effect-dsp/scripts/verify-dspy-fixtures.py --check
uv run --locked packages/effect-search/scripts/generate-optuna-fixtures.py --check
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

The bootstrap witness retains one second-stage demo instead of two. The GEPA
witness returns the specialist vector `[1, 0]` (mean 0.5) instead of the generalist
`[0.8, 0.8]` (mean 0.8), an aggregate-score loss of 0.3.

Five DSPy tests and the Optuna differential use `it.effect.fails`; ordinary
companion tests validate fixture decoding and execution preconditions. Flip
these in the owning waves. Optuna compares 512 independent seeded draws after
replaying a history with one failed trial; failed observations are omitted from
fitting. The numerical corpus and MIPRO kernel share the Optuna 4.9.0
generator and root lock with DSPy. CI's `fixtures-verify` job runs both locked
checks; neither check accepts unowned corpus files.

GEPA's minimal aggregate discriminator disables merges; callback recording
supports merge events, but this fixture does not establish merge parity.
Teacher/student signatures must match including instructions, as required by
DSPy's compiler. The TypeScript recorder records native provider options;
settings/role/rollout capture requires the Wave 1 model-binding contract. There
are no placeholder fields. Fixture IDs are carried in example input/output
until Example gains its own identity field.

## effect-search: Optuna 4.9 differences owned by Wave 3

Regeneration covers all 45 numerical/scenario payloads and their manifest,
plus the MIPRO kernel and its manifest. Unused invalid-input documents were
deleted. Eight existing tests changed to `it.effect.fails`; together with the
MIPRO discriminator, effect-search has nine expected failures. An ordinary manifest test decodes every
payload independently, so schema failures cannot masquerade as expected mismatches.
The generator's `--check` compares every generated payload and manifest byte,
including SHA-256 hashes. No implementation changes or tolerance increases were made.
Both harnesses disable NumPy AVX2/FMA3/AVX512F dispatch before import:
otherwise CPU-specific math paths differ in the last bits (observed up to
3.6e-15 in truncated-normal values). Values are not rounded to hide that drift.
GP reproduction also fixes PyTorch dispatch to `default`, MKL to its
cross-CPU reproducibility mode, and OpenBLAS to `HASWELL`, with one BLAS/OpenMP
thread. This reference runtime requires an AVX2-capable Linux x86_64 CPU.

These are measured first-failure witnesses, not an exhaustive bound on each
algorithm's error. Flip the owning test only after its entire scenario set passes.

| Sampler / component          | Scenario                                                                   | Theoria                                             | Optuna 4.9                                            | Magnitude / test                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TPE continuous Parzen        | `continuous-kde.basic`, kernel at observation 0.4                          | sigma 0.2                                           | sigma 0.29999999999999993                             | Absolute difference 0.1; `Sampler/tpe/fixtureParity.test.ts` continuous test; tolerance 1e-10.                                                                                                   |
| Constrained TPE density      | `constrained-tpe.parity`, `two-constraints`, feasible dimension 1, probe 0 | -0.9639332032565622                                 | -1.121658980054194                                    | Absolute difference 0.1577257767976319; `Sampler/tpe/constrainedParity.test.ts`; precision 9.                                                                                                    |
| TPE mixed-space sampling     | `mixed-space.joint-trace`, first categorical candidate batch               | `[adamw, adam, adam, adam, adam, adam, adam, adam]` | `[adamw, adam, adamw, adam, adam, adamw, adam, adam]` | 2 of 8 choices differ; independent marginal draws versus upstream shared mixture draws; `Sampler/tpe/mixedSpaceParity.test.ts`. This witness alone does not establish distributional divergence. |
| TPE noise-aware bandwidth    | `noise-bandwidth.parity`, `low-noise-smooth`, first base sigma             | 0.31                                                | 0.125                                                 | Absolute difference 0.185 before the local noise adjustment; `Sampler/tpe/noiseBandwidthParity.test.ts`; precision 9.                                                                            |
| Multivariate categorical TPE | `optuna-mipro-categorical-001`, 512 fixed-history draws                    | Joint-tuple smoothing                               | Mixture of product categorical kernels                | Total variation 0.943359375 versus bound 0.15; `Sampler/tpe-optuna-kernel.test.ts`; pre-existing expected failure from this wave.                                                                |
| Trial reporting              | `pruning.report-contract`, duplicate step 0                                | Checked failure                                     | Ignores duplicate and retains 0.81                    | Accepted/rejected outcome differs for 1 repeated step; decreasing new steps also accepted upstream; `Pruning/fixtureReplay.test.ts`.                                                             |
| TPE trial split              | `split-trials.single-and-liar`, minimize, two below                        | `[0, 2]`                                            | `[0, 1]`                                              | 1 of 2 memberships differs: upstream exhausts completed trials before pruned; `Sampler/tpe/splitTrials.test.ts`.                                                                                 |
| TPE pruned score             | `pruned-score.pruned-ordering`, no intermediate values                     | Infinity                                            | 0                                                     | Unbounded score difference; upstream ordering tuple is `(1, 0)`; `Sampler/tpe/prunedScore.test.ts`.                                                                                              |
| MOTPE HSSP split             | `motpe-split.multi-rank-hssp`, two below                                   | `[31, 32]`                                          | `[30, 31]`                                            | 1 of 2 memberships differs; `Sampler/tpe/multiObjectiveWeights.test.ts` FM-4 test.                                                                                                               |

Every recorded expected result now comes from upstream execution: Parzen and
truncated-normal kernels, trial splitting/scoring/reporting, hypervolume weights,
study optimization, or sampler asks. Noise fixtures contain only upstream base
widths, not a recreated Theoria noise policy. Unbounded Gaussian fixtures execute
Optuna's product-normal kernel, not a hand-written density or Scott rule.
CMA-ES/GP-BO and study-replay consumers currently test local reproducibility and
checkpoint behavior, not equality of upstream trajectories. Those fixtures do
not establish sampler parity. None of these results promotes an API to `verified`.

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
| `predict.Refine`                              | `Module.refine`             | planned     | —                                                                                                                      | Immutable single-string feedback reaches all leaf predictors. Wave 4: predictor-name advice dictionary and `hint_` input injection through the adapter. |
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
