import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { Array as Arr, Effect, Match, Option, Order, Predicate, Record as Rec } from "effect"

import { mockError } from "./model.js"

const textFromUnknown = (value: unknown): string =>
  Match.value(value).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isNumber, (numberValue) => String(numberValue)),
    Match.when(Predicate.isBoolean, (booleanValue) => String(booleanValue)),
    Match.orElse(() => "[non-text-response]")
  )

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

export const toProviderText = (
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

const MockUsage = {
  make: (): Response.Usage =>
    new Response.Usage({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      reasoningTokens: undefined,
      cachedInputTokens: undefined
    })
}

export const MockProviderResponse = {
  fromText: (text: string): Array<Response.PartEncoded> =>
    Arr.make(
      Response.textPart({ text, metadata: {} }),
      Response.finishPart({
        reason: "stop",
        usage: MockUsage.make(),
        metadata: {}
      })
    ),
  ensureFinishPart: (payload: ReadonlyArray<Response.PartEncoded>): Array<Response.PartEncoded> =>
    Option.match(Arr.findFirst(payload, (part) => part.type === "finish"), {
      onSome: () => Arr.fromIterable(payload),
      onNone: () =>
        Arr.append(
          Arr.fromIterable(payload),
          Response.finishPart({
            reason: "stop",
            usage: MockUsage.make(),
            metadata: {}
          })
        )
    })
}

const isResponsePartEncoded = (candidate: unknown): candidate is Response.PartEncoded =>
  Predicate.hasProperty(candidate, "type") && Predicate.isString(candidate.type)

export const isProviderResponsePayload = (
  candidate: unknown
): candidate is ReadonlyArray<Response.PartEncoded> =>
  Arr.isArray(candidate) && Arr.every(candidate, isResponsePartEncoded)
