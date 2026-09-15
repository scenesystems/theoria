import * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Prompt from "@effect/ai/Prompt"
import * as Response from "@effect/ai/Response"
import * as Tool from "@effect/ai/Tool"
import * as Toolkit from "@effect/ai/Toolkit"
import { expect, expectTypeOf, it } from "@effect/vitest"
import type { DspError } from "@scenesystems/effect-dsp/Errors"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Boolean, Context, Effect, Equal, Number, Option, Ref, Schema, Stream } from "effect"

class RequestPolicy extends Context.Tag("react-native/RequestPolicy")<RequestPolicy, string>() {}
class ToolFailure extends Schema.TaggedError<ToolFailure>()("ToolFailure", { message: Schema.String }) {}

const usage = new Response.Usage({ inputTokens: 17, outputTokens: 5, totalTokens: 29 })

it.effect("preserves request dependencies, checked tool failures and early usage through composition", () =>
  Effect.gen(function*() {
    const tools = Toolkit.make(
      Tool.make("CheckPolicy", {
        parameters: { question: Schema.String },
        success: Schema.String,
        failure: ToolFailure,
        failureMode: "error"
      }).addDependency(RequestPolicy)
    )
    const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({
      CheckPolicy: () => Effect.flatMap(RequestPolicy, (message) => Effect.fail(new ToolFailure({ message })))
    })))
    const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
    const react = yield* Module.react({ name: "react-native", signature, toolkit })
    const composite = yield* Module.compose({
      name: "composite-native",
      signature,
      subModules: { react },
      forward: ({ input }) => react.forward(input)
    })
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.fromFunction(() =>
        Trace.observeUsage(usage).pipe(Effect.as(Arr.make(
          Response.toolCallPart({
            id: "tool-1",
            name: "CheckPolicy",
            params: { question: "Capital?" },
            providerExecuted: false
          }),
          Response.finishPart({ reason: "tool-calls", usage })
        )))
      )
    )
    const operation = composite.forward({ question: "Capital?" })
    expectTypeOf<Effect.Effect.Context<typeof operation>>().toEqualTypeOf<
      LanguageModel.LanguageModel | RequestPolicy
    >()
    expectTypeOf<Effect.Effect.Error<typeof operation>>().toEqualTypeOf<AiError.AiError | DspError | ToolFailure>()
    const [failure, calls] = yield* Trace.withCalls(operation.pipe(Effect.flip)).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service),
      Effect.provideService(RequestPolicy, "denied by request policy")
    )
    const decoded = yield* Schema.decodeUnknown(ToolFailure)(failure)
    const call = yield* Arr.head(calls)
    expect(decoded.message).toBe("denied by request policy")
    expect(call.outcome).toBe("failure")
    expect(call.usage).toEqual(Option.some(usage))
    expect(Arr.length(calls)).toBe(1)
  }))

class Facts extends Schema.Class<Facts>("Facts")({ population: Schema.NumberFromString, country: Schema.String }) {}
class LookupFailure extends Schema.TaggedError<LookupFailure>()("LookupFailure", {
  retryAfter: Schema.NumberFromString,
  message: Schema.String
}) {}

it.effect("continues with native encoded structured tool results and return-mode failures", () =>
  Effect.forEach(Arr.make(false, true), (fail) =>
    Effect.gen(function*() {
      const tools = Toolkit.make(Tool.make("LookupFacts", {
        parameters: { question: Schema.String },
        success: Facts,
        failure: LookupFailure,
        failureMode: "return"
      }))
      const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({
        LookupFacts: () =>
          Boolean.match(fail, {
            onTrue: () => Effect.fail(new LookupFailure({ retryAfter: 13, message: "temporarily unavailable" })),
            onFalse: () => Effect.succeed(new Facts({ population: 7, country: "France" }))
          })
      })))
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.react({
        name: Boolean.match(fail, { onTrue: () => "failed-tools", onFalse: () => "successful-tools" }),
        signature,
        toolkit,
        maxIterations: 2
      })
      const requests = yield* Ref.make(Arr.empty<Prompt.Prompt>())
      const counter = yield* Ref.make(0)
      const encode = Schema.encode(Schema.mutable(Schema.Array(Response.Part(tools))))
      const toolResponse = yield* encode(Arr.make(
        Response.toolCallPart({
          id: "lookup-1",
          name: "LookupFacts",
          params: { question: "Capital?" },
          providerExecuted: false
        }),
        Response.finishPart({ reason: "tool-calls", usage })
      ))
      const textResponse = yield* encode(Arr.make(
        Response.textPart({ text: "[[ ## answer ## ]]\nParis" }),
        Response.finishPart({ reason: "stop", usage })
      ))
      const model = yield* LanguageModel.make({
        generateText: (options) =>
          Effect.gen(function*() {
            yield* Ref.update(requests, Arr.append(options.prompt))
            const index = yield* Ref.getAndUpdate(counter, Number.increment)
            return yield* Effect.if(Equal.equals(index, 0), {
              onTrue: () => Effect.succeed(toolResponse),
              onFalse: () => Effect.succeed(textResponse)
            })
          }),
        streamText: () =>
          Stream.fail(
            new AiError.UnknownError({
              module: "test",
              method: "streamText",
              description: "Streaming is not part of this fixture"
            })
          )
      })
      const [output, entries] = yield* Trace.withTracing(module.forward({ question: "Capital?" })).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model)
      )
      const second = yield* Ref.get(requests).pipe(Effect.flatMap(Arr.get(1)))
      const message = yield* Arr.findFirst(second.content, Schema.is(Prompt.ToolMessage))
      const result = yield* Arr.head(message.content)
      const entry = yield* Arr.last(entries)
      expect(output.answer).toBe("Paris")
      expect(result.id).toBe("lookup-1")
      expect(result.name).toBe("LookupFacts")
      expect(result.isFailure).toBe(fail)
      expect(result.result).toEqual(Boolean.match(fail, {
        onTrue: () => ({ _tag: "LookupFailure", retryAfter: "13", message: "temporarily unavailable" }),
        onFalse: () => ({ population: "7", country: "France" })
      }))
      expect(entry.prompt).toContain(Boolean.match(fail, {
        onTrue: () => "temporarily unavailable",
        onFalse: () => "France"
      }))
    })))
