/**
 * Deterministic, in-memory `LanguageModel` test doubles.
 *
 * @since 0.1.0
 * @module
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelIdentity from "@scenesystems/effect-lm/ModelIdentity"
import { Current as CurrentSettings, empty, merge, ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Role } from "@scenesystems/effect-lm/Role"
import {
  Array as Arr,
  Context,
  Data,
  Effect,
  Inspectable,
  Layer,
  Match,
  Number,
  Option,
  Predicate,
  Ref,
  Result,
  Schema,
  Stream
} from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Prompt from "effect/ai/Prompt"
import * as Response from "effect/ai/Response"
import * as Toolkit from "effect/ai/Toolkit"
import * as Payload from "./Payload.js"

const MethodSchema = Schema.Literals(["generateText", "generateObject"])
type Method = typeof MethodSchema.Type

const mockError = (method: string, description: string, cause?: unknown): AiError.AiError =>
  AiError.make({
    module: "MockLanguageModel",
    method,
    reason: new AiError.UnknownError({
      description,
      metadata: { cause: Inspectable.toStringUnknown(cause) }
    })
  })

const structuredOutputError = (response: unknown): AiError.AiError =>
  AiError.make({
    module: "MockLanguageModel",
    method: "generateObject",
    reason: new AiError.StructuredOutputError({
      description: "MockLanguageModel response contains a value unsupported by JSON",
      responseText: Inspectable.toStringUnknown(response)
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
export class Call extends Schema.Class<Call>("@scenesystems/effect-dsp/MockLanguageModel/Call")({
  /** Language-model operation that completed successfully. */
  method: MethodSchema,
  /** Normalized prompt text received by the mock operation. */
  prompt: Schema.String,
  /** Effective generation settings at the invocation boundary. */
  settings: ModelSettings,
  /** Semantic invocation role. */
  role: Role,
  /** Candidate rollout partition. */
  rolloutId: Schema.Option(Schema.Finite)
}) {}

const CurrentRequest = Context.Reference<ModelBinder.Request>("@scenesystems/effect-dsp/MockLanguageModel/Request", {
  defaultValue: () => new ModelBinder.Request({ settings: empty, role: "task", rolloutId: Option.none() })
})

const StrategyResponses = Schema.Array(Schema.Unknown)
type StrategyResponses = typeof StrategyResponses.Type

class Fixed extends Data.TaggedClass("Fixed")<{
  readonly response: unknown
}> {}

class MapResponse extends Data.TaggedClass("Map")<{
  readonly resolve: (prompt: string) => unknown
}> {}

class SequenceResponse extends Data.TaggedClass("Sequence")<{
  readonly responses: StrategyResponses
}> {}

class FunctionResponse extends Data.TaggedClass("Function")<{
  readonly resolve: (prompt: string) => Effect.Effect<unknown, AiError.AiError>
}> {}

class Failing extends Data.TaggedClass("Failing")<{
  readonly error: unknown
}> {}

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
export type Strategy = Fixed | MapResponse | SequenceResponse | FunctionResponse | Failing

const strategies = Data.taggedEnum<Strategy>()

const Calls = Schema.Array(Call)
type Calls = typeof Calls.Type

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
export class Runtime extends Data.TaggedClass("MockLanguageModelRuntime")<{
  /** Language-model service supplied to code under test. */
  readonly service: LanguageModel.LanguageModel
  /** Append-only successful-call log owned by this runtime. */
  readonly calls: Ref.Ref<Calls>
  /** Records scoped request settings without sharing mutable context between fibers. */
  readonly binder: ModelBinder.Binder
}> {}

const textFromPart = Match.type<Prompt.Part>().pipe(
  Match.discriminatorsExhaustive("type")({
    text: (part) => Option.some(part.text),
    reasoning: () => Option.none<string>(),
    file: () => Option.none<string>(),
    "tool-call": () => Option.none<string>(),
    "tool-result": () => Option.none<string>(),
    "tool-approval-request": () => Option.none<string>(),
    "tool-approval-response": () => Option.none<string>()
  })
)

const textFromParts = (parts: Iterable<Prompt.Part>): string =>
  Arr.join(Arr.filterMap(Arr.fromIterable(parts), (part) => Result.fromOption(textFromPart(part), () => void 0)), "\n")

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
  calls: Ref.Ref<Calls>,
  method: Method,
  prompt: string
): Effect.Effect<void> =>
  Effect.flatMap(CurrentRequest, (request) =>
    Ref.update(calls, (entries) =>
      Arr.append(
        entries,
        new Call({
          method,
          prompt,
          settings: request.settings,
          role: request.role,
          rolloutId: request.rolloutId
        })
      )))

const resolveSequenceResponse = (
  responses: StrategyResponses,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<unknown, AiError.AiError> =>
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
  strategy: Strategy,
  prompt: string,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<unknown, AiError.AiError> =>
  strategies.$match({
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

const encodeJson = (response: unknown, schema: Schema.Top): Effect.Effect<string, AiError.AiError> => {
  const encoded = Schema.toEncoded(schema)
  return Schema.decodeUnknownEffect(encoded)(response, { onExcessProperty: "error" }).pipe(
    Effect.mapError(structuredOutputError),
    Effect.flatMap((value) =>
      Payload.encode(encoded, value).pipe(
        Effect.mapError((cause) => mockError("generateObject", "MockLanguageModel JSON encoding failed", cause))
      )
    )
  )
}

const encodeTextResponse = (response: unknown): Effect.Effect<string, AiError.AiError> =>
  Match.value(response).pipe(
    Match.when(Predicate.isString, (value) => Effect.succeed(value)),
    Match.when(Schema.is(Schema.Finite), (value) => Effect.succeed(Inspectable.toStringUnknown(value))),
    Match.when(Predicate.isBoolean, (value) => Effect.succeed(Inspectable.toStringUnknown(value))),
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
    inputTokens: {},
    outputTokens: {}
  })

const ProviderResponseCandidate = Schema.Array(Schema.Unknown)

const encodeProviderParts = (payload: unknown, options: LanguageModel.ProviderOptions) => {
  const parts = Schema.mutable(Schema.Array(Schema.toEncoded(Response.Part(Toolkit.make(...options.tools)))))

  return Match.value(payload).pipe(
    Match.when(Schema.is(parts), (decoded) =>
      Effect.succeed(
        Option.match(Arr.findFirst(decoded, Schema.is(Response.FinishPart)), {
          onSome: () => decoded,
          onNone: () => Arr.append(decoded, Response.makePart("finish", { reason: "stop", usage: unknownUsage() }))
        })
      )),
    Match.orElse((cause) =>
      Effect.fail(
        mockError("generateText", "MockLanguageModel received invalid provider response parts", cause)
      )
    )
  )
}

const makeProviderResponse = (text: string, options: LanguageModel.ProviderOptions) =>
  encodeProviderParts(
    Arr.make(
      Response.makePart("text", { text }),
      Response.makePart("finish", {
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
  strategy: Strategy,
  calls: Ref.Ref<Calls>,
  sequenceIndex: Ref.Ref<number>
): Effect.Effect<LanguageModel.LanguageModel> =>
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
 * Returns the same response for every generation call.
 * @since 0.1.0
 * @category constructors
 */
export const succeed = (response: unknown): Strategy => new Fixed({ response })

/**
 * Computes each response synchronously from normalized prompt text.
 * @since 0.1.0
 * @category constructors
 */
export const map = (resolve: (prompt: string) => unknown): Strategy => new MapResponse({ resolve })

/**
 * Returns responses in order and repeats the final item after exhaustion.
 * @since 0.1.0
 * @category constructors
 */
export const sequence = (responses: StrategyResponses): Strategy => new SequenceResponse({ responses })

/**
 * Computes each response with an Effect.
 * @since 0.1.0
 * @category constructors
 */
export const fromFunction = (
  resolve: (prompt: string) => Effect.Effect<unknown, AiError.AiError>
): Strategy => new FunctionResponse({ resolve })

/**
 * Fails every generation call with an `AiError.UnknownError`.
 * @since 0.1.0
 * @category constructors
 */
export const fail = (error: unknown): Strategy => new Failing({ error })

/**
 * Allocates an independent mock service, call log, and sequence cursor.
 * @since 0.1.0
 * @category constructors
 */
export const make = (strategy: Strategy, model = "mock", defaults: ModelSettings = empty): Effect.Effect<Runtime> =>
  Effect.gen(function*() {
    const calls = yield* Ref.make<Calls>(Arr.empty())
    const sequenceIndex = yield* Ref.make(0)
    const service = yield* makeService(strategy, calls, sequenceIndex)

    return new Runtime({
      service,
      calls,
      binder: new ModelBinder.Binder({
        bind: (request) => (effect) =>
          effect.pipe(
            Effect.provideService(
              CurrentRequest,
              new ModelBinder.Request({
                role: request.role,
                rolloutId: request.rolloutId,
                settings: merge(defaults, request.settings)
              })
            ),
            Effect.provideService(CurrentSettings, merge(defaults, request.settings)),
            Effect.provideService(
              ModelIdentity.Current,
              Option.some(new ModelIdentity.Identity({ provider: "mock", model }))
            )
          )
      })
    })
  })

/**
 * Provides a newly allocated mock as the `LanguageModel` service.
 * @since 0.1.0
 * @category layers
 */
export const layer = (
  tag: typeof LanguageModel.LanguageModel,
  strategy: Strategy
) =>
  Layer.unwrap(
    make(strategy).pipe(Effect.map((runtime) =>
      Layer.merge(Layer.succeed(tag, runtime.service), Layer.succeed(ModelBinder.Current, runtime.binder))
    ))
  )
