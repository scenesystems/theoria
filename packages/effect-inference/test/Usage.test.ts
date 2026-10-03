import { describe, expect, it } from "@effect/vitest"
import * as AiError from "effect/ai/AiError"
import * as IdGenerator from "effect/ai/IdGenerator"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import * as Arr from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Num from "effect/Number"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import * as Usage from "@scenesystems/effect-inference/Usage"

const usage = {
  inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
}

const finish: Response.FinishPartEncoded = {
  type: "finish",
  reason: "stop",
  usage,
  metadata: { provider: { requestId: "request-1", snapshot: "early" } }
}

const malformedText: Response.TextPartEncoded = {
  type: "text",
  text: "not-json"
}

const toolCall: Response.ToolCallPartEncoded = {
  type: "tool-call",
  id: "tool-call-1",
  name: "FailingTool",
  params: { query: "hello" },
  providerExecuted: false
}

const textDelta: Response.TextDeltaPartEncoded = {
  type: "text-delta",
  id: "text-1",
  delta: "hello"
}

class ToolFailure extends Schema.TaggedError<ToolFailure>()("ToolFailure", {
  message: Schema.String
}) {}

const FailingTool = Tool.make("FailingTool", {
  parameters: Schema.Struct({ query: Schema.String }),
  success: Schema.String,
  failure: ToolFailure,
  failureMode: "error"
})

describe("Usage.observe", () => {
  it.effect("observes canonical usage and original metadata before structured decoding", () =>
    Effect.gen(function*() {
      const observedUsage = yield* Ref.make(Option.none<Response.Usage>())
      const observedFinish = yield* Ref.make(Option.none<Response.FinishPartEncoded>())
      const generatedId = yield* Ref.make(Option.none<string>())
      const generator = yield* IdGenerator.make({
        alphabet: "x",
        prefix: "original",
        separator: "-",
        size: 1
      })
      const params = new Usage.ConstructorParams({
        generateText: () =>
          Effect.gen(function*() {
            const ids = yield* IdGenerator.IdGenerator
            const id = yield* ids.generateId()
            yield* Ref.set(generatedId, Option.some(id))
            return Arr.make(malformedText, finish)
          }),
        streamText: () => Stream.empty
      })
      const decorated = Usage.observe(params, (currentUsage, currentFinish) =>
        Ref.set(observedUsage, Option.some(currentUsage)).pipe(
          Effect.andThen(Ref.set(observedFinish, Option.some(currentFinish)))
        ))
      const model = yield* LanguageModel.make(decorated).pipe(
        Effect.provideService(IdGenerator.IdGenerator, generator)
      )
      const error = yield* model.generateObject({
        prompt: "Return an object",
        schema: Schema.Struct({ answer: Schema.String })
      }).pipe(Effect.flip)
      const currentUsage = Option.getOrThrow(yield* Ref.get(observedUsage))
      const currentFinish = Option.getOrThrow(yield* Ref.get(observedFinish))
      const currentId = Option.getOrThrow(yield* Ref.get(generatedId))

      expect(error).toBeInstanceOf(AiError.AiError)
      expect(currentUsage).toBeInstanceOf(Response.Usage)
      expect(currentUsage.inputTokens.total).toBe(17)
      expect(currentUsage.inputTokens.cacheRead).toBe(3)
      expect(currentUsage.outputTokens.text).toBe(5)
      expect(currentUsage.outputTokens.reasoning).toBe(7)
      expect(currentFinish).toBe(finish)
      expect(currentId).toBe("original-x")
    }))

  it.effect("preserves a native tool handler's typed failure after observing usage", () =>
    Effect.gen(function*() {
      const failure = new ToolFailure({ message: "expected tool failure" })
      const observations = yield* Ref.make(Arr.empty<Response.Usage>())
      const toolkit = Toolkit.make(FailingTool)
      const handledToolkit = yield* toolkit.pipe(
        Effect.provide(toolkit.toLayer({
          FailingTool: () => Effect.fail(failure)
        }))
      )
      const params = new Usage.ConstructorParams({
        generateText: () => Effect.succeed(Arr.make(toolCall, finish)),
        streamText: () => Stream.empty
      })
      const model = yield* LanguageModel.make(
        Usage.observe(
          params,
          (currentUsage) => Ref.update(observations, Arr.append(currentUsage))
        )
      )
      const error = yield* model.generateText({
        prompt: "Use the tool",
        toolkit: handledToolkit
      }).pipe(Effect.flip)
      const seen = yield* Ref.get(observations)

      expect(error).toBe(failure)
      expect(Arr.length(seen)).toBe(1)
      expect(Option.getOrThrow(Arr.head(seen))).toBeInstanceOf(Response.Usage)
    }))

  it.effect("preserves provider failures without inventing an observation", () =>
    Effect.gen(function*() {
      const providerFailure = new AiError.UnknownError({
        description: "expected provider failure"
      })
      const observations = yield* Ref.make(Arr.empty<Response.Usage>())
      const params = new Usage.ConstructorParams({
        generateText: () =>
          Effect.fail(new AiError.AiError({ module: "Test", method: "generateText", reason: providerFailure })),
        streamText: () =>
          Stream.fail(new AiError.AiError({ module: "Test", method: "streamText", reason: providerFailure }))
      })
      const model = yield* LanguageModel.make(
        Usage.observe(
          params,
          (currentUsage) => Ref.update(observations, Arr.append(currentUsage))
        )
      )
      const error = yield* model.generateText({ prompt: "hello" }).pipe(Effect.flip)
      const seen = yield* Ref.get(observations)

      expect(error.reason).toBe(providerFailure)
      expect(Arr.length(seen)).toBe(0)
    }))

  it.effect("observes an early stream finish lazily and preserves cancellation finalizers", () =>
    Effect.gen(function*() {
      const observations = yield* Ref.make(Arr.empty<Response.Usage>())
      const observedFinish = yield* Ref.make(Option.none<Response.FinishPartEncoded>())
      const finalized = yield* Ref.make(false)
      const delivered = yield* Ref.make(0)
      const observationStarted = yield* Deferred.make<void>()
      const blockedObservation = yield* Deferred.make<void>()
      const providerStream = Stream.fromIterable(
        Arr.make(textDelta, finish)
      ).pipe(
        Stream.rechunk(1),
        Stream.concat(Stream.never),
        Stream.ensuring(Ref.set(finalized, true))
      )
      const params = new Usage.ConstructorParams({
        generateText: () => Effect.succeed(Arr.of<Response.PartEncoded>(finish)),
        streamText: () => providerStream
      })
      const model = yield* LanguageModel.make(
        Usage.observe(
          params,
          (currentUsage, currentFinish) =>
            Ref.update(observations, Arr.append(currentUsage)).pipe(
              Effect.andThen(Ref.set(observedFinish, Option.some(currentFinish))),
              Effect.andThen(Deferred.succeed(observationStarted, undefined)),
              Effect.andThen(Deferred.await(blockedObservation))
            )
        )
      )
      const output = model.streamText({ prompt: "hello" }).pipe(
        Stream.tap(() => Ref.update(delivered, Num.increment)),
        Stream.runDrain
      )

      expect(Arr.length(yield* Ref.get(observations))).toBe(0)
      expect(yield* Ref.get(finalized)).toBe(false)

      const fiber = yield* Effect.forkChild(output)
      yield* Deferred.await(observationStarted)

      expect(yield* Ref.get(delivered)).toBe(1)

      yield* Fiber.interrupt(fiber)

      const seen = yield* Ref.get(observations)
      const currentFinish = Option.getOrThrow(yield* Ref.get(observedFinish))
      expect(Arr.length(seen)).toBe(1)
      expect(Option.getOrThrow(Arr.head(seen)).outputTokens.total).toBe(12)
      expect(currentFinish).toBe(finish)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))
})
