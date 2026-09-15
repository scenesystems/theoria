/** Fixed-input evaluation with a persistent, schema-encoded observation log. */
import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Evaluation, Journal, Trial } from "@scenesystems/effect-study"
import { Array as Arr, Effect, Schema, Stream, String as Str } from "effect"

const Observation = Schema.Struct({ normalized: Schema.String })
const CompletedTrial = Trial.makeSchema(Schema.String, Trial.Completed(Observation))

const program = Effect.scoped(
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-study-example-" })
    const journal = yield* Journal.make(CompletedTrial, directory, "observations.jsonl")
    const trials = yield* Evaluation.run(
      Arr.make("first sample", "second sample"),
      (input) => Effect.succeed(Observation.make({ normalized: Str.toUpperCase(input) }))
    )
    yield* Effect.forEach(trials, journal.append, { discard: true })
    yield* journal.read.pipe(Stream.runForEach((trial) => Effect.log(trial.state.value)))
  })
)

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
