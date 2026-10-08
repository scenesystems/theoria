import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

import { fixture } from "../kit/Fixtures.js"

const Output = Schema.Struct({ reasoning: Schema.String, answer: Schema.String })
const Message = Schema.Struct({ role: Schema.Literals(["system", "user"]), content: Schema.String })
const Reference = Schema.Struct({
  prediction: Output,
  trace: Schema.NonEmptyArray(Schema.Struct({ inputs: Schema.Struct({ question: Schema.String }), outputs: Output })),
  history: Schema.NonEmptyArray(Schema.Struct({
    messages: Schema.Tuple([Message, Message]),
    response: Schema.NonEmptyArray(Schema.String)
  })),
  state: Schema.Struct({
    predict: Schema.Struct({
      demos: Schema.Array(Schema.Unknown),
      signature: Schema.Struct({
        fields: Schema.NonEmptyArray(Schema.Struct({ prefix: Schema.String, description: Schema.String }))
      })
    })
  })
})

/** "1. `reasoning` (str): \n2. `answer` (str):" in the upstream system turn's output section. */
const upstreamOutputFields = (system: string) =>
  Effect.fromOption(Arr.get(Str.split(system, "Your output fields are:\n"), 1)).pipe(
    Effect.flatMap((rest) => Effect.fromOption(Arr.head(Str.split(rest, "All interactions")))),
    Effect.map((section) =>
      Arr.map(
        Arr.fromIterable(Str.matchAll(/\d+\. `(\w+)`/g)(section)),
        (match) => Option.getOrThrow(Arr.get(match, 1))
      )
    )
  )

describe("Module.chainOfThought DSPy parity", () => {
  it.effect("predict-trace: reasoning-first fields, upstream user turn, parsed completion and trace", () =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Reference)(
        (yield* fixture("predict-trace", "upstream-execution")).payload
      )
      const upstream = Arr.headNonEmpty(reference.history)
      const [system, user] = upstream.messages
      const step = Arr.headNonEmpty(reference.trace)
      const qa = yield* Signature.make("", { question: Schema.String }, { answer: Schema.String })
      const cot = yield* Module.chainOfThought("qa", qa)

      // State: DSPy's ChainOfThought prepends Reasoning between the inputs and the original outputs.
      expect(Arr.map(cot.signature.fields, (field) => `${Str.capitalize(field.name)}:`)).toEqual(
        Arr.map(reference.state.predict.signature.fields, (field) => field.prefix)
      )
      expect(Record.keys(cot.signature.outputFields)).toEqual(yield* upstreamOutputFields(system.content))
      const parameters = yield* Effect.fromOption(Record.get(yield* ParameterSet.snapshot(cot), "qa"))
      expect(parameters.demos).toEqual(reference.state.predict.demos)

      // The pinned DummyLM completion is replayed as ChatAdapter text and must be parsed, not echoed.
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(Arr.headNonEmpty(upstream.response)))
      const [result, entries] = yield* Trace.withTracing(
        cot.forward(step.inputs).pipe(
          Module.withParameters({
            qa: new ModuleParameters({
              instructions: parameters.instructions,
              demos: parameters.demos,
              fields: parameters.fields,
              outputStrategy: "text"
            })
          }),
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      )
      expect(result).toStrictEqual(reference.prediction)

      // Prompt: the upstream user turn (input value and reasoning-then-answer response order) verbatim.
      const call = yield* Effect.fromOption(Arr.head(yield* Ref.get(mock.calls)))
      expect(call.method).toBe("generateText")
      expect(call.prompt).toContain(user.content)
      const reasoningAt = yield* Effect.fromOption(Str.indexOf("[[ ## reasoning ## ]]")(call.prompt))
      const answerAt = yield* Effect.fromOption(Str.indexOf("[[ ## answer ## ]]")(call.prompt))
      expect(reasoningAt).toBeLessThan(answerAt)

      // Trace: one selected predictor entry per upstream trace step, carrying the parsed fields.
      expect(entries).toHaveLength(Arr.length(reference.trace))
      const entry = yield* Effect.fromOption(Arr.head(entries))
      expect(entry.prompt).toBe(call.prompt)
      expect(entry.rawResponse).toBe(Arr.headNonEmpty(upstream.response))
      expect(yield* decode(cot.signature.inputSchema, entry.input)).toStrictEqual(step.inputs)
      expect(yield* decode(cot.signature.outputSchema, entry.output)).toStrictEqual(step.outputs)
    }))
})
