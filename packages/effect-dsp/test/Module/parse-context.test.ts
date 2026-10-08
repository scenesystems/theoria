/**
 * Every predictor strategy reports a parse failure with the actual target path,
 * encoded input, native prompt and raw model output.
 */
import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Ref, Schema } from "effect"
import * as AiError from "effect/ai/AiError"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import { ParseOutputError } from "../../src/DspError.js"
import { promptToTraceText } from "../../src/internal/prompt/trace.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import { decode } from "../../src/Payload.js"
import * as Signature from "../../src/Signature.js"
import { type RecordedRequest, recordingLm } from "../kit/Lm.js"

const signature = Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
const raw = "not a marked answer"

const Lookup = Tool.make("Lookup", {
  description: "Look up a fact",
  parameters: Schema.Struct({ query: Schema.String }),
  success: Schema.String
})

const failWith = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module.Module<I, O, E, R>,
  input: Schema.Schema.Type<Schema.Struct<I>>
) =>
  Effect.gen(function*() {
    const lm = yield* recordingLm(() => Effect.succeed([Response.TextPart.make({ text: raw, metadata: {} })]))
    const failure = yield* module.forward(input).pipe(Effect.provide(lm.layer), Effect.flip)
    const requests = Chunk.toReadonlyArray(yield* Ref.get(lm.requests))
    return { failure, requests }
  })

const expectContext = (
  failure: unknown,
  requests: ReadonlyArray<RecordedRequest>,
  path: string
) =>
  Effect.gen(function*() {
    expect(failure).toBeInstanceOf(ParseOutputError)
    const error = yield* Schema.decodeUnknownEffect(ParseOutputError)(failure)
    expect(error.rawOutput).toEqual(Option.some(raw))
    const context = Option.getOrThrow(Option.fromUndefinedOr(error.context))
    expect(context.predictorPath).toBe(path)
    expect(yield* decode(Schema.Struct({ question: Schema.String }), context.input)).toEqual({ question: "q" })
    const first = Option.getOrThrow(Arr.head(requests))
    expect(context.prompt).toBe(yield* promptToTraceText(first.prompt))
    return error
  })

const predictWith = (outputStrategy: ModuleParameters["outputStrategy"]) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* signature,
      new Module.PredictOptions({
        policy: new Module.PredictPolicyOverrides({ parse: new Module.ParsePolicyOverrides({ maxRetries: 0 }) })
      })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: module.signature.instructions, demos: [], outputStrategy })
    })
    return module
  })

it.effect("default auto with no demos resolves structured and reports the target parse context", () =>
  Effect.gen(function*() {
    const { failure, requests } = yield* failWith(yield* predictWith("auto"), { question: "q" })
    expect(requests).toHaveLength(1)
    expect(Option.getOrThrow(Arr.head(requests)).responseFormat.type).toBe("json")
    const error = yield* expectContext(failure, requests, "qa")
    expect(error.moduleName).toBe("qa")
    expect(error.retryCount).toEqual(Option.none())
  }))

it.effect("explicit structured and text strategies report the same target parse context", () =>
  Effect.gen(function*() {
    const structured = yield* failWith(yield* predictWith("structured"), { question: "q" })
    yield* expectContext(structured.failure, structured.requests, "qa")
    const text = yield* failWith(yield* predictWith("text"), { question: "q" })
    expect(Option.getOrThrow(Arr.head(text.requests)).responseFormat.type).toBe("text")
    yield* expectContext(text.failure, text.requests, "qa")
  }))

it.effect("an exhausted ReAct agent reports its target path, input, first prompt and last raw output", () =>
  Effect.gen(function*() {
    const tools = Toolkit.make(Lookup)
    const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({ Lookup: () => Effect.succeed("fact") })))
    const module = yield* Module.react(
      new Module.ReactOptions({ name: "agent", signature: yield* signature, toolkit, maxIterations: 2 })
    )
    const { failure, requests } = yield* failWith(module, { question: "q" })
    expect(requests).toHaveLength(2)
    const error = yield* expectContext(failure, requests, "agent")
    expect(error.retryCount).toEqual(Option.some(2))
  }))

it.effect("provider failures that are not output-format failures keep their AiError", () =>
  Effect.gen(function*() {
    const module = yield* predictWith("auto")
    const lm = yield* recordingLm(() =>
      Effect.fail(AiError.make({
        module: "test",
        method: "generateText",
        reason: new AiError.UnknownError({ description: "offline" })
      }))
    )
    const failure = yield* module.forward({ question: "q" }).pipe(Effect.provide(lm.layer), Effect.flip)
    expect(failure._tag).toBe("AiError")
  }))
