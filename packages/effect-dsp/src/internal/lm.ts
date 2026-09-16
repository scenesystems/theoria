/**
 * Native language-model execution and per-call observation boundary.
 *
 * @since 0.1.0
 * @internal
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import type * as Prompt from "@effect/ai/Prompt"
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import type { Record, Schema } from "effect"
import { Data, Effect } from "effect"
import { trackCall } from "../Trace/call.js"

class TextCallOptions<
  Tools extends Record.ReadonlyRecord<string, Tool.Any> = Toolkit.Tools<typeof Toolkit.empty>
> extends Data.Class<{
  readonly toolkit?: Toolkit.WithHandler<Tools>
}> {}

/**
 * Executes native structured generation, recording its exit independently of
 * output decoding and subsequent DSP trace projection.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmResponse = <A, I extends Record.ReadonlyRecord<string, unknown>, R>(
  prompt: Prompt.RawInput,
  schema: Schema.Schema<A, I, R>
) => trackCall("generateObject", LanguageModel.generateObject({ prompt, schema }), (response) => response.usage)

/**
 * Returns the decoded native object while retaining call evidence in the
 * active Trace call or usage scope.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLm = <A, I extends Record.ReadonlyRecord<string, unknown>, R>(
  prompt: Prompt.RawInput,
  schema: Schema.Schema<A, I, R>
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
  options: TextCallOptions<Tools> = new TextCallOptions<Tools>({})
) =>
  trackCall(
    "generateText",
    LanguageModel.generateText({ prompt, toolkit: options.toolkit }),
    (response) => response.usage
  )

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
  options: TextCallOptions<Tools> = new TextCallOptions<Tools>({})
) => callLmTextResponse(prompt, options).pipe(Effect.map(([response]) => response.text))
