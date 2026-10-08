# DSPy compatibility and evidence

The reference targets are DSPy 3.4.0, GEPA 0.1.4 and Optuna 4.9.0.
Compatibility here means agreement on the recorded behaviors below, not full
DSPy API coverage, Python object identity or identical prompt bytes. An API's
presence does not establish upstream parity. Local tests establish Theoria
contracts separately from differential fixtures.

The [DSP manifest](./test/fixtures/dspy/manifest.json) identifies 47 current
fixtures, their source commits, evidence classes and SHA-256 hashes.
`upstream-execution` means a real upstream program or optimizer ran;
`upstream-kernel` means a real upstream primitive ran. There are no
`local-regression` entries. The manifest and consuming tests are the authoritative
case-level evidence; the following sections explain what those comparisons mean.

## Evaluation

`eval-failure-inclusive` covers every recorded run's scores, ordered rows,
failure scores and cancellation at the error limit. Failed examples remain in
the denominator. `eval-compensated-mean` covers raw report means, per-example
metric means and `Metric.compose` with compensated summation.

Evaluate intentionally returns unrounded fractions. Only MIPRO applies rounded
percentages for optimization. Evaluate has no default error limit; bootstrap
optimizers and MIPRO resolve an absent or none `maxErrors` to DSPy's default 10.
The limit is reached at that many expected failures, not one failure later.
Defects and interruption propagate.

Answer normalization, fractional token F1 and normalized DPR passage-token
boundaries have local tests, not upstream differential fixtures. Evaluation
report shape differs from Python's `EvaluationResult`.

## Demonstration selection

`labeledfewshot` verifies exact demo identities and order for two predictors,
using successive samples from one seed-0 stream. `bootstrap-teacher-trace`
and `bootstrap-teacher-trace-calls` cover teacher evidence, including duplicate
outputs from different examples without student LM calls.

The BootstrapFewShot family covers compiled demos, metric calls, teacher-only
execution, labeled teacher prewarming, leave-one-out and the error boundary.
`bootstrapfewshot-rounds` verifies example-major retries (`a, a, b`), settings,
rollout IDs and exact demos. Labeled fill checks the entire ordered array using
separate fresh seed-0 shuffle and sampling streams. Teacher-demo, threshold-zero
and default-error-limit cases cover retained bound-teacher demos, DSPy's truthy
zero-threshold rule and limit 10. The teacher-settings capture records actual
teacher calls. Leave-one-out compatibility uses effective instructions and
field metadata under the active parameter set.

Within a repeated predictor trace, Theoria chooses the first invocation.
`bootstrap-repeated-call` verifies one retained demo per
predictor per example and membership in the trace, not DSPy's pick, which uses
SHA-256 over Python pickle bytes. Theoria stops when every trainable predictor
has enough demos; DSPy counts accepted examples. Conditional programs can thus
collect more examples and have no verified upstream trajectory.

`bootstraprs` verifies the candidate catalog in seed order (-3, -2, -1, then
nonnegative seeds), exact demo identities/order for every candidate, full
validation fraction scores and the earliest winner on equal scores. Candidate
shuffle and cap use separate fresh streams, with seed-0 labeled sub-optimizers.

BootstrapRS ranks and stops on unrounded fractions; DSPy uses two-decimal
percentages. Unequal fractions that round to the same hundredth of a percent
can rank or stop differently. Local tests show 0.33331 and 0.33334 tying at DSPy's
33.33 while Theoria selects the higher fraction; 0.99996 rounds to DSPy's 100.0
but remains below Theoria's `stopAtScore: 1`. Rounded ranking/stopping parity is
not claimed.

Shared-stream draws follow stable `Module.Structure` path order. Fixtures align
that order with DSPy's declaration order; differently ordered declarations are
not an identity-parity claim.

## MIPROv2

MIPRO's demo catalogs use BootstrapFewShot/TeacherTrace evidence.
Budget, explicit, no-labels and zero-shot fixtures verify exact demo identities/order, bootstrap metric
identities and teacher-call counts. Zero-shot still gathers proposer evidence
with effective caps of zero labeled and three bootstrapped demos, then clears
the demos for instruction-only search.

One CPython stream per compile (default seed 9) supplies auto validation
sampling, candidate shuffle/cap, proposal tip/rollout draws and fresh search
minibatches in that order. There is no history `random()` draw. Auto's
full-coverage validation selection still samples; candidate evaluation bypasses
sampling when the requested batch covers the whole validation set.

Grounded-proposer, no-demo and summary-skip fixtures cover exact call order,
dataset batch and demo identities, proposals, roles, temperatures, rollout IDs,
tips, augmented-demo rotation and the next shared-stream draw. Summary generation
uses one DatasetDescriptor, up to nine prior-observation calls (stopping after
five cumulative COMPLETE replies), then ObservationSummarizer at temperature
1.0, cached across proposals. DescribeProgram, DescribeModule and instruction
generation share each proposal's rollout ID. Proposal zero is generated and
then replaced by the original instruction. Empty demo catalogs use N proposals;
otherwise the count is min(N, catalog length).

Teacher demos retain augmented provenance; labeled, prewarmed and fill demos
do not. Grounding gathers up to three augmented demos from current, following,
then preceding sets, suppressing demos for proposal zero. Demo equivalence uses
encoded input/output only; cache parameter identity also includes provenance.

Program-description prompts represent native predictor paths and signature
text, not Python source. DescribeModule uses a JSON document of canonical path,
name, description, effective instructions and field metadata overrides. It does
not list input/output schemas as DSPy's Python signature representation does.
Proposer fixtures verify call order, roles, rollouts and grounding identities,
not that description's content or prompt bytes.

The default-grounded fixture joins all phases with grounding, auto and budget
defaults and single-threaded upstream evaluation. It checks auto-light budgets,
teacher calls, proposer fields/roles/rollouts/temperatures, grounding identities,
tips, summaries, instructions, strict trial rows and the returned program.

### Search and numerical boundaries

The scheduler runs seeded multivariate TPE, including baseline study row 0 and
inserted full-evaluation rows while a sampled objective is pending. Forced
configurations consume no sampler randomness. Budgets count sampled trials,
not study rows. Auto enables minibatching only above 50 sampled validation rows.
Omitted validation uses the last min(1000, max(1, floor(0.8 × trainset size)))
examples without consuming RNG.

| Fixture                                  |    Sampled trials | Inserted full rows | Baseline | Total rows | Minibatch | Valset | Strict through study row | First inadmissible tie         |
| ---------------------------------------- | ----------------: | -----------------: | -------: | ---------: | --------- | -----: | -----------------------: | ------------------------------ |
| `mipro-trial-budget` (light)             |                10 |                  0 |        1 |         11 | false     |      6 |                       10 | none                           |
| `miprov2-medium`                         |                18 |                  0 |        1 |         19 | false     |      6 |                       15 | 16, coincidental cancellation  |
| `miprov2-heavy`                          |                27 |                  0 |        1 |         28 | false     |      6 |                       17 | 18, coincidental cancellation  |
| `miprov2-explicit`, `mipro-best-fullval` |                12 |                  6 |        1 |         19 | true      |      6 |                       10 | 11, coincidental cancellation  |
| `miprov2-no-labels`                      |                12 |                  0 |        1 |         13 | false     |      6 |                       12 | none                           |
| `miprov2-zero-shot`                      |                12 |                  0 |        1 |         13 | false     |      6 |                       10 | 11, coincidental cancellation  |
| `miprov2-auto-minibatch` (light)         |                10 |                  2 |        1 |         13 | true      |     51 |                       12 | none                           |
| `miprov2-exhausted-full-eval`            | 8 of 12 requested |                  3 |        1 |         12 | true      |      6 |                       11 | none; selector fails on row 11 |
| `miprov2-default-grounded` (light)       |                10 |                  0 |        1 |         11 | false     |      6 |                       10 | none                           |

`strictThroughTrial` is an inclusive actual Optuna study number. Within those
prefixes, tests assert exact configurations, scores, validation identities/order,
instructions and demos. Fully strict light, no-labels and auto-minibatch runs
also compare the returned program. Beyond a prefix, upstream rows are
observations only. Tests use Theoria scores to check counts, checkpoint cadence,
final full evaluation, selection of the highest mean uncheckpointed combination
and the best full-evaluation return. Minibatch peaks never replace that return;
ties retain the earliest full row. The baseline remains eligible for its first
checkpoint. Exhausted combinations raise typed `MIPROv2Error` with the upstream
message and trigger rather than reusing a checkpoint.

MIPRO tells TPE percentage scores and reports fractions. It computes
`round(100 * sum(scores) / count, 2)` in that order, with Python half-even
rounding over the exact binary input, retaining the told percentage internally
and ranking compensated means. `mipro-percentage-rounding` and
`mipro-checkpoint-tie` discriminate this behavior. Nonpositive explicit budgets
evaluate only the baseline. Defaults include caps 4/4, seed 9, minibatch size 35
and full-evaluation interval 5. An evaluation reaching the error limit is logged
and scored zero. `provideTraceback` logging, defects and interruption are local
contracts, not recorded upstream log parity.

## GEPA

Fixtures cover three-example epoch-shuffled training batches, coverage-pruned
per-instance winners, frequency-expanded parent choice, strict minibatch
improvement, aggregate-best return and complementary merges. Defaults follow
DSPy 3.4.0's GEPA signature, not `gepa.api.optimize`: exactly one budget is
required, seed 0, merge enabled with at most 5 invocations, perfect-score skipping
enabled, format-failure feedback disabled, pareto/roundRobin selection and
failure/perfect scores 0/1.

Reflection uses training rows; seed and accepted-candidate selection use
validation rows. Missing or empty validation falls back to training.
`requireDistinctValset` is a local opt-in overlap guard. `maxFullEvals` counts
training plus explicitly supplied validation rows before fallback; auto uses
the upstream budget formula.

One CPython stream supplies parent choice, epoch shuffling and merge draws.
A separate equally seeded adapter stream chooses an actual target-predictor
execution for feedback, even for singleton traces. `gepa-selection` covers
coverage and batch identities; `gepa` covers rollout/feedback identities,
proposals and returned instructions. The metric ledger includes seed/full
validation, parent/child minibatches and merge subsamples, but not targeted
feedback. Stop checks occur only at iteration boundaries.

| Fixture               | Budget | Final metric ledger | Feedback calls | Iterations | Outcome                        |
| --------------------- | -----: | ------------------: | -------------: | ---------: | ------------------------------ |
| `gepa`                |     30 |                  38 |              9 |          3 | Three accepted mutations       |
| `gepa-budget`         |      6 |                   8 |              0 |          1 | Perfect batch skips reflection |
| `gepa-merge-accepted` |     34 |                  45 |              6 |          3 | Two mutations, accepted merge  |
| `gepa-merge-rejected` |     34 |                  38 |              6 |          3 | Two mutations, rejected merge  |

Merge engine fixtures use a scripted adapter; their feedback counts are
separately asserted Theoria adapter calls, not engine budget entries. Both
merge outcomes skip reflection for that iteration; only acceptance decrements
merges due and increments accepted merges. Tests compare validation subsamples,
candidates, parents, scores, ledger and return. `gepa-merge` covers common
ancestors, one tied instruction conflict and balanced A/B/tie sampling in
ascending validation-index order for the seven-row fixture.

`gepa-aggregate-best` returns the generalist `[0.8, 0.8]`, mean 0.8, even outside
the coverage-pruned parent set, rather than the specialist `[1, 0]`, mean 0.5.
Sum-kernel and engine tie fixtures cover CPython 3.12 compensated sums at
aggregate, coverage, acceptance and ancestor-weight sites. An equal mutation
minibatch sum is rejected without child validation; an equal merged subsample
sum is accepted and validated. `random.choices` cumulative weights still use
ordinary addition.

### Intentional differences

Predictor traversal and merge conflicts follow stable native path order, not
Python insertion/string-set order. Fixtures align component order and have at
most one random tied conflict. Multi-conflict identity is not claimed.
`PYTHONHASHSEED=0` stabilizes upstream captures without broadening that claim.

Format-failure feedback uses actual encoded input, raw response and native
prompts. Feedback includes the upstream prefix followed by the actual prompt;
upstream formats an empty input/demo template. `gepa-format-failure` covers
text, auto/structured Predict and exhausted ReAct; ReAct comparison covers its
agent predictor, not upstream's additional extraction predictor.
`gepa-instruction-extractor` covers fences, language tags, incomplete blocks,
Python whitespace and empty replies without a fallback instruction.

Without a critic binder, reflection uses the task model with a warning instead
of requiring a separate reflection LM. Binders control roles/settings without
invented generation overrides. A feedback metric, critic call or custom proposer
failure aborts with its typed error on the first attempt, without retry or
parameter mutation; upstream logs and skips the proposal. Rollout/scoring
failures still receive `failureScore`.

Theoria checkpoints persist both RNG streams, epochs, component cursors, merge
counters and deduplication. Local JSON resume tests match uninterrupted runs in
candidates, scores, ledger, parameters and RNG state, including accepted/rejected
merges. Invalid module/dataset checkpoints and unknown/frozen selector paths
fail with typed `GEPAError` before restoration or evaluation.
Upstream saves only GEPAState, not external sampler/merge state, so upstream
restart-trajectory identity is not claimed. The accepted-merge capture records
a real upstream restart from ledger 33 with budget 34: it ends at 46 with a
single-parent mutation and no merge, versus uninterrupted ledger 45 with parents
[1, 2]. This is observational evidence, not Theoria's continuation target.

## Shared kernels and other limits

The effect-math `cpython-random` fixture covers bit-exact integer-seeded MT19937
random, wide getrandbits, rejection randbelow, randint, choice, shuffle and both
sample branches across zero, positive, large and negative seeds. `numpy-random`
covers legacy uint32 seeding, random_sample, batched rand/uniform, weighted
replacement choice and probability/seed boundaries. Scalar parity covers NumPy
pairwise sums at eight-lane and 128-element block boundaries. `cpython-sum`
independently covers compensated sums, cancellation and IEEE edges.

The effect-search `optuna-mipro-categorical` fixture verifies the original seed-9
trajectory, 512 fixed-history draws with joint total variation zero and checkpoint
continuations. Failed observations are excluded from fitting. Unsorted-name and
singleton cases cover exact prefixes for seeds 0, 1 and uint32-max in independent
and multivariate modes; seed-9 multivariate and seed-10 independent with startup
8 cover all 16 trials. The manifest records the deterministic 0..99 scan and
rejected seeds. Numeric replay covers bounded independent model-driven sampling,
not every numeric or multivariate trajectory.

TPE has separate NumPy startup and model streams. Model draws select mixture
components before dimensions in sorted search-space order; independent sampling
keeps declaration order. Singletons and enqueued baselines consume no draws.
Acquisition margins are diagnostic, recorded to 12 places; unrounded scores
control selection. Identical ordered kernel inputs reproduce first-index ties.
Coincidental cancellation and positive sub-ulp margins below 1e-9 depend on libm;
exact assertions stop at each `strictThroughTrial`. Within a prefix, native
margins must be zero for identical-input ties and positive otherwise.
The seed-211 coupled case is exact through trial 8 for both TPE variants;
trial 9 is coincidental cancellation and later rows are observation only.
Its upstream TPE best is 0.03 versus Random's 0.01, not evidence of Random
competitiveness. Random's full 24-trial trace remains exact.

Predict/ChainOfThought tracing, chat-adapter formatting/parsing, demo projection
and exact-string majority with first-observed ties have bounded fixture evidence,
not complete surface verification. Partial native demos retain order and present
fields instead of upstream's incomplete-first ordering and placeholders.
BestOfN, ReAct, Refine, model role/settings transport and automatic cache behavior
have local tests, not full upstream audits. JSON structured output is not the
full upstream JSONAdapter. Python inheritance, factories and type hierarchies
are not compatibility targets. Other DSPy optimizers, retrievers, semantic
metrics, code interpreters and multimodal adapters are outside the verified scope.

## Regeneration

Use Python 3.12.14 on Linux x86_64 with the root `pyproject.toml`,
`.python-version` and `uv.lock`. From the repository root:

```sh
uv run --locked packages/effect-dsp/scripts/generate-dspy-fixtures.py
uv run --locked packages/effect-dsp/scripts/verify-dspy-fixtures.py --check
uv run --locked packages/effect-search/scripts/generate-optuna-fixtures.py --check
```

Generation overwrites committed DSP fixtures; verification reruns upstream and
compares bytes and hashes without replacing them. Review generated differences
before accepting a reference update.

Generators restart with `PYTHONHASHSEED=0` and
`NPY_DISABLE_CPU_FEATURES=AVX2,FMA3,AVX512F` before importing upstream libraries.
The DSP manifest records these globally and pins NumPy 1.26.4. Only
`bootstrap-teacher-trace-calls`, `bootstrapfewshot-teacher-settings` and
`miprov2-default-grounded` have per-entry environment records and payload runtime
records; the other 44 entries have no per-entry CPU provenance, and none is
inferred. Scalar dispatch removes CPU-vector differences, but glibc libm's last
bits need not match native Numeric.log/exp. Strict prefixes retain that limit.

The test kit validates the complete manifest, hashes, identities, evidence
classes and recorded trajectories/environments before decoding payloads.
LM histories retain messages, effective settings, model, rollout ID and responses;
transport UUIDs, timestamps and durations are omitted. Harness observers delegate
to real upstream methods and Evaluate; GEPA uses upstream callbacks, not a
reimplemented optimizer. Locked DSP/Optuna checks run in CI's `fixtures-verify`
job and reject unowned corpus files. Math's verifier regenerates all 16 payloads
and its manifest under the same scalar dispatch setting.
