import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Layer, Record, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

import { fixture } from "../kit/Fixtures.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with short factual answers",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.chainOfThought DSPy parity", () => {
  it.effect("matches the DSPy reasoning-field and trace contracts", () =>
    Effect.gen(function*() {
      const reference = yield* fixture("predict-trace-001", "upstream-execution")
      const Output = Schema.Struct({ reasoning: Schema.String, answer: Schema.String })
      const payload = yield* Schema.decodeUnknownEffect(Schema.Struct({
        prediction: Output,
        trace: Schema.NonEmptyArray(Schema.Struct({
          inputs: Schema.Struct({ question: Schema.String }),
          outputs: Output
        }))
      }))(reference.payload)
      const sampleInput = Arr.headNonEmpty(payload.trace).inputs

      const qa = yield* makeQaSignature()
      const cot = yield* Module.chainOfThought("qa-cot-dspy-parity", qa)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(payload.prediction)
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const [result, entries] = yield* Trace.withTracing(
        cot.forward(sampleInput).pipe(
          Effect.provide(lmLayer)
        )
      )
      const firstEntry = yield* Effect.fromOption(Arr.head(entries))

      expect(Record.keys(cot.signature.outputFields)).toStrictEqual(Record.keys(payload.prediction))
      expect(result).toStrictEqual(payload.prediction)
      expect(entries).toHaveLength(Arr.length(payload.trace))
      expect(yield* decode(cot.signature.inputSchema, firstEntry.input)).toStrictEqual(
        sampleInput
      )
      expect(yield* decode(cot.signature.outputSchema, firstEntry.output)).toStrictEqual(
        Arr.headNonEmpty(payload.trace).outputs
      )
    }))
})
