import { describe, expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Effect, Match, Option, Record, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { TestConsole } from "effect/testing"
import { Example } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import * as Signature from "../../src/Signature.js"

const warning = "GEPA has no critic ModelBinder; reflection uses the caller's task LanguageModel and provider defaults"

const optimize = (configure: "taskOnly" | "binder" | "proposer") =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "a" }))
    const options = new GEPA.Options({
      module,
      trainset: [new Example({ input: { question: "q" }, labels: Option.some({ answer: "a" }) })],
      metric: Metric.withFeedback(() => Effect.succeed(new Metric.Score({ value: 0, feedback: Option.some("retry") }))),
      maxMetricCalls: 1,
      ...Match.value(configure).pipe(
        Match.when("proposer", () => ({ instructionProposer: () => Effect.succeed(Record.empty<string, string>()) })),
        Match.orElse(() => ({}))
      )
    })
    yield* GEPA.run(options).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service),
      ModelBinder.withBinder(
        Match.value(configure).pipe(
          Match.when("binder", () => mock.binder),
          Match.orElse(() => ModelBinder.identity)
        )
      )
    )
    return Arr.filter(yield* TestConsole.logLines, (line) => line === warning)
  })

describe("GEPA critic fallback warning", () => {
  it.effect("warns once when reflection falls back to the task model", () =>
    Effect.map(optimize("taskOnly"), (lines) => expect(lines).toEqual([warning])))

  it.effect("does not warn when a critic binder is installed", () =>
    Effect.map(optimize("binder"), (lines) => expect(lines).toEqual([])))

  it.effect("does not warn when a custom instruction proposer replaces critic reflection", () =>
    Effect.map(optimize("proposer"), (lines) => expect(lines).toEqual([])))
})
