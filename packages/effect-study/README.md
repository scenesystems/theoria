# @scenesystems/effect-study

Evaluate known inputs, retain trial outcomes, and record evidence for later replay in [Effect](https://effect.website) programs. Observations can be structured values, not just scores. Use [`effect-search`](../effect-search/README.md) instead when you need search spaces, samplers, ranking, or pruning.

## Installation

```sh
bun add @scenesystems/effect-study effect
```

Requires Effect `^4.0.0`. Import concern namespaces from the root or matching subpaths, such as `@scenesystems/effect-study/Evaluation`.

## Evaluate known inputs

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

Use `Evaluation.runSettled` to retain expected evaluator failures as `Trial.Failed` records alongside completed values. Defects and interruption still terminate the Effect. Empty input is valid. The caller decides how to grade outcomes and whether the dataset is sufficient.

[`History`](./src/History.ts) keeps the current record for each trial number. `History.values` returns those records in trial order; `History.costs` distinguishes reported, missing, and invalid costs rather than inventing a total for missing evidence.

## Observe a run

`Evaluation.runWithEvents(inputs, evaluate, options, observe)` adds an Effectful observer to settled evaluation. Events describe the plan, trial starts, outcomes, and completion. Observer calls are serialized and awaited; slow observers apply backpressure. A failed observer stops admission and interrupts active local evaluations without turning the storage failure into a trial result.

An observer's successful Effect acknowledges the event. Await the durability boundary your application needs—for a transactional backend, that means the outer commit, not merely an append inside the transaction. A start without an acknowledged outcome remains unresolved after interruption or process loss.

For streams, pass the emitter from [`Emitter.toStream`](./src/Emitter.ts) to `runWithEvents`. The bridge uses an unbounded queue, so queue insertion is neither durable storage nor backpressure. Stopping consumption interrupts the producer and waits for finalization.

See [`Evaluation`](./src/Evaluation.ts) for event types and termination semantics, and [recorded evaluation](./examples/recorded-evaluation.ts) for an awaited recording and checkpoint replay. **Local interruption does not prove remote cancellation or authorize retrying external work.**

## Record and replay events

[`StudyStorage`](./src/StudyStorage.ts) records events under caller-owned schemas and a definition identity. The same interface supports memory and filesystem storage. Both encode writes and decode reads, retaining the codecs' service requirements.

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

Replay reduces stored evidence without executing the evaluator. Checkpoints must contain state reduced through their stated cursor; the latest **written** checkpoint wins, even if its cursor is lower. Retain event history and coordinate checkpoint writers. Filesystem recording requires one owning service per location and does not promise fsync or cross-process locking.

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

[`Artifact`](./src/Artifact.ts) composes these schemas; it does not authenticate producers. [`ArtifactContext`](./src/ArtifactContext.ts) allocates identities and [`ArtifactSink`](./src/ArtifactSink.ts) delivers encoded artifacts. Retain the allocated identity when retrying delivery. Allocation and delivery are separate operations, and fanout does not make independent sinks atomic.

Use [artifact persistence](./examples/artifact-persistence.ts) for transformed payload codecs, delivery, and checkpoints. [`Journal`](./src/Journal.ts) supplies lower-level JSON-lines persistence when no run recording is needed.

## Lifecycle and examples

[`Study`](./src/Study.ts) owns scoped lifecycle and trial history. [`Stop`](./src/Stop.ts) supplies cooperative stop decisions; [`Lifecycle`](./src/Lifecycle.ts) describes valid transitions. These are useful when building a runner, rather than evaluating a fixed batch with `Evaluation`.

Run the [examples](./examples/) from a repository checkout with `bun packages/effect-study/examples/<file>.ts`. They use local data and need no provider credentials:

- [evaluation](./examples/evaluation.ts): evaluation and schema-encoded observations.
- [structured evaluation](./examples/structured-evaluation.ts): caller grading, typed failure, and missing costs.
- [recorded evaluation](./examples/recorded-evaluation.ts): observer failure, checkpoints, and reopening a recording.
- [artifact persistence](./examples/artifact-persistence.ts): payload codecs and delivery.

See the [public API](./src/index.ts) for all modules and the [changelog](./CHANGELOG.md) when upgrading. This package is pre-1.0; minor releases may change APIs.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
