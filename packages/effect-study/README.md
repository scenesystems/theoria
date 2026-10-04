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

`History` keeps the latest record for each trial number in an Effect `HashMap`; `History.values` returns records sorted by trial number. Replacing a record replaces its cost contribution rather than charging it twice. Absent, negative, and non-finite costs in trusted in-memory records contribute zero. Trial and event codecs require finite numerical metadata. Applications choose cost units.

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

`Journal.make(schema, directory, fileName)` creates a schema-driven JSON-lines journal. Appends through one journal instance are serialized, including encoding. Reads preserve physical order, skip blank lines, treat missing files as empty, and fail with `Journal.Failure` on malformed or torn records. Decoding errors include the one-based physical line number. Separate instances do not share a lock, and append completion does not promise an fsync or transaction.

`ArtifactContext` owns run identity and atomic artifact sequence allocation. `ArtifactSink` owns schema-encoded artifact delivery, including filesystem journals and ordered fanout. These abstractions are generic: producers supply the artifact schema and retain its codec environment.

`StudyStorage` similarly owns generic trial logs and latest snapshots. Both its memory and filesystem implementations schema-encode every write and schema-decode every read, preserving codec service requirements and reporting write and read failures separately. Its journal contains tagged `Trial` and `Snapshot` records with caller-encoded payloads. `effect-search` specializes this service with its optimization schemas.

Codecs carry independent decoding and encoding requirements: reads require only decoding services, writes only encoding services. `yield* StudyStorage.makeMemory` allocates fresh storage on each execution. `StudyStorage.layerMemory` and `ArtifactContext.layer(options)` allocate fresh state for each provision, including provisions within one scope. Provide once around all operations that belong to the same run; reuse the acquired service explicitly when sharing state is intended.

## Emitters and lifecycle

`Emitter.toStream` runs a producer in a scoped fiber backed by Effect's completion-aware `Queue`. Buffered events drain before success, typed failure, or defect reaches the consumer. Ending consumption interrupts the producer and waits for finalization. The queue is unbounded; this bridge does not provide backpressure.

`Stop` stores requests in a native `Ref`, with deterministic precedence by trial number, then interrupt mode, then reason. Heartbeats are cooperative: they return decisions rather than interrupt fibers. `Stop.matchDecision` exhaustively handles their `Continue` and `Stop` variants. `Lifecycle.canTransition` validates transitions without owning mutable state and supports both receiver-first and pipeable use.

`Study` owns the lifecycle and trial history as one serialized, observable snapshot. `Study.modify` commits and publishes only a successful complete snapshot; transaction failure or interruption leaves the prior snapshot intact and releases the serializer. A callback that returns an illegal lifecycle change violates a programmer invariant, so `modify` dies with a diagnostic before committing any lifecycle or history change. It does not broaden the typed error channel. Use `Study.transition` for lifecycle requests: invalid requests remain no-ops, terminal studies never reopen, and closing the owning scope cancels a created, running, or paused study.

`StudyEvent` owns domain-generic schema factories for reservations, outcomes, retries, cancellation, cost, stop requests, and completion. Callers provide config, observation, failure, cancellation-reason, and completion-reason schemas rather than inheriting a numeric search vocabulary.

## Relationship to search and other packages

`effect-search` can specialize these schemas and operations for numeric objectives while retaining its own snapshot format, producer vocabulary, storage service, and error types. Fixed-input consumers can use `Evaluation` without a search-space abstraction.

Import this package directly for new evaluation or artifact consumers that do not need optimization. No search-space or numeric-objective placeholder is required.

## Public modules

- `Trial`: schema-composed records and outcomes.
- `Evaluation`: fixed-input evaluation.
- `History`: ordered trial history and cost accounting.
- `Lifecycle`: legal phase transitions.
- `Stop`: deterministic cooperative stop requests.
- `Emitter`: scoped producer-to-stream composition.
- `Artifact`: identities, provenance, relations, and envelope schemas.
- `ArtifactContext`: run provenance and atomic artifact identity allocation.
- `ArtifactSink`: schema-owned artifact delivery and persistence.
- `Journal`: schema-driven filesystem persistence.
- `Study`: scoped transactional lifecycle and history ownership.
- `StudyEvent`: generic lifecycle event schema factories.
- `StudyStorage`: schema-parameterized trial logs and snapshots.
