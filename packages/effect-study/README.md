# @scenesystems/effect-study

Study evaluates a supplied dataset in [Effect](https://effect.website) and records the results, including structured observations and expected failures. It also supports recording events for later replay. For optimization over a search space, use [`effect-search`](../effect-search/README.md).

## Installation

```sh
bun add @scenesystems/effect-study effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-study/Evaluation`.

## Basic use

Evaluate a batch of strings and retain the structured observations in trial history.

```ts typecheck
import { Array, Effect, Schema, String } from "effect"
import { Evaluation, History } from "@scenesystems/effect-study"

const Observation = Schema.Struct({ normalized: Schema.String })

export const program = Effect.gen(function* () {
  const trials = yield* Evaluation.run(
    Array.make("first sample", "second sample"),
    (input) => Effect.succeed(Observation.make({ normalized: String.toUpperCase(input) })),
    { concurrency: 2 }
  )
  return History.fromIterable(trials)
})
```

`Evaluation.run` returns completed trials in input order, with zero-based trial numbers and durations in milliseconds. Omit `concurrency` for sequential execution. An evaluator failure interrupts its siblings and waits for their finalizers; it does not return partial history.

Use `Evaluation.runSettled` when you need a record of expected evaluator failures alongside successful results. It stores those failures as `Trial.Failed`; defects and interruption still terminate the Effect. Both operations accept empty input. Grading and dataset selection are up to the caller.

[`History`](./src/History.ts) keeps the current record for each trial number. `History.values` returns those records in trial order; `History.costs` reports missing and invalid costs separately from known costs.

Use `Evaluation.runCollecting(inputs, evaluate, { onFailure: "record", maxFailures, concurrency })`
to limit expected failures while collecting results. `maxFailures: Option.none()`
allows any number; `Option.some(n)` allows n failures. Exceeding the limit stops
new evaluations, waits for active work to finish, and fails with
`Evaluation.TooManyFailures` containing the final count.

Both collecting and settled operations propagate any cause containing a defect
or interruption unchanged, including typed failures within that cause.

## Observe a run

`Evaluation.runWithEvents(inputs, evaluate, options, observe)` reports progress through an Effectful observer. It waits for each observer call before delivering the next event. If the observer fails, evaluation stops accepting inputs and interrupts active local work; the observer failure remains separate from trial results.

An observer that records events must wait for storage to confirm the write before succeeding. With a transactional backend, that means waiting for the outer commit. After interruption or process loss, a trial with a recorded start but no acknowledged outcome remains unresolved.

For streams, pass the emitter from [`Emitter.toStream`](./src/Emitter.ts) to `runWithEvents`. The bridge uses an unbounded queue, so queue insertion is neither durable storage nor backpressure. Stopping consumption interrupts the producer and waits for finalization.

See [`Evaluation`](./src/Evaluation.ts) for event types and termination semantics, and [recorded evaluation](./examples/recorded-evaluation.ts) for an awaited recording and checkpoint replay. **Local interruption does not prove remote cancellation or authorize retrying external work.**

## Record and replay events

[`StudyStorage`](./src/StudyStorage.ts) records events in memory or on the filesystem. You supply the event and checkpoint schemas, along with an identity for their definition. Storage uses those schemas on both writes and reads, so any services required by their codecs must also be provided.

```ts typecheck
import { Effect, Number, Schema } from "effect"
import { StudyStorage } from "@scenesystems/effect-study"

export const recorded = Effect.gen(function* () {
  const recording = yield* StudyStorage.open(
    new StudyStorage.OpenOptions({
      runId: "readings-1",
      definitionDigest: "reading-sum",
      eventSchema: Schema.Finite,
      checkpointSchema: Schema.Finite
    })
  )
  yield* recording.append(
    new StudyStorage.Append({
      recordId: "reading-1",
      expectedCursor: 0,
      event: 3
    })
  )
  const checkpoint = yield* StudyStorage.replay(recording, 0, Number.sum)
  yield* recording.writeCheckpoint(checkpoint)
  return checkpoint.state
}).pipe(Effect.provide(StudyStorage.layerMemory))
```

This returns `3`. Provide the storage layer once around operations that share a run; a new provision allocates a new memory store. For filesystem persistence, use `StudyStorage.layerFileSystem(StudyStorage.fileSystemOptions(directory))` and provide Effect's `FileSystem` and `Path` services, for example through `BunServices.layer` from `@effect/platform-bun`.

Keep append identities stable when retrying. An identical encoded retry returns its original receipt; reusing an ID with different content fails. New events must match the expected tail cursor. Change the definition identity when event encoding or interpretation changes.

Replay computes state from recorded events without running the evaluator again. A checkpoint must contain the state computed through its cursor. The most recently written checkpoint takes precedence, even when it has a lower cursor, so coordinate writers and retain the event history. Use a single storage service for each filesystem location; filesystem storage provides neither fsync nor cross-process locking.

The [storage reference](./src/StudyStorage.ts) specifies retry identity, cursor rules, codec requirements, and backend responsibilities. Persistence failures use [`PersistenceError.Failure`](./src/PersistenceError.ts), separate from evaluator failures.

## Retain artifacts

An artifact combines a producer's payload with provenance and relations:

```ts typecheck
import { Artifact } from "@scenesystems/effect-study"
import { Schema } from "effect"

const Producer = Schema.TaggedStruct("Example", { version: Artifact.PackageVersion })
const Lineage = Artifact.Lineage(Artifact.Source)
const Payload = Schema.TaggedStruct("Reading", { payload: Schema.Finite })
export const ReadingEnvelope = Artifact.Envelope(Producer, Lineage, Payload)
```

[`Artifact`](./src/Artifact.ts) combines these schemas without authenticating the producer. Use [`ArtifactContext`](./src/ArtifactContext.ts) to allocate an identity, then [`ArtifactSink`](./src/ArtifactSink.ts) to deliver the encoded artifact. Keep that identity when retrying delivery. Delivery to several sinks can partially succeed; fanout is not a transaction.

Use [artifact persistence](./examples/artifact-persistence.ts) for transformed payload codecs, delivery, and checkpoints. [`Journal`](./src/Journal.ts) supplies lower-level JSON-lines persistence when no run recording is needed.

## Lifecycle

[`Study`](./src/Study.ts) owns scoped lifecycle and trial history. [`Stop`](./src/Stop.ts) supplies cooperative stop decisions; [`Lifecycle`](./src/Lifecycle.ts) describes valid transitions. These are useful when building a runner, rather than evaluating a fixed batch with `Evaluation`.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs. Run them from a repository checkout with `bun packages/effect-study/examples/<file>.ts`; they use local data and need no provider credentials.

- [Evaluation](./examples/evaluation.ts): evaluation and schema-encoded observations.
- [Structured evaluation](./examples/structured-evaluation.ts): caller grading, typed failure, and missing costs.
- [Recorded evaluation](./examples/recorded-evaluation.ts): observer failure, checkpoints, and reopening a recording.
- [Artifact persistence](./examples/artifact-persistence.ts): payload codecs and delivery.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
