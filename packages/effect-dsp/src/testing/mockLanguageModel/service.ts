import type * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Match, Option, Ref, Stream } from "effect"

import { type Method, MockCall, mockError, ResponseStrategy } from "./model.js"
import { promptToText } from "./prompt.js"
import { isProviderResponsePayload, MockProviderResponse, toProviderText } from "./providerResponse.js"

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

export const MockLanguageModelService = {
  make: (
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
              (payload) => Effect.succeed(MockProviderResponse.ensureFinishPart(payload))
            ),
            Match.orElse((response) =>
              toProviderText(response, options.responseFormat).pipe(
                Effect.map(MockProviderResponse.fromText)
              )
            )
          )

          yield* appendCall(calls, method, prompt)

          return providerResponse
        }),
      streamText: (_options) => Stream.empty
    })
}
