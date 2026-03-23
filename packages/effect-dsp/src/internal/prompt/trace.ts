/**
 * Prompt-to-trace text projection.
 *
 * @since 0.0.0
 * @internal
 */
import type * as Prompt from "@effect/ai/Prompt"
import { Array as Arr, Match, Option, Predicate } from "effect"

const hasStringContent = (candidate: unknown): candidate is { readonly content: string } =>
  Predicate.hasProperty(candidate, "content") && Predicate.isString(candidate.content)

const messageContentToText = (message: unknown): Option.Option<string> =>
  Match.value(message).pipe(
    Match.when(
      hasStringContent,
      (candidate) => Option.some(candidate.content)
    ),
    Match.orElse(() => Option.none<string>())
  )

/**
 * Flattens a raw prompt payload into a single plain-text string suitable
 * for inclusion in trace entries.
 *
 * Handles string prompts directly and message-array prompts by extracting
 * and joining the `content` field of each message.
 *
 * @since 0.0.0
 * @category formatters
 * @internal
 */
export const promptToTraceText = (prompt: Prompt.RawInput): string =>
  Match.value(prompt).pipe(
    Match.when(Predicate.isString, (text) => text),
    Match.when(Predicate.isIterable, (messages) =>
      Arr.join(
        Arr.filterMap(Arr.fromIterable<unknown>(messages), messageContentToText),
        "\n\n"
      )),
    Match.orElse(() => "")
  )
