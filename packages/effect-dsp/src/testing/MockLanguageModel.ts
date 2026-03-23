/**
 * Deterministic `LanguageModel` test harness — fixed, mapped, sequenced, and
 * failing response strategies for unit tests.
 *
 * @since 0.0.0
 */
import * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import type * as Prompt from "@effect/ai/Prompt"
import * as Response from "@effect/ai/Response"
import {
  Array as Arr,
  Data,
  Effect,
  Layer,
  Match,
  Option,
  Order,
  Predicate,
  Record as Rec,
  Ref,
  Schema,
  Stream
} from "effect"

const MethodSchema = Schema.Literal("generateText", "generateObject")
type Method = typeof MethodSchema.Type

const mockError = (method: string, description: string, cause?: unknown): AiError.UnknownError =>
  new AiError.UnknownError({
    module: "MockLanguageModel",
    method,
    description,
    ...Option.match(Option.fromNullable(cause), {
      onNone: () => ({}),
      onSome: (value) => ({ cause: value })
    })
  })

/**
 * A recorded method call against the mock language model — captures the method
 * (`generateText` or `generateObject`) and the rendered prompt text.
 *
 * @since 0.0.0
 * @category models
 */
export class MockCall extends Schema.Class<MockCall>("MockCall")({
  method: MethodSchema,
  prompt: Schema.String
}) {}

/**
 * Strategy variants that determine how the mock model responds.
 *
 * @since 0.0.0
 * @category models
 */
class FixedResponseStrategy extends Data.TaggedClass("Fixed")<{
  readonly response: unknown
}> {}

class MappedResponseStrategy extends Data.TaggedClass("Map")<{
  readonly resolve: (prompt: string) => unknown
}> {}

class SequenceResponseStrategy extends Data.TaggedClass("Sequence")<{
  readonly responses: ReadonlyArray<unknown>
}> {}

class FunctionResponseStrategy extends Data.TaggedClass("Function")<{
  readonly resolve: (prompt: string) => Effect.Effect<unknown, unknown, never>
}> {}

class FailingResponseStrategy extends Data.TaggedClass("Failing")<{
  readonly error: unknown
}> {}

/**
 * Discriminated union of response strategies that determine mock behavior. Each
 * variant controls how the mock resolves a prompt to a response.
 *
 * @since 0.0.0
 * @category models
 */
export type ResponseStrategy =
  | FixedResponseStrategy
  | MappedResponseStrategy
  | SequenceResponseStrategy
  | FunctionResponseStrategy
  | FailingResponseStrategy

/**
 * Tagged-enum constructors for response strategy variants.
 *
 * @since 0.0.0
 * @category constructors
 */
export const ResponseStrategy = Data.taggedEnum<ResponseStrategy>()

/**
 * Runtime handle returned by `MockLanguageModel.make` — provides the mock
 * service and a ref of recorded calls for assertions.
 *
 * @since 0.0.0
 * @category models
 */
export class MockLanguageModelRuntime extends Data.TaggedClass("MockLanguageModelRuntime")<{
  readonly service: LanguageModel.Service
  readonly calls: Ref.Ref<ReadonlyArray<MockCall>>
}> {}

const isTextPart = (candidate: unknown): candidate is { readonly type: "text"; readonly text: string } =>
  Predicate.hasProperty(candidate, "type") &&
  candidate.type === "text" &&
  Predicate.hasProperty(candidate, "text") &&
  Predicate.isString(candidate.text)

const hasContentProperty = (candidate: unknown): candidate is { readonly content: unknown } =>
  Predicate.hasProperty(candidate, "content")

const hasContentArray = (candidate: unknown): candidate is { readonly content: ReadonlyArray<unknown> } =>
  Predicate.hasProperty(candidate, "content") && Arr.isArray(candidate.content)

const textFromUnknown = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isNumber, (numberValue) => String(numberValue)),
    Match.when(Predicate.isBoolean, (booleanValue) => String(booleanValue)),
    Match.orElse(() => "[non-text-response]")
  )

const textFromPart = (part: unknown): Option.Option<string> =>
  Match.value(part).pipe(
    Match.when(isTextPart, (candidate) => Option.some(candidate.text)),
    Match.orElse(() => Option.none<string>())
  )

const textFromMessageContent = (content: unknown): string =>
  Match.value(content).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Arr.isArray, (parts) => Arr.join(Arr.filterMap(parts, textFromPart), "\n")),
    Match.orElse(() => "")
  )

const messageContent = (message: unknown): Option.Option<unknown> =>
  Match.value(message).pipe(
    Match.when(hasContentProperty, (candidate) => Option.some(candidate.content)),
    Match.orElse(() => Option.none<unknown>())
  )

const textFromMessages = (messages: ReadonlyArray<unknown>): string =>
  Arr.join(
    Arr.filterMap(messages, (message) => Option.map(messageContent(message), textFromMessageContent)),
    "\n\n"
  )

const textFromPromptEnvelope = (prompt: Prompt.RawInput): Option.Option<string> =>
  Match.value(prompt).pipe(
    Match.when(hasContentArray, (candidate) => Option.some(textFromMessages(candidate.content))),
    Match.orElse(() => Option.none<string>())
  )

const textFromPromptIterable = (prompt: unknown): Option.Option<string> =>
  Match.value(prompt).pipe(
    Match.when(Predicate.isIterable, (iterablePrompt) =>
      Option.some(textFromMessages(Arr.fromIterable<unknown>(iterablePrompt)))),
    Match.orElse(() =>
      Option.none<string>()
    )
  )

const promptToText = (prompt: Prompt.RawInput): string =>
  Match.value(prompt).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.orElse((rawPrompt) =>
      Option.match(textFromPromptEnvelope(rawPrompt), {
        onSome: (text) => text,
        onNone: () =>
          Option.match(textFromPromptIterable(rawPrompt), {
            onSome: (text) => text,
            onNone: () => ""
          })
      })
    )
  )

const appendCall = (
  calls: Ref.Ref<ReadonlyArray<MockCall>>,
  method: Method,
  prompt: string
): Effect.Effect<void> => Ref.update(calls, (entries) => Arr.append(entries, new MockCall({ method, prompt })))

const resolveSequenceResponse = (
  responses: ReadonlyArray<unknown>,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<unknown, AiError.UnknownError> =>
  Effect.gen(function*() {
    const index = yield* Ref.get(sequenceIndex)

    const resolvedIndex = Match.value(responses.length).pipe(
      Match.when((length) => length === 0, () => 0),
      Match.orElse(() =>
        Match.value(index).pipe(
          Match.when((current) => current < responses.length, () => index),
          Match.orElse(() => responses.length - 1)
        )
      )
    )

    const response = Arr.get(responses, resolvedIndex)

    yield* Ref.update(sequenceIndex, (current) => current + 1)

    return yield* Option.match(response, {
      onSome: (value) => Effect.succeed(value),
      onNone: () =>
        Effect.fail(
          mockError(
            "sequence",
            "MockLanguageModel.sequence requires at least one response"
          )
        )
    })
  })

const resolveStrategyResponse = (
  strategy: ResponseStrategy,
  prompt: string,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<unknown, AiError.UnknownError> =>
  ResponseStrategy.$match({
    Fixed: ({ response }) => Effect.succeed(response),
    Map: ({ resolve }) =>
      Effect.try({
        try: () => resolve(prompt),
        catch: (cause) =>
          mockError(
            "map",
            "MockLanguageModel.map strategy threw while resolving a response",
            cause
          )
      }),
    Sequence: ({ responses }) => resolveSequenceResponse(responses, sequenceIndex),
    Function: ({ resolve }) =>
      resolve(prompt).pipe(
        Effect.mapError((cause) =>
          mockError(
            "fromFunction",
            "MockLanguageModel.fromFunction strategy failed while resolving a response",
            cause
          )
        )
      ),
    Failing: ({ error }) =>
      Effect.fail(
        mockError(
          "failing",
          "MockLanguageModel.failing strategy requested an expected failure",
          error
        )
      )
  })(strategy)

const escapeJsonString = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\b", "\\b")
    .replaceAll("\f", "\\f")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t")

const encodeJsonArray = (values: ReadonlyArray<unknown>): Option.Option<string> =>
  Option.map(
    Arr.reduce(
      values,
      Option.some(Arr.empty<string>()),
      (encodedValuesOption, value) =>
        Option.flatMap(encodedValuesOption, (encodedValues) =>
          Option.map(encodeJsonValue(value), (encodedValue) => Arr.append(encodedValues, encodedValue)))
    ),
    (encodedValues) =>
      `[${Arr.join(encodedValues, ",")}]`
  )

const encodeJsonRecord = (record: Readonly<Record<string, unknown>>): Option.Option<string> => {
  const sortedKeys = Arr.sort(Rec.keys(record), Order.string)

  const encodedEntriesOption = Arr.reduce(
    sortedKeys,
    Option.some(Arr.empty<string>()),
    (encodedEntriesState, key) =>
      Option.flatMap(
        encodedEntriesState,
        (encodedEntries) =>
          Option.map(encodeJsonValue(record[key]), (encodedValue) =>
            Arr.append(encodedEntries, `"${escapeJsonString(key)}":${encodedValue}`))
      )
  )

  return Option.map(encodedEntriesOption, (encodedEntries) => `{${Arr.join(encodedEntries, ",")}}`)
}

const encodeJsonValue = (value: unknown): Option.Option<string> =>
  Match.value(value).pipe(
    Match.when((candidate: unknown) => candidate === null, () => Option.some("null")),
    Match.when(Predicate.isString, (text) => Option.some(`"${escapeJsonString(text)}"`)),
    Match.when(
      (candidate: unknown) => Predicate.isNumber(candidate) && Number.isFinite(candidate),
      (numberValue) => Option.some(String(numberValue))
    ),
    Match.when(Predicate.isBoolean, (booleanValue) => Option.some(String(booleanValue))),
    Match.when(Arr.isArray, encodeJsonArray),
    Match.when(Predicate.isRecord, encodeJsonRecord),
    Match.orElse(() => Option.none<string>())
  )

const toProviderText = (
  response: unknown,
  responseFormat: LanguageModel.ProviderOptions["responseFormat"]
): Effect.Effect<string, AiError.UnknownError> =>
  Effect.if(responseFormat.type === "json", {
    onTrue: () =>
      Option.match(encodeJsonValue(response), {
        onSome: (encoded) => Effect.succeed(encoded),
        onNone: () =>
          Effect.fail(
            mockError(
              "generateObject",
              "MockLanguageModel could not encode strategy output as deterministic JSON"
            )
          )
      }),
    onFalse: () => Effect.succeed(textFromUnknown(response))
  })

const makeUsage = (): Response.Usage =>
  new Response.Usage({
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    reasoningTokens: undefined,
    cachedInputTokens: undefined
  })

const makeProviderResponse = (text: string): Array<Response.PartEncoded> =>
  Arr.make(
    Response.textPart({ text, metadata: {} }),
    Response.finishPart({
      reason: "stop",
      usage: makeUsage(),
      metadata: {}
    })
  )

const isResponsePartEncoded = (candidate: unknown): candidate is Response.PartEncoded =>
  Predicate.hasProperty(candidate, "type") && Predicate.isString(candidate.type)

const isProviderResponsePayload = (candidate: unknown): candidate is ReadonlyArray<Response.PartEncoded> =>
  Arr.isArray(candidate) && Arr.every(candidate, isResponsePartEncoded)

const ensureProviderFinishPart = (
  payload: ReadonlyArray<Response.PartEncoded>
): Array<Response.PartEncoded> =>
  Option.match(Arr.findFirst(payload, (part) => part.type === "finish"), {
    onSome: () => Arr.fromIterable(payload),
    onNone: () =>
      Arr.append(
        Arr.fromIterable(payload),
        Response.finishPart({
          reason: "stop",
          usage: makeUsage(),
          metadata: {}
        })
      )
  })

const makeService = (
  strategy: ResponseStrategy,
  calls: Ref.Ref<ReadonlyArray<MockCall>>,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<LanguageModel.Service> =>
  LanguageModel.make({
    generateText: (options) =>
      Effect.gen(function*() {
        const prompt = promptToText(options.prompt)
        const strategyResponse = yield* resolveStrategyResponse(strategy, prompt, sequenceIndex)
        const method: Method = options.responseFormat.type === "json" ? "generateObject" : "generateText"

        const providerResponse = yield* Match.value(strategyResponse).pipe(
          Match.when(
            isProviderResponsePayload,
            (payload) => Effect.succeed(ensureProviderFinishPart(payload))
          ),
          Match.orElse((response) =>
            toProviderText(response, options.responseFormat).pipe(
              Effect.map(makeProviderResponse)
            )
          )
        )

        yield* appendCall(calls, method, prompt)

        return providerResponse
      }),
    streamText: (_options) => Stream.empty
  })

/**
 * Public API for creating deterministic `LanguageModel` test services.
 *
 * @example
 * ```ts
 * import { MockLanguageModel } from "effect-dsp/testing"
 * import * as LanguageModel from "@effect/ai/LanguageModel"
 * import { Effect, Layer } from "effect"
 *
 * const testLayer = MockLanguageModel.layer(
 *   LanguageModel.LanguageModel,
 *   MockLanguageModel.fixed({ answer: "Paris" })
 * )
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const MockLanguageModel = {
  fixed: (response: unknown): ResponseStrategy => ResponseStrategy.Fixed({ response }),
  map: (resolve: (prompt: string) => unknown): ResponseStrategy => ResponseStrategy.Map({ resolve }),
  sequence: (responses: ReadonlyArray<unknown>): ResponseStrategy => ResponseStrategy.Sequence({ responses }),
  fromFunction: (
    resolve: (prompt: string) => Effect.Effect<unknown, unknown, never>
  ): ResponseStrategy => ResponseStrategy.Function({ resolve }),
  failing: (error: unknown): ResponseStrategy => ResponseStrategy.Failing({ error }),
  make: (strategy: ResponseStrategy): Effect.Effect<MockLanguageModelRuntime> =>
    Effect.gen(function*() {
      const calls = yield* Ref.make<ReadonlyArray<MockCall>>([])
      const sequenceIndex = yield* Ref.make(0)
      const service = yield* makeService(strategy, calls, sequenceIndex)

      return new MockLanguageModelRuntime({
        service,
        calls
      })
    }),
  layer: (
    tag: typeof LanguageModel.LanguageModel,
    strategy: ResponseStrategy
  ) =>
    Layer.effect(
      tag,
      MockLanguageModel.make(strategy).pipe(
        Effect.map((runtime) => runtime.service)
      )
    )
}
