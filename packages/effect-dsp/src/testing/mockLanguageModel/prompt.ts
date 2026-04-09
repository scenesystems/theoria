import type * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Match, Option, Predicate } from "effect"

const isTextPart = (candidate: unknown): candidate is { readonly type: "text"; readonly text: string } =>
  Predicate.hasProperty(candidate, "type") &&
  candidate.type === "text" &&
  Predicate.hasProperty(candidate, "text") &&
  Predicate.isString(candidate.text)

const hasContentProperty = (candidate: unknown): candidate is { readonly content: unknown } =>
  Predicate.hasProperty(candidate, "content")

const hasContentArray = (candidate: unknown): candidate is { readonly content: ReadonlyArray<unknown> } =>
  Predicate.hasProperty(candidate, "content") && Arr.isArray(candidate.content)

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

export const promptToText = (prompt: Prompt.RawInput): string =>
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
