/**
 * Deterministic, in-memory `LanguageModel` test doubles.
 *
 * @since 0.1.0
 */
import * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Prompt from "@effect/ai/Prompt"
import * as Response from "@effect/ai/Response"
import * as Toolkit from "@effect/ai/Toolkit"
import { Array as Arr, Data, Effect, Layer, Match, Number, Option, Predicate, Ref, Schema, Stream } from "effect"
import { encodePayload } from "../contracts/Payload.js"

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
 * A completed generation call recorded by the mock.
 *
 * @remarks
 * `prompt` is the normalized text extracted from the provider prompt. Calls
 * whose strategy or response encoding fails are not recorded.
 *
 * @since 0.1.0
 * @category models
 */
export class MockCall extends Schema.Class<MockCall>("MockCall")({
  /** Language-model operation that completed successfully. */
  method: MethodSchema,
  /** Normalized prompt text received by the mock operation. */
  prompt: Schema.String
}) {}

const StrategyResponses = Schema.Array(Schema.Unknown)
type StrategyResponses = typeof StrategyResponses.Type

const SyncResolver = Schema.declare(
  (input): input is (prompt: string) => unknown => Predicate.isFunction(input)
)

const EffectResolver = Schema.declare(
  (input): input is (prompt: string) => Effect.Effect<unknown, unknown> => Predicate.isFunction(input)
)

const ResponseStrategySchema = Schema.Union(
  Schema.TaggedStruct("Fixed", { response: Schema.Unknown }),
  Schema.TaggedStruct("Map", { resolve: SyncResolver }),
  Schema.TaggedStruct("Sequence", { responses: StrategyResponses }),
  Schema.TaggedStruct("Function", { resolve: EffectResolver }),
  Schema.TaggedStruct("Failing", { error: Schema.Unknown })
)

/**
 * Response behavior selected when constructing a mock service.
 *
 * @remarks
 * Strategy outputs become text for text generation and schema-encoded JSON for
 * object generation. Native or encoded provider response parts pass through
 * after public `Response.Part` validation and insertion of a missing finish
 * part.
 *
 * @since 0.1.0
 * @category models
 */
export type ResponseStrategy = typeof ResponseStrategySchema.Type

/**
 * Tagged-enum constructors and matchers for response strategies.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResponseStrategy = Data.taggedEnum<ResponseStrategy>()

const MockCalls = Schema.Array(MockCall)
type MockCalls = typeof MockCalls.Type

/**
 * A mock service and its mutable, in-memory call log.
 *
 * @remarks
 * Read `calls` with `Ref.get`. Each runtime owns an independent log and
 * sequence cursor.
 *
 * @since 0.1.0
 * @category models
 */
export class MockLanguageModelRuntime extends Data.TaggedClass("MockLanguageModelRuntime")<{
  /** Language-model service supplied to code under test. */
  readonly service: LanguageModel.Service
  /** Append-only successful-call log owned by this runtime. */
  readonly calls: Ref.Ref<MockCalls>
}> {}

const textFromPart = Match.type<Prompt.Part>().pipe(
  Match.discriminatorsExhaustive("type")({
    text: (part) => Option.some(part.text),
    reasoning: () => Option.none<string>(),
    file: () => Option.none<string>(),
    "tool-call": () => Option.none<string>(),
    "tool-result": () => Option.none<string>()
  })
)

const textFromParts = (parts: Iterable<Prompt.Part>): string =>
  Arr.join(Arr.filterMap(Arr.fromIterable(parts), textFromPart), "\n")

const textFromMessage = Match.type<Prompt.Message>().pipe(
  Match.discriminatorsExhaustive("role")({
    system: (message) => message.content,
    user: (message) => textFromParts(message.content),
    assistant: (message) => textFromParts(message.content),
    tool: (message) => textFromParts(message.content)
  })
)

const promptToText = (prompt: Prompt.RawInput): string =>
  Arr.join(Arr.map(Prompt.make(prompt).content, textFromMessage), "\n\n")

const appendCall = (
  calls: Ref.Ref<MockCalls>,
  method: Method,
  prompt: string
): Effect.Effect<void> => Ref.update(calls, (entries) => Arr.append(entries, new MockCall({ method, prompt })))

const resolveSequenceResponse = (
  responses: StrategyResponses,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<unknown, AiError.UnknownError> =>
  Arr.match(responses, {
    onEmpty: () =>
      Effect.fail(
        mockError(
          "sequence",
          "MockLanguageModel.sequence requires at least one response"
        )
      ),
    onNonEmpty: (available) =>
      Ref.getAndUpdate(sequenceIndex, Number.increment).pipe(
        Effect.map((index) =>
          Arr.get(available, Number.min(index, Number.decrement(Arr.length(available)))).pipe(
            Option.getOrElse(() => Arr.lastNonEmpty(available))
          )
        )
      )
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

const encodeJson = <A, I, R>(response: unknown, schema: Schema.Schema<A, I, R>) => {
  const encoded = Schema.encodedSchema(schema)
  return Schema.decodeUnknown(encoded)(response, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) =>
      AiError.MalformedOutput.fromParseError({ module: "MockLanguageModel", method: "generateObject", error })
    ),
    Effect.flatMap((value) =>
      encodePayload(encoded, value).pipe(
        Effect.mapError((cause) =>
          mockError("generateObject", "MockLanguageModel JSON encoding would lose response information", cause)
        )
      )
    )
  )
}

const encodeTextResponse = (response: unknown): Effect.Effect<string, AiError.UnknownError> =>
  Match.value(response).pipe(
    Match.when(Predicate.isString, (value) => Effect.succeed(value)),
    Match.when(Schema.is(Schema.Finite), (value) =>
      Schema.encode(Schema.NumberFromString)(value).pipe(
        Effect.mapError((cause) => mockError("generateText", "Could not encode numeric strategy output", cause))
      )),
    Match.when(Predicate.isBoolean, (value) =>
      Schema.encode(Schema.BooleanFromString)(value).pipe(
        Effect.mapError((cause) => mockError("generateText", "Could not encode boolean strategy output", cause))
      )),
    Match.orElse((cause) =>
      Effect.fail(
        mockError(
          "generateText",
          "MockLanguageModel text responses must be strings, finite numbers, or booleans",
          cause
        )
      )
    )
  )

const toProviderText = (
  response: unknown,
  responseFormat: LanguageModel.ProviderOptions["responseFormat"]
): Effect.Effect<string, AiError.AiError> =>
  Match.value(responseFormat).pipe(
    Match.discriminatorsExhaustive("type")({
      text: () => encodeTextResponse(response),
      json: ({ schema }) => encodeJson(response, schema)
    })
  )

const unknownUsage = (): Response.Usage =>
  new Response.Usage({
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    reasoningTokens: undefined,
    cachedInputTokens: undefined
  })

const ProviderResponseCandidate = Schema.Array(Schema.Unknown)

const encodeProviderParts = (payload: unknown, options: LanguageModel.ProviderOptions) => {
  const parts = Schema.mutable(Schema.Array(Response.Part(Toolkit.make(...options.tools))))

  return Schema.decodeUnknown(Schema.Union(Schema.typeSchema(parts), parts))(payload).pipe(
    Effect.map((decoded) =>
      Option.match(Arr.findFirst(decoded, Schema.is(Response.FinishPart)), {
        onSome: () => decoded,
        onNone: () => Arr.append(decoded, Response.finishPart({ reason: "stop", usage: unknownUsage() }))
      })
    ),
    Effect.flatMap(Schema.encode(parts)),
    Effect.mapError((cause) =>
      mockError(
        "generateText",
        "MockLanguageModel received invalid provider response parts",
        cause
      )
    )
  )
}

const makeProviderResponse = (text: string, options: LanguageModel.ProviderOptions) =>
  encodeProviderParts(
    Arr.make(
      Response.textPart({ text }),
      Response.finishPart({
        reason: "stop",
        usage: unknownUsage()
      })
    ),
    options
  )

const toProviderResponse = (response: unknown, options: LanguageModel.ProviderOptions) =>
  Match.value(response).pipe(
    Match.when(Schema.is(ProviderResponseCandidate), (payload) => encodeProviderParts(payload, options)),
    Match.orElse((value) =>
      toProviderText(value, options.responseFormat).pipe(
        Effect.flatMap((text) => makeProviderResponse(text, options))
      )
    )
  )

const methodFromResponseFormat = Match.type<LanguageModel.ProviderOptions["responseFormat"]>().pipe(
  Match.discriminatorsExhaustive("type")({
    text: (): Method => "generateText",
    json: (): Method => "generateObject"
  })
)

const makeService = (
  strategy: ResponseStrategy,
  calls: Ref.Ref<MockCalls>,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<LanguageModel.Service> =>
  LanguageModel.make({
    generateText: (options) =>
      Effect.gen(function*() {
        const prompt = promptToText(options.prompt)
        const strategyResponse = yield* resolveStrategyResponse(strategy, prompt, sequenceIndex)
        const providerResponse = yield* toProviderResponse(strategyResponse, options)

        yield* appendCall(calls, methodFromResponseFormat(options.responseFormat), prompt)

        return providerResponse
      }),
    streamText: () =>
      Stream.fail(
        mockError(
          "streamText",
          "MockLanguageModel does not support streamText"
        )
      )
  })

/**
 * Creates non-streaming `LanguageModel` test services.
 *
 * @remarks
 * Generation is deterministic for deterministic strategy callbacks. The mock
 * does not simulate streaming: `streamText` fails with `AiError.UnknownError`.
 * Strategy failures, exceptions from `map`, unsupported text values, and
 * lossy JSON encoding fail as `AiError.UnknownError`. Object responses must
 * satisfy the requested schema's encoded form; mismatches fail with
 * `AiError.MalformedOutput` before any successful call is recorded.
 *
 * @since 0.1.0
 * @category constructors
 */
export const MockLanguageModel = {
  /** Returns the same response for every generation call. */
  fixed: (response: unknown): ResponseStrategy => ResponseStrategy.Fixed({ response }),
  /** Computes each response synchronously from normalized prompt text. */
  map: (resolve: (prompt: string) => unknown): ResponseStrategy => ResponseStrategy.Map({ resolve }),
  /**
   * Returns responses in order and repeats the final item after exhaustion.
   * An empty sequence fails each generation call with `AiError.UnknownError`.
   */
  sequence: (responses: StrategyResponses): ResponseStrategy => ResponseStrategy.Sequence({ responses }),
  /**
   * Computes each response with an Effect. Any failure is wrapped in
   * `AiError.UnknownError`.
   */
  fromFunction: (
    resolve: (prompt: string) => Effect.Effect<unknown, unknown>
  ): ResponseStrategy => ResponseStrategy.Function({ resolve }),
  /** Fails every generation call with an `AiError.UnknownError` carrying `error` as its cause. */
  failing: (error: unknown): ResponseStrategy => ResponseStrategy.Failing({ error }),
  /** Allocates an independent mock service, call log, and sequence cursor. */
  make: (strategy: ResponseStrategy): Effect.Effect<MockLanguageModelRuntime> =>
    Effect.gen(function*() {
      const calls = yield* Ref.make<MockCalls>(Arr.empty())
      const sequenceIndex = yield* Ref.make(0)
      const service = yield* makeService(strategy, calls, sequenceIndex)

      return new MockLanguageModelRuntime({
        service,
        calls
      })
    }),
  /** Provides a newly allocated mock as the `LanguageModel` service. */
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
