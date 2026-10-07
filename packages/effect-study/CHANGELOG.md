# @scenesystems/effect-study

## 0.2.0

### Minor Changes

- [#123](https://github.com/scenesystems/theoria/pull/123) [`ef4797f`](https://github.com/scenesystems/theoria/commit/ef4797f66bee0670d5ebb1cd8261805c0c89f035) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add evaluation recording and reconstruction to `effect-study`, with corresponding persistence integration in `effect-search` and `effect-dsp`. Callers can retain individual outcomes as an evaluation runs, reopen its recording, and distinguish finished work from unresolved or unstarted inputs without executing it again.

  ### Evaluate inputs without losing expected failures
  - `Evaluation.runSettled` returns completed values and expected typed failures in input order. `Evaluation.run` retains its fail-fast behavior.
  - `Evaluation.runWithEvents` adds serialized, awaited observations. A trial starts only after its start observation is acknowledged, and its outcome is recorded only after terminal acknowledgment. Observer failure stops new admission and interrupts active local evaluations; previously acknowledged evidence remains available to the observer.
  - Defects and interruption remain native Effect causes, not ordinary failed trials. Compound fatal causes can retain evaluator errors in the Effect error channel. Completed values do not imply correct answers: grading remains caller-owned.
  - `Emitter<A, E, R>` preserves observer error and service requirements.

  ### Record events and reconstruct progress

  `StudyStorage.open` binds a run identity, definition digest, and caller-provided event/checkpoint codecs to a recording. Memory and filesystem implementations support append, cursor-based reads, and checkpoint-bound replay. Repeating an identical record ID returns its original receipt; conflicting content or a stale expected cursor fails explicitly. Checkpoints identify the committed cursor through which their state was reduced.

  `Evaluation.RecordedEvent`, `View`, `empty`, `reduce`, and `coverage` reconstruct planned inputs and retained outcomes, including unresolved starts and inputs that never started. Replay performs no external work. An unresolved start is not proof of failure or confirmed cancellation and does not authorize a retry.

  Filesystem recordings require one owning writer. They reject malformed records and incomplete tails without repair or truncation. Append acknowledgment does not promise fsync or survival of power loss.

  Event and checkpoint payload decoding failures include the filesystem path and physical line, including cached records. After a failed or interrupted append, retry revalidates the file: a committed identity returns its receipt, an absent record can be appended, and an incomplete tail fails without repair.

  Artifact journals retain the destination path for schema encoding failures and the path plus physical line for JSON or artifact-schema decoding failures, counting blank lines. Encoding and decoding retain their independent codec service requirements.

  For transactional custom backends, append receipts are provisional until the caller's outer commit. Observers must await short per-observation transactions, not hold a transaction around an evaluation. Construct long-lived artifact contexts outside short-lived transactions so captured services do not retain a released transaction connection.

  Retry identity compares the exact schema-produced JSON string, not semantic object equality or database-normalized JSON. The latest checkpoint is the latest written, including a lower-boundary checkpoint. Callers coordinate checkpoint writers and own state correctness; custom backends must provide coherent checkpoint/tail reads and retain event and identity history. No compaction protocol is supplied. Memory and filesystem stores share test-only protocol conformance coverage.

  ### Allocate artifact identities and inspect cost completeness

  `ArtifactContext` accepts a restored `nextSequence` or a caller-owned allocator. Durable, unique reservations belong to the caller; the built-in memory allocator is not durable. Allocation does not store a payload. Delivery retries reuse the artifact's identity, and unused sequence gaps are valid. Sink fanout is sequential and awaited, but a later sink failure does not undo earlier delivery.

  `History.costs` reports `reportedTotal`, `reportedCount`, `missingCount`, and `invalidCount` for current trial records. Known zero differs from missing cost; negative and non-finite costs are invalid. Replacing a trial replaces its contribution. `cumulativeCost` remains the sum of valid reported costs, not total billed spend.

  `reportedTotal` is a finite nonnegative number or `"Overflow"` when valid reported costs exceed finite number range in floating-point summation. Counts remain intact; no valid cost is reclassified or total clamped. Replacing a large cost can restore a finite summary because the projection recomputes from current records.

  ### API changes for consumers
  - `StudyStorage` exposes run-bound recordings. Its generic trial/snapshot methods are replaced by recording operations; filesystem storage uses the run-recording format. Requests use `new OpenOptions(...)`, `new Append(...)`, and `new CheckpointWrite(...)`; `read` accepts plain options.
  - Journal, storage, and artifact delivery use `PersistenceError.Failure` instead of `Journal.Failure`. Callers can distinguish codec, backend, record-identity, cursor, and incompatible-recording failures.
  - `ArtifactContext.make`, `layer`, and `nextId` expose typed allocation failures. Custom allocators can require services, which are captured when the context is constructed.
  - Search's `OptimizationStorage` uses recording handles while retaining optimization-specific checkpoint and replay policy. Search/DSP consumers propagate persistence failures as infrastructure errors rather than retrying or scoring them as objective failures.

  Includes runnable examples for settled evaluation, caller grading, artifact delivery, and reopening incomplete recordings.

### Patch Changes

- Updated dependencies [[`6685af5`](https://github.com/scenesystems/theoria/commit/6685af5203e4e9522ad8dd4d73b1a2ac4797d2cd)]:
  - @scenesystems/digest@0.8.0

## 0.1.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

  Require Effect v4 across study, search, DSP, and text. Preserve evaluator, objective, callback, stream, and codec failure and service channels rather than materializing them synchronously. Filesystem study and optimization storage requires Effect's `FileSystem` and `Path` services; schema reads and writes retain their independent decoding and encoding requirements. Stateful layers use `Layer.fresh`, so each acquisition allocates independent state; provide one acquired layer around operations that must share a run.

  `History.trials` is an Effect `HashMap`; use `History.values` for trial-number order. `StudyStorage.makeMemory` is an Effect: yield it or use `StudyStorage.layerMemory`. Instantiate exported option classes with `new`, including `new ArtifactContext.Options(...)` and `new StudyStorage.FileSystemOptions(...)`.

  Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

  Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

  Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.

### Patch Changes

- Updated dependencies [[`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc)]:
  - @scenesystems/digest@0.7.0
