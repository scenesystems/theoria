/**
 * Native language-model execution and per-call observation boundary.
 *
 * @since 0.1.0
 * @internal
 */
import type { Record, Schema } from "effect"
import { Option } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import type * as Prompt from "effect/ai/Prompt"
import type * as Tool from "effect/ai/Tool"
import type * as Toolkit from "effect/ai/Toolkit"
import * as Effect from "effect/Effect"
import { trackCall } from "./trace/call.js"

/**
 * Executes native structured generation, recording its exit independently of
 * output decoding and subsequent DSP trace projection.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmResponse = <A, I extends Record.ReadonlyRecord<string, unknown>, RD, RE>(
  prompt: Prompt.RawInput,
  schema: Schema.Codec<A, I, RD, RE>
) => trackCall("generateObject", LanguageModel.generateObject({ prompt, schema }), (response) => response.usage)

/**
 * Returns the decoded native object while retaining call evidence in the
 * active Trace call or usage scope.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLm = <A, I extends Record.ReadonlyRecord<string, unknown>, RD, RE>(
  prompt: Prompt.RawInput,
  schema: Schema.Codec<A, I, RD, RE>
) => callLmResponse(prompt, schema).pipe(Effect.map(([response]) => response.value))

/**
 * Executes native text generation without copying response or tool models.
 * One call is recorded on success, failure, defect, or interruption.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmTextResponse = <
  Tools extends Record.ReadonlyRecord<string, Tool.Any> = Toolkit.Tools<typeof Toolkit.empty>
>(
  prompt: Prompt.RawInput,
  toolkit: Option.Option<Toolkit.WithHandler<Tools>> = Option.none()
) =>
  Effect.gen(function*() {
    yield* Effect.void
    return yield* Option.match(toolkit, {
      onNone: () => trackCall("generateText", LanguageModel.generateText({ prompt }), (response) => response.usage),
      onSome: (toolkit) =>
        trackCall("generateText", LanguageModel.generateText({ prompt, toolkit }), (response) => response.usage)
    })
  })

/**
 * Returns native completion text while retaining call evidence in the active
 * Trace call or usage scope.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmText = <
  Tools extends Record.ReadonlyRecord<string, Tool.Any> = Toolkit.Tools<typeof Toolkit.empty>
>(
  prompt: Prompt.RawInput,
  toolkit: Option.Option<Toolkit.WithHandler<Tools>> = Option.none()
) => callLmTextResponse(prompt, toolkit).pipe(Effect.map(([response]) => response.text))
