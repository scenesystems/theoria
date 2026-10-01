import * as Generated from "@effect/ai-google/Generated"
import * as GoogleClient from "@effect/ai-google/GoogleClient"
import * as GoogleLanguageModel from "@effect/ai-google/GoogleLanguageModel"
import * as AiError from "@effect/ai/AiError"
import * as AiResponse from "@effect/ai/Response"
import * as HttpClient from "@effect/platform/HttpClient"
import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

import * as GoogleUsage from "@scenesystems/effect-inference/GoogleUsage"
import { encodeSse, jsonHttpClient, sseHttpClient } from "./fixtures/usage.js"

const model = "gemini-2.5-flash"

const request = {
  model,
  contents: Arr.make({ role: "user", parts: Arr.make({ text: "hello" }) })
}

const usageMetadata = {
  promptTokenCount: 17,
  candidatesTokenCount: 5,
  totalTokenCount: 29,
  thoughtsTokenCount: 7,
  cachedContentTokenCount: 3,
  toolUsePromptTokenCount: 11,
  promptTokensDetails: Arr.make({ modality: "TEXT", tokenCount: 17 }),
  cacheTokensDetails: Arr.make({ modality: "TEXT", tokenCount: 3 }),
  candidatesTokensDetails: Arr.make({ modality: "TEXT", tokenCount: 5 }),
  toolUsePromptTokensDetails: Arr.make({ modality: "TEXT", tokenCount: 11 })
}

const candidate = {
  index: 0,
  content: { role: "model", parts: Arr.make({ text: "not-json" }) },
  finishReason: "STOP"
}

const response = (metadata: unknown) => ({
  candidates: Arr.make(candidate),
  usageMetadata: metadata,
  modelVersion: model,
  responseId: "response-1"
})

const responseWithoutUsage = {
  candidates: Arr.make(candidate),
  modelVersion: model,
  responseId: "response-1"
}

const makeClient = (httpClient: HttpClient.HttpClient) =>
  GoogleClient.make({}).pipe(
    Effect.provideService(HttpClient.HttpClient, httpClient)
  )

describe("GoogleUsage.observe", () => {
  it.effect("observes all native counters and retains the original Google metadata", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const rawObserved = yield* Ref.make(Option.none<Generated.UsageMetadata>())
      const nativeClient = yield* makeClient(jsonHttpClient(response(usageMetadata)))
      const decorated = GoogleUsage.observe(
        nativeClient,
        (usage, raw) =>
          Ref.set(observed, Option.some(usage)).pipe(
            Effect.zipRight(Ref.set(rawObserved, raw))
          )
      )

      const result = yield* decorated.generateContent(request)
      const observedOption = yield* Ref.get(observed)
      const rawOption = yield* Ref.get(rawObserved)
      const observedUsage = yield* observedOption
      const raw = yield* rawOption

      expect(result.responseId).toBe("response-1")
      expect(raw).toBe(result.usageMetadata)
      expect(observedUsage.inputTokens).toBe(17)
      expect(observedUsage.outputTokens).toBe(5)
      expect(observedUsage.totalTokens).toBe(29)
      expect(Option.fromNullable(observedUsage.reasoningTokens)).toEqual(Option.some(7))
      expect(Option.fromNullable(observedUsage.cachedInputTokens)).toEqual(Option.some(3))
      expect(raw.toolUsePromptTokenCount).toBe(11)
      expect(raw.promptTokensDetails).toEqual(
        Arr.make(new Generated.ModalityTokenCount({ modality: "TEXT", tokenCount: 17 }))
      )
      expect(raw.toolUsePromptTokensDetails).toEqual(
        Arr.make(new Generated.ModalityTokenCount({ modality: "TEXT", tokenCount: 11 }))
      )
    })))

  it.effect("observes absent metadata as unknown and keeps null fields distinct from zeros", () =>
    Effect.scoped(Effect.gen(function*() {
      const absent = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const rawAbsent = yield* Ref.make(Arr.empty<Option.Option<Generated.UsageMetadata>>())
      const missingClient = yield* makeClient(jsonHttpClient(responseWithoutUsage))
      const nullClient = yield* makeClient(jsonHttpClient(response(null)))

      yield* GoogleUsage.observe(
        missingClient,
        (usage, raw) =>
          Ref.update(absent, Arr.append(usage)).pipe(Effect.zipRight(Ref.update(rawAbsent, Arr.append(raw))))
      ).generateContent(request)
      yield* GoogleUsage.observe(
        nullClient,
        (usage, raw) =>
          Ref.update(absent, Arr.append(usage)).pipe(Effect.zipRight(Ref.update(rawAbsent, Arr.append(raw))))
      ).generateContent(request)

      const nullableObserved = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nullableClient = yield* makeClient(jsonHttpClient(response({
        promptTokenCount: null,
        candidatesTokenCount: null,
        totalTokenCount: null,
        thoughtsTokenCount: null,
        cachedContentTokenCount: null
      })))
      yield* GoogleUsage.observe(
        nullableClient,
        (usage) => Ref.set(nullableObserved, Option.some(usage))
      ).generateContent(request)

      const zeroObserved = yield* Ref.make(Option.none<AiResponse.Usage>())
      const zeroClient = yield* makeClient(jsonHttpClient(response({
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
        thoughtsTokenCount: 0,
        cachedContentTokenCount: 0
      })))
      yield* GoogleUsage.observe(
        zeroClient,
        (usage) => Ref.set(zeroObserved, Option.some(usage))
      ).generateContent(request)

      const absentUsages = yield* Ref.get(absent)
      const absentReports = yield* Ref.get(rawAbsent)
      const nullableOption = yield* Ref.get(nullableObserved)
      const zeroOption = yield* Ref.get(zeroObserved)
      const nullableUsage = yield* nullableOption
      const zeroUsage = yield* zeroOption

      const unknownUsage = new AiResponse.Usage({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined
      })
      expect(absentUsages).toEqual(Arr.make(unknownUsage, unknownUsage))
      expect(absentReports).toEqual(Arr.make(Option.none(), Option.none()))
      expect(Option.fromNullable(nullableUsage.inputTokens)).toEqual(Option.none())
      expect(Option.fromNullable(nullableUsage.outputTokens)).toEqual(Option.none())
      expect(Option.fromNullable(nullableUsage.totalTokens)).toEqual(Option.none())
      expect(Option.fromNullable(nullableUsage.reasoningTokens)).toEqual(Option.none())
      expect(Option.fromNullable(nullableUsage.cachedInputTokens)).toEqual(Option.none())
      expect(Option.fromNullable(zeroUsage.inputTokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(zeroUsage.outputTokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(zeroUsage.totalTokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(zeroUsage.reasoningTokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(zeroUsage.cachedInputTokens)).toEqual(Option.some(0))
    })))

  it.effect("observes every cumulative stream snapshot without summing them", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make(
        {
          candidates: Arr.make({
            index: 0,
            content: { role: "model", parts: Arr.make({ text: "not-" }) }
          }),
          usageMetadata: {
            promptTokenCount: 17,
            candidatesTokenCount: 2,
            totalTokenCount: 19
          },
          responseId: "response-1"
        },
        {
          candidates: Arr.make(Struct.omit(candidate, "finishReason")),
          usageMetadata,
          responseId: "response-1"
        },
        responseWithoutUsage
      )
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const rawObserved = yield* Ref.make(Arr.empty<Option.Option<Generated.UsageMetadata>>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = GoogleUsage.observe(
        nativeClient,
        (usage, raw) =>
          Ref.update(observed, Arr.append(usage)).pipe(
            Effect.zipRight(Ref.update(rawObserved, Arr.append(raw)))
          )
      )

      const chunks = yield* decorated.generateContentStream(request).pipe(Stream.runCollect)
      const usages = yield* Ref.get(observed)
      const rawUsages = yield* Ref.get(rawObserved)
      const first = yield* Arr.head(usages)
      const latest = yield* Arr.last(usages)
      const firstRaw = yield* Arr.head(rawUsages).pipe(Option.flatten)
      const firstChunk = yield* Chunk.head(chunks)

      expect(Chunk.size(chunks)).toBe(3)
      expect(Arr.length(usages)).toBe(2)
      expect(first.outputTokens).toBe(2)
      expect(first.totalTokens).toBe(19)
      expect(latest.outputTokens).toBe(5)
      expect(latest.totalTokens).toBe(29)
      expect(firstRaw).toBe(firstChunk.usageMetadata)
    })))

  it.effect("retains observations when a consumer cancels after an early snapshot", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make(
        {
          candidates: Arr.make({
            index: 0,
            content: { role: "model", parts: Arr.make({ text: "early" }) }
          }),
          usageMetadata: {
            promptTokenCount: 0,
            candidatesTokenCount: 0,
            totalTokenCount: 0,
            thoughtsTokenCount: 0,
            cachedContentTokenCount: 0
          }
        },
        { candidates: Arr.make(candidate), usageMetadata }
      )
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = GoogleUsage.observe(
        nativeClient,
        (usage) => Ref.update(observed, Arr.append(usage))
      )

      const chunks = yield* decorated.generateContentStream(request).pipe(
        Stream.take(1),
        Stream.runCollect
      )
      const usages = yield* Ref.get(observed)
      const usage = yield* Arr.head(usages)

      expect(Chunk.size(chunks)).toBe(1)
      expect(Arr.length(usages)).toBe(1)
      expect(usage.inputTokens).toBe(0)
      expect(usage.outputTokens).toBe(0)
      expect(usage.totalTokens).toBe(0)
    })))

  it.effect("retains received observations when the provider stream later fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make({
        candidates: Arr.make({
          index: 0,
          content: { role: "model", parts: Arr.make({ text: "early" }) }
        }),
        usageMetadata: { promptTokenCount: 17, candidatesTokenCount: 2 }
      })
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const failure = new AiError.MalformedOutput({
        module: "GoogleClient",
        method: "generateContentStream",
        description: "later provider stream failure"
      })
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const failingClient = Struct.evolve(nativeClient, {
        generateContentStream: (
          generateContentStream: GoogleClient.Service["generateContentStream"]
        ): GoogleClient.Service["generateContentStream"] =>
        (request) =>
          generateContentStream(request).pipe(
            Stream.concat(Stream.fail(failure))
          )
      })
      const decorated = GoogleUsage.observe(
        failingClient,
        (usage) => Ref.update(observed, Arr.append(usage))
      )

      const receivedFailure = yield* decorated.generateContentStream(request).pipe(
        Stream.runDrain,
        Effect.flip
      )
      const usages = yield* Ref.get(observed)
      const usage = yield* Arr.head(usages)

      expect(receivedFailure).toBe(failure)
      expect(Arr.length(usages)).toBe(1)
      expect(usage.inputTokens).toBe(17)
      expect(usage.outputTokens).toBe(2)
      expect(Option.fromNullable(usage.totalTokens)).toEqual(Option.none())
    })))

  it.effect("observes usage before downstream structured parsing fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nativeClient = yield* makeClient(jsonHttpClient(response(usageMetadata)))
      const decorated = GoogleUsage.observe(
        nativeClient,
        (usage) => Ref.set(observed, Option.some(usage))
      )
      const languageModel = yield* GoogleLanguageModel.make({ model }).pipe(
        Effect.provideService(GoogleClient.GoogleClient, decorated)
      )

      const failure = yield* languageModel.generateObject({
        prompt: "Return an object",
        schema: Schema.Struct({ answer: Schema.String })
      }).pipe(Effect.flip)
      const observedOption = yield* Ref.get(observed)
      const usage = yield* observedOption

      expect(failure).toBeInstanceOf(AiError.MalformedOutput)
      expect(usage.inputTokens).toBe(17)
      expect(usage.outputTokens).toBe(5)
      expect(usage.totalTokens).toBe(29)
    })))
})
