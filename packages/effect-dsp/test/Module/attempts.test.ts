import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Ref, Schedule, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"

describe("predictor attempt evidence", () => {
  it.effect("retains a rejected response and links all retries to the selected execution", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict(
        "qa",
        signature,
        new Module.PredictOptions({
          policy: new Module.PredictPolicyOverrides({
            parse: new Module.ParsePolicyOverrides({ maxRetries: 1, retrySchedule: () => Schedule.recurs(1) })
          })
        })
      )
      yield* Ref.update(
        module.parameters,
        (parameters) =>
          new ModuleParameters({
            instructions: parameters.instructions,
            demos: parameters.demos,
            outputStrategy: "text"
          })
      )
      const lm = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(["unparseable", "[[ ## answer ## ]]\nParis", "[[ ## answer ## ]]\nTokyo"])
      )
      const [first, second] = yield* Effect.all([
        Module.call(module, { question: "France?" }),
        Module.call(module, { question: "Japan?" })
      ]).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(first.output.answer).toBe("Paris")
      expect(first.usage.callCount).toBe(2)
      const attempts = Chunk.toReadonlyArray(first.trace.attempts)
      expect(attempts).toHaveLength(2)
      expect(attempts[0]?.rawResponse).toBe("unparseable")
      expect(Option.isSome(Option.getOrThrow(Chunk.head(first.trace.attempts)).parseError)).toBe(true)
      const selected = Option.getOrThrow(Chunk.head(first.trace.selected))
      expect(attempts[0]?.execution).toBe(selected.execution)
      expect(attempts[1]?.execution).toBe(selected.execution)
      expect(Option.getOrThrow(Chunk.head(second.trace.selected)).execution).not.toBe(selected.execution)
      expect(Chunk.size(first.trace.selected)).toBe(1)
    }))
})
