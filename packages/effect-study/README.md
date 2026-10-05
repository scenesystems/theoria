# @scenesystems/effect-study

Reusable trial evaluation, history, stopping, event streams, and artifact persistence for [Effect](https://effect.website). Use it when inputs are already known and observations need not be numeric scores. Search spaces, samplers, objective ranking, and pruning belong to [`@scenesystems/effect-search`](../effect-search/README.md).

## Installation

```sh
bun add @scenesystems/effect-study effect
```

Effect `^4.0.0` is the required peer. `FileSystem` and `Path` come from `effect`; filesystem persistence requires their services. Bun applications can provide `BunServices.layer` from `@effect/platform-bun` v4. The package has no dependency on `effect-search`.

## Evaluate known inputs

```ts typecheck
import { Array as Arr, Effect, Schema, String as Str } from "effect"
import { Evaluation, History } from "@scenesystems/effect-study"

const Observation = Schema.Struct({ normalized: Schema.String })

export const program = Effect.gen(function* () {
  const trials = yield* Evaluation.run(
    Arr.make("first sample", "second sample"),
    (input) => Effect.succeed(Observation.make({ normalized: Str.toUpperCase(input) })),
    { concurrency: 2 }
  )
  return History.fromIterable(trials)
})
```

`Evaluation.run` numbers trials from zero, measures evaluation duration in milliseconds, and returns completed records in input order. Omitted concurrency means sequential execution. Evaluator failures retain their error type and interrupt in-flight siblings, waiting for their finalizers. No partial history is returned on failure.

Empty input is valid. Settled evaluation means every input reaches an expected outcome, not that every trial succeeds; grading and nonempty-dataset requirements belong to callers. Defects and interruption must not become successful partial reports.

`Evaluation.runSettled(inputs, evaluate, options)` returns `SettledTrial<C, A, E>` records whose states are `Trial.Completed<A> | Trial.Failed<E>`. Expected evaluator errors become retained data; defects and interruption still terminate through the Effect cause. No score or grading policy is imposed.

Settled operations retain `E` in the Effect error channel for **compound fatal causes**: for example, a typed evaluator failure followed by a defect in its finalizer. Ordinary typed failures become records, but a cause containing any defect or interruption terminates unchanged, including its typed failure reasons. Using `Effect.result` alone would incorrectly swallow the defect in this case.

`Evaluation.runWithEvents(inputs, evaluate, options, observe)` returns the same records with error channel `E | OE` and service requirements `R | OR`. Its `Evaluation.EvaluationEvent<C, A, E>` sequence contains `Planned` (the complete input array), `TrialStarted`, `TrialSettled` (the complete trial record), and `Completed` with reason `Settled`. `Terminated` carries the first evaluator termination cause when the observer remains available (or the caller interruption cause if no evaluator captured one). The returned Effect preserves the full execution cause. Generic events require no serialization schema; callers choose codecs at persistence boundaries.

Observer calls are serialized within a run. A start must be acknowledged before evaluation, and a terminal record before it is returned as recorded. Final completion waits for all terminal acknowledgments. Slow observers apply backpressure without preventing bounded concurrent evaluation. Observer failure closes admission and interrupts active local work, waiting for finalizers; it is not a trial failure and is not recursively reported to that observer. Already acknowledged evidence remains in the caller's sink. Cleanup observations are not guaranteed after sink failure or process loss: a start without a terminal record remains unresolved.

For an event stream, pass the emitter supplied by `Emitter.toStream` directly to `runWithEvents`. Ending stream consumption interrupts the local producer and waits for finalizers; it says nothing about remote execution.

```ts typecheck
import { Array as Arr, Effect, Number as Num, Ref } from "effect"
import { Emitter, Evaluation } from "@scenesystems/effect-study"

const evaluate = (input: number) =>
  Num.Equivalence(input, 2) ? Effect.fail("unavailable") : Effect.succeed(Num.multiply(input, 10))

export const retained = Effect.gen(function* () {
  const evidence = yield* Ref.make(Arr.empty<Evaluation.EvaluationEvent<number, number, string>>())
  const trials = yield* Evaluation.runWithEvents(Arr.make(3, 2, 1), evaluate, { concurrency: 2 }, (event) =>
    Ref.update(evidence, Arr.append(event))
  )
  return { trials, evidence: yield* Ref.get(evidence) }
})

export const events = Emitter.toStream((emit: Emitter.Emitter<Evaluation.EvaluationEvent<number, number, string>>) =>
  Evaluation.runWithEvents(Arr.make(3, 2, 1), evaluate, { concurrency: 2 }, emit)
)
```

An observer acknowledges an event by successfully completing its Effect. Memory acceptance, file append, and a durable database commit are different guarantees chosen by the observer. Serialized observation order need not match input order; returned trial records remain in input order. Queue insertion is not a persistence acknowledgment.

`History` keeps the latest record for each trial number in an Effect `HashMap`; `History.values` returns records sorted by trial number. Replacing a record replaces its cost contribution rather than charging it twice. Absent, negative, and non-finite costs in trusted in-memory records contribute zero. Trial and event codecs require finite numerical metadata. Applications choose cost units.

`History.costs(history)` returns a `History.Cost` projection with `reportedTotal`, `reportedCount`, `missingCount`, and `invalidCount`. A finite nonnegative cost, including zero, is reported; an absent cost is missing; a negative or non-finite cost is invalid. Each current trial contributes to exactly one count, regardless of its outcome. Replacing a trial replaces its evidence. Both `reportedTotal` and `cumulativeCost` summarize valid reported trial costs, not provider attempts, financial reservations, or billing truth. No cost, score, or grading denominator is imputed.

`reportedTotal` is a finite nonnegative number or the JSON-safe literal `"Overflow"` when floating-point summation exceeds finite number range. Overflow does not clamp the total or reclassify individually valid costs; all counts remain available. Each call recomputes from current trial records, so replacing a large cost can restore a finite total. Finite totals use ordinary floating-point precision. `cumulativeCost` remains a numeric incremental accumulator with its numerical limitations; use `costs` for explicit aggregate-overflow evidence.

## Schemas and persistence

`Trial.Trial(config, state)` is the canonical generic trial schema factory. `Trial.Completed(value)` and `Trial.Failed(error)` support structured observations and typed failures, while `Trial.Running` and `Trial.Cancelled` provide the fixed states. Encoded forms and schema service requirements are preserved.

`Artifact` supplies `RunId`, `PackageVersion`, `ComponentPath`, `Id`, the open `Source` schema, and generic relations. Compose lineage and envelopes directly from the schemas your application owns:

```ts typecheck
import { Artifact } from "@scenesystems/effect-study"
import { Schema } from "effect"

const Producer = Schema.TaggedStruct("Example", { version: Artifact.PackageVersion })
const Lineage = Artifact.Lineage(Artifact.Source)
const Payload = Schema.TaggedStruct("Reading", { payload: Schema.Finite })
export const ReadingEnvelope = Artifact.Envelope(Producer, Lineage, Payload)
```

`Artifact.Relation` contains only domain-neutral `Run` and `External` associations; domain packages compose their own relation vocabularies. Use `Artifact.isRelation` to narrow a relation by tag and `Artifact.matchRelation` to handle both variants exhaustively. `ContentDigest` remains owned by `@scenesystems/digest`. Envelopes describe provenance; they do not authenticate a producer or verify a digest.

`Artifact.Envelope` extends a payload struct, retaining field codecs and struct checks. Reserve `producer`, `lineage`, and `relations` for envelope metadata, and ensure payload checks remain valid with those added fields. Compose unions from the resulting envelopes rather than passing a union into the factory. `Artifact.Payload` supports recursive primitive, array, and own-key record values, including non-finite numbers outside JSON; it is not a guarantee of lossless JSON transport. Use a producer-owned finite schema for JSON numerical data.

`Journal.make(schema, directory, fileName)` creates a schema-driven JSON-lines journal. Appends through one journal instance are serialized, including encoding. Reads preserve physical order, skip blank lines, treat missing files as empty, and fail with `PersistenceError.Failure` on malformed or torn records. Decoding errors include the one-based physical line number. Separate instances do not share a lock, and append completion does not promise an fsync or transaction.

`ArtifactContext` owns run identity and atomic artifact sequence allocation. `ArtifactSink` owns schema-encoded artifact delivery, including filesystem journals and ordered fanout. These abstractions are generic: producers supply the artifact schema and retain its codec environment.

Construct `new ArtifactContext.Options({ runId, packageVersion, nextSequence, allocate })`. Omit `allocate` for atomic in-memory allocation starting at `nextSequence` (zero by default). Restore `nextSequence` from the reservation high-water mark, including reservations whose delivery failed or never started; delivered payloads alone cannot determine a safe restart point. Memory allocation is not durable, and separate contexts for the same run do not coordinate.

For durable or multi-writer reservations, supply an `allocate` Effect returning an atomic unique sequence with `PersistenceError.Failure` as its typed error. The caller owns reservation persistence and maps backend errors explicitly. `make` and `layer` capture allocator services at construction; `nextId` executes the allocator lazily. Invalid restored sequences and allocated values below the restored floor fail with reason `Codec`. Construction and `nextId` can fail; consumers retain the failure channel rather than converting infrastructure failures to observations.

Allocation does not store payloads. Gaps are valid; do not reclaim an uncertain reservation. Build the artifact once and retain its identity when retrying delivery. `ArtifactSink.fanout(left, right)` awaits the left sink before the right, stops on failure, and provides neither rollback nor retries. A right failure leaves the left delivery intact; retrying may deliver the same artifact to the left again. Each sink owns deduplication, and the filesystem sink appends rather than deduplicates.

`StudyStorage` owns run-bound event recordings and cursor-bound checkpoints. Both its memory and filesystem implementations schema-encode every write and schema-decode every read, preserving codec service requirements. Its single protocol contains `Opened`, `Event`, and `Checkpoint` records. `effect-search` stores optimization trials as events and snapshots as checkpoint state.

`StudyStorage`, `Journal`, `ArtifactSink`, and Search/DSP persistence paths expose `PersistenceError.Failure`, with wire tag `effect-study/PersistenceError`. Its `reason` distinguishes `Codec`, `Backend`, `RecordConflict`, `CursorConflict`, and `Incompatible`; `operation` distinguishes reads from writes. Paths and physical line numbers are optional filesystem diagnostics. Search treats all persistence failures as fatal, unretried infrastructure failures, never objective scores.

Codecs carry independent decoding and encoding requirements: reads require only decoding services, writes only encoding services. `yield* StudyStorage.makeMemory` allocates fresh storage on each execution. `StudyStorage.layerMemory` and `ArtifactContext.layer(options)` allocate fresh state for each provision, including provisions within one scope. Provide once around all operations that belong to the same run; reuse the acquired service explicitly when sharing state is intended.

`StudyStorage.makeMemory` and `makeFileSystem` support run-bound recordings through the same `StudyStorage` service. Open a handle with `new StudyStorage.OpenOptions({ runId, definitionDigest, eventSchema, checkpointSchema })`; an existing run rejects a different definition digest. The caller owns definition identity and schema compatibility. `append(new StudyStorage.Append({ recordId, expectedCursor, event }))` returns a one-based run-local receipt; zero is the empty cursor. An identical encoded retry returns its original receipt even after later appends. Reusing an ID for different encoded content fails before checking the cursor. A new ID must match the current tail. All handles from one store share serialization; separate stores are independent. Custom `StudyStorage` implementations provide `open` returning a recording handle.

`read({ after })` produces a finite decoded snapshot strictly after that cursor. `writeCheckpoint(new StudyStorage.CheckpointWrite({ through, state }))` binds caller-reduced state to a committed boundary, and the `loadCheckpoint` Effect returns the latest checkpoint, if any. These request models are structural Data classes carrying generic values/codecs, not serialization schemas. Writes retain encoding requirements and reads retain decoding requirements. These recordings use JSON-compatible caller codecs, including in memory; no evaluator or Study is required.

`open`, `append`, and `writeCheckpoint` require `OpenOptions`, `Append`, and `CheckpointWrite` instances respectively. Plain objects do not satisfy those request types because Effect Data instances include `pipe`. Use the constructors shown above; `replay` returns a `CheckpointWrite` instance. `read` accepts plain schema-shaped options.

`StudyStorage.makeFileSystem(options)` writes run-bound protocol records directly to `<directory>/<fileName>`, using strict newline-committed records. Every record must satisfy the recording protocol. Use one owning service per location; handles share its semaphore, but separate instances/processes do not share a lock. Reopening validates each physical record once and builds run/record-ID indexes. Successful appends update those indexes without rereading the prefix. Size, modification time, and inode changes invalidate the cache; absent modification times disable caching. External writers are unsupported, including changes that preserve filesystem metadata. Malformed lines, incomplete tails (even parseable JSON without a newline), duplicate identities, and non-contiguous cursors fail with physical-line diagnostics. The adapter never silently repairs or truncates. Append acknowledgment means the platform append returned successfully for a complete record; it does not promise fsync, survival of power loss, or a transaction across sinks. An interrupted/failed append invalidates the cache and can be uncertain: reopen and retry the same ID, never assume absence. Retained records stay in memory; this is local recording, not a large-scale database.

Event and checkpoint payload codec failures retain the filesystem path and one-based physical line, including records decoded from the append cache. Physical lines count all runs and checkpoints, independently of each run's event cursor. Memory recordings do not invent filesystem diagnostics.

`StudyStorage.replay(recording, initial, reducer)` uses the latest checkpoint and reduces only events strictly after its boundary. Without a checkpoint it reduces the full log. The result `{ through, state }` can be passed to `writeCheckpoint`; reducers must be pure, and callers are responsible for the correctness of checkpoint state. Replay reads evidence, not executable callbacks: it submits no external work and does not authorize retries. The definition digest identifies the event and checkpoint semantics used by the recording. Applications needing a recording append, attempt update, and outbox insertion atomically must compose them in their own transaction; independent sinks cannot provide that guarantee.

`Evaluation.RecordedEvent(config, value, error, defect)` and `Evaluation.View(config, value, error, defect)` supply JSON codecs for evaluation observations and reconstructed checkpoints. Choose a defect codec such as `Schema.Defect()`; typed failures, native causes, and component codec services are retained. Use `StudyStorage.replay(recording, Evaluation.empty(), Evaluation.reduce)` to reconstruct the fixed plan without executing it. `Evaluation.coverage(view)` reports planned, completed, failed, locally interrupted, unresolved-start, and not-started counts, distinguishing an absent plan from a known empty plan. The view retains values, typed failures, and durations, not scores or grading policy.

A `Terminated` observation describes the local run, not the fate of each external effect. Its delivery is interruptible best-effort telemetry; an already-pending interruption may skip it, and a blocked observer cannot prevent subsequent interruption. There is no hidden timeout or detached callback. Starts lacking acknowledged outcomes stay `Unresolved`. A caller that has explicit per-trial local cleanup evidence can append `TrialInterrupted`; only then does that trial become `LocallyInterrupted`. `runWithEvents` does not emit this additional record. Neither category confirms remote cancellation or authorizes repeating work. Reduction expects one valid fixed-plan observation log; recording deduplicates stable append identities, while domain validation and reconciliation remain with the caller.

## Emitters and lifecycle

`Emitter.toStream` runs a producer in a scoped fiber backed by Effect's completion-aware `Queue`. Buffered events drain before success, typed failure, or defect reaches the consumer. Ending consumption interrupts the producer and waits for finalization. The queue is unbounded; this bridge does not provide backpressure.

`Stop` stores requests in a native `Ref`, with deterministic precedence by trial number, then interrupt mode, then reason. Heartbeats are cooperative: they return decisions rather than interrupt fibers. `Stop.matchDecision` exhaustively handles their `Continue` and `Stop` variants. `Lifecycle.canTransition` validates transitions without owning mutable state and supports both receiver-first and pipeable use.

`Study` owns the lifecycle and trial history as one serialized, observable snapshot. `Study.modify` commits and publishes only a successful complete snapshot; transaction failure or interruption leaves the prior snapshot intact and releases the serializer. A callback that returns an illegal lifecycle change violates a programmer invariant, so `modify` dies with a diagnostic before committing any lifecycle or history change. It does not broaden the typed error channel. Use `Study.transition` for lifecycle requests: invalid requests remain no-ops, terminal studies never reopen, and closing the owning scope cancels a created, running, or paused study.

`StudyEvent` owns domain-generic schema factories for reservations, outcomes, retries, cancellation, cost, stop requests, and completion. Callers provide config, observation, failure, cancellation-reason, and completion-reason schemas rather than inheriting a numeric search vocabulary.

Scope finalization changes the local Study lifecycle, not arbitrary external execution state. An unresolved trial remains unresolved; local interruption does not confirm remote cancellation. Reconstructing recorded evidence does not authorize repeating an external effect.

## Relationship to search and other packages

`effect-search` can specialize these schemas and operations for numeric objectives while retaining its own snapshot format, producer vocabulary, storage service, and error types. Fixed-input consumers can use `Evaluation` without a search-space abstraction.

Import this package directly for new evaluation or artifact consumers that do not need optimization. No search-space or numeric-objective placeholder is required.

## Runnable examples

Run these from the repository root with `bun packages/effect-study/examples/<file>.ts`:

- [`evaluation.ts`](examples/evaluation.ts): pure Effect evaluation and schema-encoded observations.
- [`structured-evaluation.ts`](examples/structured-evaluation.ts): DSP-shaped predictions, caller grading of a completed wrong answer, typed producer failure, and missing-cost evidence.
- [`recorded-evaluation.ts`](examples/recorded-evaluation.ts): task-shaped values, awaited recording, a checkpoint, sink failure, and reopening with checkpoint-plus-tail replay. The retained plan has one completed, one failed, one unresolved, and one not-started input.
- [`artifact-persistence.ts`](examples/artifact-persistence.ts): producer-owned transformed codecs, artifact delivery, and cursor-bound checkpoints.

The domain-shaped examples use local fixtures, not model calls or remote submissions. They require no domain-package dependencies or credentials. A completed value is evidence of the evaluator's return, not an assertion that its answer is correct or its task succeeded. Callers grade retained values and reconcile unresolved work; replay does neither.

## Public modules

- `Trial`: schema-composed records and outcomes.
- `Evaluation`: fixed-input evaluation.
- `History`: ordered trial history and reported-cost completeness.
- `Lifecycle`: legal phase transitions.
- `Stop`: deterministic cooperative stop requests.
- `Emitter`: scoped producer-to-stream composition.
- `Artifact`: identities, provenance, relations, and envelope schemas.
- `ArtifactContext`: run provenance and atomic artifact identity allocation.
- `ArtifactSink`: schema-owned artifact delivery and persistence.
- `Journal`: schema-driven filesystem persistence.
- `Study`: scoped transactional lifecycle and history ownership.
- `StudyEvent`: generic lifecycle event schema factories.
- `StudyStorage`: run-bound recordings and cursor-bound checkpoints.
