# @scenesystems/effect-study

Reusable trial evaluation, history, stopping, event streams, and artifact persistence for [Effect](https://effect.website). Use it when inputs are already known and observations need not be numeric scores. Search spaces, samplers, objective ranking, and pruning belong to [`@scenesystems/effect-search`](../effect-search/README.md).

## Installation

```sh
npm install @scenesystems/effect-study effect @effect/platform
```

Effect `^3.22.1` and `@effect/platform ^0.97.1` are required peers. Filesystem persistence requires platform services; use `@effect/platform-bun` for Bun applications. The package has no dependency on `effect-search`.

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

`History` keeps the latest record for each trial number in a native `SortedMap`. Replacing a record replaces its cost contribution rather than charging it twice. Absent, negative, and non-finite costs contribute zero. Applications choose cost units.

## Schemas and persistence

`Trial.makeSchema(config, state)` composes caller-owned input and state schemas. `Trial.Completed(value)` and `Trial.Failed(error)` support structured observations and typed failures. Encoded forms and schema service requirements are preserved.

`Artifacts` supplies shared run IDs, artifact IDs, source references, lineage, relations, and envelope schema factories. Origins and payload vocabularies are chosen by the consumer. Envelopes describe provenance; they do not authenticate a producer or verify a content digest.

`Journal.make(schema, directory, fileName)` creates a schema-driven JSON-lines journal. Appends through one journal instance are serialized, including encoding. Reads preserve physical order, skip blank lines, treat missing files as empty, and fail with `JournalError` on malformed or torn records. Decoding errors include the one-based physical line number. Separate instances do not share a lock, and append completion does not promise an fsync or transaction.

## Events and lifecycle

`Events.streamFromEmitter` runs a producer in a scoped fiber. Buffered events drain before success, typed failure, or defect reaches the consumer. Ending consumption interrupts the producer and waits for finalization. The mailbox is unbounded; this bridge does not provide backpressure.

`Stop` stores requests in a native `Ref`, with deterministic precedence by trial number, then interrupt mode, then reason. Heartbeats are cooperative: they return decisions rather than interrupt fibers. `Lifecycle.canTransitionLifecycle` validates transitions without owning mutable state.

## Relationship to search and other packages

Existing search entrypoints remain available. `effect-search` specializes these schemas and operations for numeric objectives and retains its snapshot format, producer vocabulary, storage service, and error types. DSP optimizer streams use `Events` directly. Text calibration uses `Evaluation` for fixed-profile evaluation and still uses `effect-search` when fitting profiles.

Import this package directly for new evaluation or artifact consumers that do not need optimization. No search-space or numeric-objective placeholder is required.

## Public modules

- `Trial`: schema-composed records and outcomes.
- `Evaluation`: fixed-input evaluation.
- `History`: ordered trial history and cost accounting.
- `Lifecycle`: legal phase transitions.
- `Stop`: deterministic cooperative stop requests.
- `Events`: scoped producer-to-stream composition.
- `Artifacts`: identities, provenance, relations, and envelope schemas.
- `Journal`: schema-driven filesystem persistence.
