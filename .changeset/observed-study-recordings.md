---
"@scenesystems/effect-study": minor
"@scenesystems/effect-search": minor
"@scenesystems/effect-dsp": minor
---

Add evaluation recording and reconstruction to `effect-study`, with corresponding persistence integration in `effect-search` and `effect-dsp`. Callers can retain individual outcomes as an evaluation runs, reopen its recording, and distinguish finished work from unresolved or unstarted inputs without executing it again.

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
