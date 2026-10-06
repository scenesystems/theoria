# DSPy parity ledger

Target: DSPy 3.4.0, GEPA 0.1.4, Optuna 4.9.0. Wave 0 is evidence infrastructure,
not a parity release. Wave 1 verifies Evaluate's failure-inclusive denominator.
`implemented` means a related
Theoria API exists, not that its behavior matches upstream. `planned` identifies
later-wave work; `non-goal` identifies an intentional exclusion. `verified` is
reserved for the differential behavior covered by the cited evidence, not every
behavior of the upstream API.

Wave 1.0 removes format-version fields from module snapshots, example reports,
and inference route provenance. Saved state retains caller metadata. This is
contract cleanup, not additional DSPy parity evidence; status claims stay unchanged.

Wave 2.0 introduces lossless TeacherTrace collection. Its upstream-execution
discriminator retains duplicate teacher outputs from separate examples without
student LM calls. Within one trace, `firstPerPredictor` deliberately chooses the
first invocation. `bootstrap-repeated-call-001` verifies exactly one retained
demo per predictor per example and membership in that example's trace demos.
The pick itself is not reproduced: DSPy seeds its choice with xxhash over
Python pickle bytes (`Hasher.hash(tuple(demos))`), not a portable integer seed.
Local tests cover
leave-one-out prompts, signature compatibility, score thresholds, error budgets,
and caller immutability on interruption. Evaluate and TeacherTrace now raise when
the error count reaches maxErrors, rather than allowing one additional failure.

Wave 2.2 compiles BootstrapFewShot from TeacherTrace evidence, retains repeated
outputs across examples, and fills only remaining labeled capacity from
unbootstrapped rows. Five upstream executions assert compiled demonstrations,
metric calls, teacher-only execution, labeled teacher prewarming, leave-one-out,
and the error boundary. Bound teachers are compiled and retain their demos;
default/plain teachers are prewarmed with labeled samples. Teacher lifecycle
events are emitted during execution; observer failures do not consume maxErrors.
Compatibility uses the effective instructions and field metadata under each
program's parameter set, through the same Signature.digest operation as caching.

Wave 2.3 evaluates the BootstrapRS catalog in seed order (-3, -2, -1, then
nonnegative seeds), preserving full validation reports and earliest-score ties.
The upstream fixture asserts the catalog, fraction scores, winning seed, and
exact demonstration identities and order for every candidate.
Local tests discriminate failure-inclusive ranking, early stopping, independent
caps, true shuffling, and caller immutability. stopAtScore uses a fraction in [0, 1], equivalent to
DSPy's percentage stop_at_score divided by 100.

Wave 2.4 implements CPython-compatible integer-seeded MT19937 and sequence
sampling, now housed in `effect-math/PseudoRandom`. `cpython-random-001` establishes bit-exact
random(), getrandbits (including wide integers), rejection randbelow, randint,
choice, shuffle, and both sample branches across zero, positive, large, and
negative seeds. LabeledFewShot uses one seed-0 stream across predictors;
BootstrapFewShot labeled fill uses its own seed-0 stream. BootstrapRS uses two
fresh streams per candidate (shuffle and cap), with independently seed-0 labeled
sub-optimizers. `labeledfewshot-001` asserts exact identities/order for two
predictors, and `bootstraprs-001` does so for every candidate.

Wave 3.0b shares the MT19937 engine between CPython integer-array seeding and
NumPy legacy uint32 seeding in effect-math. `numpy-random-001` verifies exact
random_sample, batched rand/uniform, weighted replacement choice, seed bounds,
probability acceptance boundaries, and near-normalized CDF renormalization.
Both RNG fixtures live in effect-math; no DSP/search engine copy remains.
`numeric.scalar-parity` verifies NumPy's pairwise sum at the eight-lane and
128-element block boundaries. TPE uses that order for normalization/logsumexp,
and Numeric.log/exp for categorical mixture scoring.

Seeded TPE uses two independent NumPy streams: startup RandomSampler draws one
uniform for each categorical choice and takes argmax; the model draws mixture
components first, then each dimension's values in sorted search-space order.
Independent sampling retains parameter declaration order. Singletons and the
enqueued baseline draw nothing. Checkpoints persist both stream positions.
`optuna-mipro-categorical-001` verifies the full original seed-9 trajectory,
all 512 fixed-history draws seed-for-seed (joint total variation zero), and
checkpoint continuations. Its unsorted-name/singleton cases verify exact
prefixes: seeds 0/1/uint32-max, independent/multivariate, stop before the first
inadmissible tie; seed-9 multivariate and seed-10 independent (startup=8) cover
all 16 trials. The manifest records the deterministic 0..99 scan and rejected
seeds. Numeric truncated-normal/integer seeded trajectories are not yet verified.

Acquisition margins are diagnostic only: recorded at 12 decimal places, with
the unrounded scores controlling upstream selection and classification.
`identicalInputs` ties have bit-identical ordered categorical kernel inputs on
both sides and are reproduced by first-index argmax. `coincidentalCancellation`
and positive sub-ulp margins below 1e-9 are libm-sensitive; exact config/value
assertions stop at each fixture's `strictThroughTrial`. Theoria's own margins
must be zero for identical-input ties and positive otherwise within that prefix.
The seed-211 coupled objective is exact through trial 8 for both TPE variants;
trial 9 is coincidental cancellation. Its remaining upstream trace is observation
only. Upstream TPE best 0.03 versus Random best 0.01 disproves the former
competitiveness assertion. Random's full 24-trial trace remains exact, while
local reproducibility and coupled-best-pair checks remain independent of it.

Both locked verifiers regenerate upstream results and byte-compare payloads and
hashes. Their existing `NPY_DISABLE_CPU_FEATURES=AVX2,FMA3,AVX512F` forces scalar
dispatch even when CPU detection lists AVX512 variants. Without that setting,
the coordinator's NumPy 1.26.4 probe found SVML/scalar differences on 51,004 of
200,000 log inputs and 47,563 exp inputs; with it both counts were zero.
Scalar reference bytes still depend on glibc libm, whose final bits are not
guaranteed to equal Numeric.log/exp. The prefix boundary makes that limitation
explicit rather than selecting a special tie policy or changing existing bytes.

Wave 3.1 builds MIPRO demo catalogs through BootstrapFewShot and TeacherTrace,
without instruction markers or label-only substitutes for teacher evidence.
`mipro-trial-budget-001`, `miprov2-explicit-001`, `miprov2-no-labels-001` and
`miprov2-zero-shot-001` establish exact demo identities/order, bootstrap metric
identities and teacher-call counts. The phase-1 test reproduces auto's preceding full-coverage validation
sample before invoking candidate generation.

Unlike BootstrapRS, MIPRO creates one seed-9 (or caller-seeded) CPython stream
per compile. Upstream consumes it for auto-mode validation sampling first,
then each shuffled catalog candidate's shuffle followed by randint. Candidate
-2 is labeled only when effective maxLabeledDemos is positive; otherwise it also
shuffles and draws a bootstrap cap, before unshuffled candidate -1. Zero-shot
uses effective proposer-evidence caps of zero labeled and three bootstrapped
demos, so it still incurs teacher and metric calls. Both zero-shot and nonzero
bootstrap caps with no labels have execution fixtures. Each subsequent proposal
draws a tip choice first (when enabled), then randint(0, 10**9) for rollout ID.
There is no history random() draw. Phase-1/2 tests continue the same stream and
assert the upstream rollout sequence. Search then draws fresh minibatches from
the same stream. The helper create_minibatch always samples, including auto's
full-coverage validation selection; eval_candidate_program bypasses the helper
when its requested batch covers the entire valset. Zero-shot passes its evidence
sets to the proposer before clearing them for instruction-only search.

Wave 3.2 verifies grounded proposals using `miprov2-grounded-proposer-001`,
`miprov2-proposer-no-demos-001` and `miprov2-proposer-summary-skips-001`.
The fixture assertions cover exact call order, dataset batch identities,
proposal identities, roles, temperatures, rollout IDs, tips, augmented demo
rotation and the next shared-stream draw. The summary sequence is one
DatasetDescriptor, up to nine DatasetDescriptorWithPriorObservations calls
(stop after five cumulative COMPLETE replies), then ObservationSummarizer,
all at temperature 1.0 and cached across proposals. Every proposal can make
DescribeProgram and DescribeModule calls before GenerateSingleModuleInstruction;
all three share the proposal's rollout ID. Proposal zero is generated, then
replaced by the original instruction. Empty demo catalogs use N proposals;
otherwise proposal count is min(N, catalog length).

`Demonstration.augmented` persists teacher provenance independently of output
completeness. Labeled/prewarmed/fill demos remain false; TeacherTrace sets true.
The proposer gathers up to three augmented demos from current, following, then
preceding sets, and suppresses demos for proposal zero. Equivalence remains
encoded input/output only; the cache parameters hash includes provenance.
Program-description prompts intentionally represent Module.Structure-derived
predictor paths and signature text, not Python source; language-specific prompt
serialization is not byte-identical. No synthetic cache markers enter prompts.

Wave 3.3 runs the real seeded multivariate TPE scheduler, including the baseline
as study row 0 and inserted full-evaluation rows while the sampled objective is
still pending. Those forced configurations draw no sampler randomness. Budgets
count sampled trials, not study rows. Auto derives its candidate and trial counts
from the pinned source, and enables minibatching only when the sampled valset
has more than 50 rows. Omitted validation uses the last min(1000, max(1,
floor(0.8 × trainset size))) examples; splitting consumes no RNG.

| Fixture                                          |           Sampled | Inserted full | Baseline | Total rows | Minibatch | Valset | strictThroughTrial | First inadmissible tie         |
| ------------------------------------------------ | ----------------: | ------------: | -------: | ---------: | --------- | -----: | -----------------: | ------------------------------ |
| `mipro-trial-budget-001` (light)                 |                10 |             0 |        1 |         11 | false     |      6 |                 10 | none                           |
| `miprov2-medium-001`                             |                18 |             0 |        1 |         19 | false     |      6 |                 15 | 16, coincidentalCancellation   |
| `miprov2-heavy-001`                              |                27 |             0 |        1 |         28 | false     |      6 |                 17 | 18, coincidentalCancellation   |
| `miprov2-explicit-001`, `mipro-best-fullval-001` |                12 |             6 |        1 |         19 | true      |      6 |                 10 | 11, coincidentalCancellation   |
| `miprov2-no-labels-001`                          |                12 |             0 |        1 |         13 | false     |      6 |                 12 | none                           |
| `miprov2-zero-shot-001`                          |                12 |             0 |        1 |         13 | false     |      6 |                 10 | 11, coincidentalCancellation   |
| `miprov2-auto-minibatch-001` (light)             |                10 |             2 |        1 |         13 | true      |     51 |                 12 | none                           |
| `miprov2-exhausted-full-eval-001`                | 8 of 12 requested |             3 |        1 |         12 | true      |      6 |                 11 | none; selector fails on row 11 |

`strictThroughTrial` uses actual Optuna study numbers, inclusively, rather than
sampled-objective numbers. Within each prefix, full-compile tests assert exact
configurations, scores, validation identities/order, instructions and demos.
The fully strict light, no-labels and auto-minibatch runs also assert the returned
program against upstream. Beyond a prefix, upstream rows are observation only:
tests use Theoria's own scores to check counts, checkpoint cadence and final
full evaluation, the highest mean minibatch score among combinations not yet
checkpointed, and the best full-evaluation return. Minibatch peaks never replace
that return; ties retain the earliest full row. The baseline combination remains
eligible for its first checkpoint. Exhausting all combinations raises the typed
MIPROv2Error with the upstream message and trigger, rather than reusing a checkpoint.
Events and reports retain partial trial evidence without parameter mutation.

Search tells percentage scores to TPE and reports fractions. Two-decimal
percentage rounding uses Python's half-even rule over the exact binary input;
local boundary tests distinguish it from rounding the fraction to four places.
Explicit nonpositive trial budgets evaluate only the baseline. Defaults come
from the pinned constructor/compile signatures, including caps 4/4, seed 9,
minibatch size 35 and full-evaluation interval 5.

Wave 3.4 verifies GEPA's default three-example epoch-shuffled training batches,
coverage-pruned per-instance winners, frequency-expanded parent choice, strict
minibatch improvement, aggregate-best return, and complementary merges against
GEPA 0.1.4. Defaults come from DSPy 3.4.0's GEPA signature, not gepa.api.optimize:
auto is absent, exactly one budget is required, seed is 0, useMerge is true,
maxMergeInvocations is 5, skipPerfectScore is true, addFormatFailureAsFeedback
is false, selection is pareto/roundRobin, and failure/perfect scores are 0/1.
Reflection uses trainset; seed and accepted-candidate selection use valset.
An omitted or empty valset falls back to training. requireDistinctValset is a
local opt-in overlap guard. maxFullEvals counts train plus explicitly supplied
validation rows before fallback; auto uses the upstream budget formula.

The orchestration CPython stream is shared by parent choice, epoch shuffling,
and merge draws. A separate equally seeded adapter stream chooses one actual
target-predictor execution for feedback, even for a singleton trace. The
coverage kernel and shared-stream batch identities are asserted in
`gepa-selection-001`; `gepa-001` asserts all rollout and targeted-feedback
identities, proposals and returned instructions. Feedback calls do not consume
the metric budget: the report exposes feedbackMetricCalls separately. The
ledger includes seed/full validation, parent and child minibatches, and merge
subsamples. Stop checks occur only at iteration boundaries:

| Fixture                   | Budget | Final ledger | Feedback calls | Iterations | Outcome                        |
| ------------------------- | -----: | -----------: | -------------: | ---------: | ------------------------------ |
| `gepa-001`                |     30 |           38 |              9 |          3 | Three accepted mutations       |
| `gepa-budget-001`         |      6 |            8 |              0 |          1 | Perfect batch skips reflection |
| `gepa-merge-accepted-001` |     34 |           45 |              6 |          3 | Two mutations, accepted merge  |
| `gepa-merge-rejected-001` |     34 |           38 |              6 |          3 | Two mutations, rejected merge  |

The two merge engine fixtures use a scripted GEPAAdapter; feedback counts in
those rows are Theoria's separately asserted adapter calls, not engine budget
entries. Both concrete merge outcomes skip reflection for the entire iteration;
only acceptance decrements mergesDue and increments acceptedMerges. Exact
validation subsamples, candidates, parents, scores, ledger and return are tested.
`gepa-merge-001` additionally checks common-ancestor eligibility, one tied
instruction conflict, and balanced A/B/tie sampling in ascending validation-index
order. The generator asserts CPython's ascending contiguous-int set intersection
for the seven-row fixture. Local tests exercise triplet/description deduplication,
all/custom component selection, score-only feedback, actual repeated execution
targets, format-failure evidence, critic-only settings and interruption safety.

Deliberate GEPA differences: predictor traversal and merge conflicts follow stable
Module.Structure path order, not Python's insertion/string-set order. The fixtures
align component order and contain at most one random tied conflict; multi-conflict
identity is not claimed. Both upstream generators restart with PYTHONHASHSEED=0
before importing upstream libraries and record it in manifests; this stabilizes
recorded bytes without broadening the identity claim. Parse-failure feedback uses
the real encoded input, raw response and native prompt structure; reflective
prompts and schema payloads are language-native, not Python prompt bytes. Without
a critic ModelBinder, reflection falls back to the task model with a warning,
rather than requiring a separate reflection_lm. Supplied binders control roles
and settings; no generation overrides are invented.

GEPA.State deliberately provides stronger continuation than upstream run_dir:
it persists both RNG streams, epoch state, component cursors, merge scheduler
counters and deduplication records. JSON checkpoint/resume tests match an
uninterrupted Theoria run exactly in candidates, scores, ledger, parameters and
RNG state, including accepted and rejected merges. Upstream pickles state only;
its external RNG, epoch sampler and merge scheduler are not saved. There is no
claim of upstream restart-trajectory identity. The accepted-merge fixture also
records a real upstream run_dir restart with no LM calls: stop at ledger 33,
then resume with budget 34. Restart ends at 46 with a single-parent mutation
and no merge; uninterrupted execution ends at 45 with parents [1, 2]. This is
observational evidence, not a target for Theoria's continuation.

Wave 1.1 binds effective generation settings and semantic roles to model requests.
Independent transport tests cover provider field mappings, retained defaults, role
fallback, and unsupported-setting failures before HTTP. Predictor tests cover
text, structured, tool turns, invocation overrides, and rollout identity. These
tests establish local contracts, not additional upstream parity claims.

Wave 1.3 gives examples stable identities and raw optional labels, and gives metrics
decoded predictions, invocation evidence, phase context, and finite scores with
optional feedback. Independent tests cover normalization and passage-token
boundaries; these additions do not claim upstream differential verification.

Wave 1.5 Cache follows DSPy's `cache=True` default at every temperature;
`rollout_id` partitions otherwise identical sampling requests. `cache: "never"`
opts out, and calls executing toolkit handlers are not memoized. Automatic keys
include declared model identity, resolved defaults plus request settings, role,
predictor path, composed signature metadata, instructions, demonstrations and input.
Undeclared native runtimes use process-local object identity. Cache failures warn
and continue; explicit cache operations retain typed errors. Trace attempts retain
failed parse evidence separately from selected completed invocations. These are
local contract tests, not a full cache/adapter differential parity claim.

Inventory: every non-private, non-module value exported by the six DSPy 3.4.0
package namespaces below (including aliases and re-exported types). Namespace
modules themselves are navigation, not separate API claims. Inventory was read
from the pinned installed distribution, not the website's rolling API reference.

## Evidence and regeneration

`test/fixtures/dspy/manifest.json` has one Schema and no format/generator version
counter or compatibility path. `upstream-execution`
means a real DSPy/GEPA program or optimizer ran; `upstream-kernel` means a real upstream
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

| Fixture                                        | Owning wave | Current mismatch                                                                                                                         |
| ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `eval-failure-inclusive-001`                   | 1           | Resolved: the failure-inclusive denominator gives 0.5, matching DSPy.                                                                    |
| `mipro-trial-budget-001`                       | 3           | Resolved: auto light executes 10 sampled trials plus the baseline, with exact trial identities.                                          |
| `mipro-best-fullval-001`                       | 3           | Resolved: the full-validation best remains 0.8 despite minibatch peaks of 1 and their full-validation scores of 0.5.                     |
| `gepa-aggregate-best-001`                      | 3           | Resolved: the aggregate-best generalist is returned, even outside the coverage-pruned parent set.                                        |
| `optuna-mipro-categorical-001` (effect-search) | 3           | Resolved: mixture of product categorical kernels; fixed-history joint-distribution comparison passes its original total-variation bound. |

The GEPA witness now returns the generalist `[0.8, 0.8]` (mean 0.8), rather than
the first frontier specialist `[1, 0]` (mean 0.5).

All original DSPy and Optuna expected-failure discriminators now pass as ordinary
tests. The passing Optuna differential compares 512 independent seeded draws after
replaying a history with one failed trial; failed observations are omitted from
fitting. The numerical corpus and MIPRO kernel share the Optuna 4.9.0
generator and root lock with DSPy. CI's `fixtures-verify` job runs both locked
checks; neither check accepts unowned corpus files.

GEPA's minimal aggregate discriminator disables merges; the separate merge kernel
and engine fixtures establish the bounded merge claims described above.
Teacher/student signatures must match including instructions, as required by
DSPy's compiler. The TypeScript recorder records native provider options;
settings/role/rollout capture uses the Wave 1 model-binding contract. There
are no placeholder fields. Examples now have explicit or content-derived identity;
the upstream fixtures retain their recorded input/output representation.

## effect-search: Optuna 4.9 kernel verification in Wave 3.0

Regeneration covers all 45 numerical/scenario payloads and their manifest,
plus the MIPRO kernel and its manifest. All nine former expected failures now
pass without relaxed assertions or tolerances. An ordinary manifest test decodes every
payload independently.
The generator's `--check` compares every generated payload and manifest byte,
including SHA-256 hashes.
Both harnesses disable NumPy AVX2/FMA3/AVX512F dispatch before import:
otherwise CPU-specific math paths differ in the last bits (observed up to
3.6e-15 in truncated-normal values). Values are not rounded to hide that drift.
GP reproduction also fixes PyTorch dispatch to `default`, MKL to its
cross-CPU reproducibility mode, and OpenBLAS to `HASWELL`, with one BLAS/OpenMP
thread. This reference runtime requires an AVX2-capable Linux x86_64 CPU.

The table below records the historical first-failure witnesses from Wave 0,
not current mismatches. Every listed test now passes its entire scenario set.
Continuous bandwidth excludes the prior from observation-neighbor distances;
mixed and categorical sampling share mixture components across dimensions.
Trial splitting exhausts completed trials before step-ranked pruned trials,
then least-violation infeasible trials. Running trials stay above and do not
count toward startup; failed trials are excluded. Optimization keeps completed,
pruned and pending histories separate. Duplicate reports retain the first value;
new decreasing steps are accepted. MOTPE uses greedy marginal hypervolume
selection. Constraint fixtures additionally cover all-infeasible and
feasible-exhausted histories. These are kernel claims, not bit-exact NumPy RNG
or end-to-end Optuna trajectory claims.

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
not establish sampler parity. GP fits completed observations only; pending-aware
acquisition is outside this wave and is not implemented. None of these results
promotes a DSPy optimizer API to `verified`.

## Public surface

| DSPy API                                      | Theoria API                                                 | Status      | Evidence fixture IDs                                                                                                                                                                   | Notes                                                                                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `teleprompt.AvatarOptimizer`                  | —                                                           | planned     | —                                                                                                                                                                                      | Legacy disposition, Wave 6.                                                                                                                                                                           |
| `teleprompt.BetterTogether`                   | —                                                           | planned     | —                                                                                                                                                                                      | Training, Wave 5.                                                                                                                                                                                     |
| `teleprompt.BootstrapFewShot`                 | `BootstrapFewShot`                                          | verified    | `bootstrap-teacher-trace-001`, `bootstrapfewshot-001`, `bootstrapfewshot-threshold-001`, `bootstrapfewshot-errors-001`, `bootstrapfewshot-labeled-001`, `bootstrap-repeated-call-001`  | Teacher provenance, cross-example duplicates, thresholds, error budget, labeled prewarming and leave-one-out. Repeated-call count and trace membership verified; hash-selected pick limitation above. |
| `teleprompt.BootstrapFinetune`                | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5.                                                                                                                                                                                               |
| `teleprompt.bootstrap_trace_data`             | `TeacherTrace`                                              | verified    | `bootstrap-teacher-trace-001`                                                                                                                                                          | Lossless teacher evidence; repeated-call selection limitation above.                                                                                                                                  |
| `teleprompt.COPRO`                            | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `teleprompt.Ensemble`                         | `Ensemble`                                                  | implemented | `majority-001`                                                                                                                                                                         | Kernel only; legacy compile signature audited in Wave 6.                                                                                                                                              |
| `teleprompt.InferRules`                       | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `teleprompt.KNNFewShot`                       | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `teleprompt.MIPROv2`                          | `MIPROv2`                                                   | verified    | `mipro-trial-budget-001`, `mipro-best-fullval-001`, `miprov2-medium-001`, `miprov2-heavy-001`, `miprov2-explicit-001`, `miprov2-auto-minibatch-001`, `miprov2-exhausted-full-eval-001` | Exact seeded prefixes and full-run checkpoint/selection policy; per-run bounds and program-description prompt divergence documented above.                                                            |
| `teleprompt.BootstrapFewShotWithRandomSearch` | `BootstrapRS`                                               | verified    | `bootstraprs-001`, `cpython-random-001`                                                                                                                                                | Exact demo identities/order for every candidate, seed catalog, full-validation fraction scores, earliest winner. stopAtScore uses equivalent fraction units.                                          |
| `teleprompt.SIMBA`                            | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `teleprompt.Teleprompter`                     | Optimizer-owned Options/run                                 | non-goal    | —                                                                                                                                                                                      | Python base-class hierarchy is not the target.                                                                                                                                                        |
| `teleprompt.BootstrapFewShotWithOptuna`       | —                                                           | planned     | —                                                                                                                                                                                      | Legacy optimizer disposition, Wave 6.                                                                                                                                                                 |
| `teleprompt.LabeledFewShot`                   | `LabeledFewShot`                                            | verified    | `labeledfewshot-001`, `cpython-random-001`                                                                                                                                             | Exact per-predictor demo identities/order from successive sample calls on one seed-0 stream; reset.                                                                                                   |
| `teleprompt.GEPA`                             | `GEPA`                                                      | verified    | `gepa-aggregate-best-001`, `gepa-001`, `gepa-budget-001`, `gepa-selection-001`, `gepa-merge-001`, `gepa-merge-accepted-001`, `gepa-merge-rejected-001`                                 | Exact selection, shared-stream batching, ledger and merge evidence; native prompts, stable component order and stronger resume documented above.                                                      |
| `predict.majority`                            | `Ensemble` reducer                                          | implemented | `majority-001`                                                                                                                                                                         | Exact strings and first-observed tie only.                                                                                                                                                            |
| `predict.BestOfN`                             | `Module.bestOfN`                                            | implemented | —                                                                                                                                                                                      | Local selection tests; upstream parity audit remains in Wave 4.                                                                                                                                       |
| `predict.ChainOfThought`                      | `Module.chainOfThought`                                     | implemented | `predict-trace-001`                                                                                                                                                                    | Reasoning output and trace tested; not complete surface verification.                                                                                                                                 |
| `predict.CodeAct`                             | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5.                                                                                                                                                                                               |
| `predict.KNN`                                 | —                                                           | planned     | —                                                                                                                                                                                      | Legacy disposition, Wave 6.                                                                                                                                                                           |
| `predict.MultiChainComparison`                | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `predict.Parallel`                            | Effect concurrency                                          | planned     | —                                                                                                                                                                                      | Batched module semantics, Wave 4.                                                                                                                                                                     |
| `predict.Predict`                             | `Module.predict`                                            | implemented | `predict-trace-001`                                                                                                                                                                    | Core contracts, Wave 1.                                                                                                                                                                               |
| `predict.ProgramOfThought`                    | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5.                                                                                                                                                                                               |
| `predict.ReAct`                               | `Module.react`                                              | implemented | —                                                                                                                                                                                      | Wave 4 audit.                                                                                                                                                                                         |
| `predict.Tool`                                | `effect/ai` tools                                           | planned     | —                                                                                                                                                                                      | Wave 4/6 tool adaptation.                                                                                                                                                                             |
| `predict.ReActV2`                             | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4/6 surface audit.                                                                                                                                                                               |
| `predict.Refine`                              | `Module.refine`                                             | implemented | —                                                                                                                                                                                      | Immutable single-string feedback reaches all leaf predictors. Wave 4: predictor-name advice dictionary and `hint_` input injection through the adapter.                                               |
| `predict.RLM`                                 | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5.                                                                                                                                                                                               |
| `evaluate.CompleteAndGrounded`                | —                                                           | planned     | —                                                                                                                                                                                      | Semantic metrics, Wave 4.                                                                                                                                                                             |
| `evaluate.SemanticF1`                         | —                                                           | planned     | —                                                                                                                                                                                      | Semantic metrics, Wave 4.                                                                                                                                                                             |
| `evaluate.Evaluate`                           | `Evaluate`                                                  | verified    | `eval-failure-inclusive-001`                                                                                                                                                           | Failure-inclusive denominator; other semantics are locally tested.                                                                                                                                    |
| `evaluate.EvaluationResult`                   | `Evaluate.Report`                                           | implemented | `eval-failure-inclusive-001`                                                                                                                                                           | Shape differs; behavioral target.                                                                                                                                                                     |
| `evaluate.EM`                                 | `Metric.exactMatch`                                         | implemented | —                                                                                                                                                                                      | Normalization audit required.                                                                                                                                                                         |
| `evaluate.answer_exact_match`                 | `Metric.answerExactMatch`                                   | implemented | —                                                                                                                                                                                      | DSPy normalization and fractional token F1; local tests, no upstream fixture.                                                                                                                         |
| `evaluate.answer_passage_match`               | `Metric.answerPassageMatch`                                 | implemented | —                                                                                                                                                                                      | Normalized DPR token-boundary matching; local tests, no upstream fixture.                                                                                                                             |
| `evaluate.normalize_text`                     | Internal `normalizeAnswer` in `internal/metric/builtins.ts` | implemented | —                                                                                                                                                                                      | Shared normalization for both answer metrics; not a public helper or verified fixture.                                                                                                                |
| `retrievers.Embeddings`                       | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4; providers in effect-inference.                                                                                                                                                                |
| `retrievers.EmbeddingsWithScores`             | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `retrievers.Retrieve`                         | —                                                           | planned     | —                                                                                                                                                                                      | Wave 4.                                                                                                                                                                                               |
| `adapters.Adapter`                            | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6 service.                                                                                                                                                                                       |
| `adapters.ChatAdapter`                        | Internal formatter/parser                                   | implemented | `chat-adapter-001`                                                                                                                                                                     | Kernel only; fallback/format audit remains.                                                                                                                                                           |
| `adapters.JSONAdapter`                        | Structured output strategy                                  | implemented | —                                                                                                                                                                                      | Not equivalent to full upstream adapter.                                                                                                                                                              |
| `adapters.TwoStepAdapter`                     | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.Audio`                              | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.Code`                               | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.File`                               | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6 provider capability audit.                                                                                                                                                                     |
| `adapters.History`                            | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.Image`                              | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.Reasoning`                          | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `adapters.Tool`                               | `effect/ai` tools                                           | planned     | —                                                                                                                                                                                      | Wave 4/6.                                                                                                                                                                                             |
| `adapters.ToolCallResults`                    | `effect/ai` tool results                                    | planned     | —                                                                                                                                                                                      | Wave 6 adaptation.                                                                                                                                                                                    |
| `adapters.ToolCalls`                          | `effect/ai` tool calls                                      | planned     | —                                                                                                                                                                                      | Wave 6 adaptation.                                                                                                                                                                                    |
| `adapters.Type`                               | Effect Schema                                               | non-goal    | —                                                                                                                                                                                      | Python type hierarchy; field semantics audited individually.                                                                                                                                          |
| `adapters.XMLAdapter`                         | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6.                                                                                                                                                                                               |
| `primitives.BaseModule`                       | `Module`                                                    | implemented | —                                                                                                                                                                                      | Functional construction rather than inheritance.                                                                                                                                                      |
| `primitives.CodeExecutionError`               | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 typed failures.                                                                                                                                                                                |
| `primitives.CodeInterpreter`                  | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 service.                                                                                                                                                                                       |
| `primitives.CodeInterpreterError`             | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 typed failures.                                                                                                                                                                                |
| `primitives.FinalOutput`                      | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 code programs.                                                                                                                                                                                 |
| `primitives.resolve_interpreter_factory`      | —                                                           | non-goal    | —                                                                                                                                                                                      | Python factory loading; use explicit Effect layers.                                                                                                                                                   |
| `primitives.Example`                          | `Example`                                                   | implemented | —                                                                                                                                                                                      | Wave 1 identity/input-key/metadata contracts.                                                                                                                                                         |
| `primitives.LocalInterpreter`                 | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 sandbox execution.                                                                                                                                                                             |
| `primitives.Module`                           | `Module`                                                    | implemented | `predict-trace-001`                                                                                                                                                                    | Wave 1 immutable binding and Wave 6 persistence.                                                                                                                                                      |
| `primitives.Completions`                      | —                                                           | planned     | —                                                                                                                                                                                      | Wave 6 multiple completions.                                                                                                                                                                          |
| `primitives.Prediction`                       | `Prediction.Prediction`, `Module.call`                      | implemented | `predict-trace-001`                                                                                                                                                                    | Decoded output, trace attempts and usage; not Python object identity.                                                                                                                                 |
| `primitives.PythonInterpreter`                | —                                                           | planned     | —                                                                                                                                                                                      | Wave 5 sandbox capability.                                                                                                                                                                            |
| `primitives.SandboxSerializable`              | Schema codecs                                               | planned     | —                                                                                                                                                                                      | Wave 5/6 explicit safe serialization.                                                                                                                                                                 |
