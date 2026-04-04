/**
 * Sole @effect/ai import site — all LLM calls route through here.
 *
 * @since 0.1.0
 * @internal
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import type * as Prompt from "@effect/ai/Prompt"
import type * as Response from "@effect/ai/Response"
import type * as Tool from "@effect/ai/Tool"
import type * as Toolkit from "@effect/ai/Toolkit"
import { Data, Effect } from "effect"
import type * as Schema from "effect/Schema"

/**
 * Wraps a structured-object LLM response with the decoded value,
 * raw text completion, and token usage metadata.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class ObjectCallResult<A> extends Data.Class<{
  readonly value: A
  readonly text: string
  readonly usage: Response.Usage
}> {}

/**
 * Captures the id, name, and serialized parameters of a single tool
 * invocation made during text generation.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class TextToolCallSummary extends Data.Class<{
  readonly id: string
  readonly name: string
  readonly params: unknown
}> {}

/**
 * Captures the id, name, result payload, and failure status of a single
 * tool-result returned during text generation.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class TextToolResultSummary extends Data.Class<{
  readonly id: string
  readonly name: string
  readonly result: unknown
  readonly isFailure: boolean
}> {}

/**
 * Wraps a text-mode LLM response with the completion string, token usage,
 * and any tool interactions that occurred during generation.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class TextCallResult extends Data.Class<{
  readonly text: string
  readonly usage: Response.Usage
  readonly toolCalls: ReadonlyArray<TextToolCallSummary>
  readonly toolResults: ReadonlyArray<TextToolResultSummary>
}> {}

type TextCallOptions<
  Tools extends Record<string, Tool.Any> = Record<never, Tool.Any>
> = Readonly<{
  readonly toolkit?: Toolkit.WithHandler<Tools>
}>

/**
 * Calls the language model in structured-object mode and returns the full
 * {@link ObjectCallResult} including the decoded value, raw text, and usage.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmResponse = <A, I extends Record<string, unknown>, R>(
  prompt: Prompt.RawInput,
  schema: Schema.Schema<A, I, R>
): Effect.Effect<
  ObjectCallResult<A>,
  LanguageModel.ExtractError<{ readonly prompt: Prompt.RawInput; readonly schema: Schema.Schema<A, I, R> }>,
  LanguageModel.LanguageModel | R
> =>
  LanguageModel.generateObject({ prompt, schema }).pipe(
    Effect.map((response) =>
      new ObjectCallResult({
        value: response.value,
        text: response.text,
        usage: response.usage
      })
    )
  )

/**
 * Calls the language model in structured-object mode and returns only the
 * decoded value, discarding usage metadata.
 *
 * @see {@link callLmResponse} for the full response variant
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLm = <A, I extends Record<string, unknown>, R>(
  prompt: Prompt.RawInput,
  schema: Schema.Schema<A, I, R>
): Effect.Effect<
  A,
  LanguageModel.ExtractError<{ readonly prompt: Prompt.RawInput; readonly schema: Schema.Schema<A, I, R> }>,
  LanguageModel.LanguageModel | R
> =>
  callLmResponse(prompt, schema).pipe(
    Effect.map((response) => response.value)
  )

/**
 * Calls the language model in text mode and returns the full
 * {@link TextCallResult} including tool call/result summaries and usage.
 *
 * Accepts an optional toolkit for tool-augmented generation.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmTextResponse = <
  Tools extends Record<string, Tool.Any> = Record<never, Tool.Any>
>(
  prompt: Prompt.RawInput,
  options: TextCallOptions<Tools> = {}
): Effect.Effect<
  TextCallResult,
  LanguageModel.ExtractError<{
    readonly prompt: Prompt.RawInput
    readonly toolkit?: Toolkit.WithHandler<Tools>
  }>,
  | LanguageModel.LanguageModel
  | LanguageModel.ExtractContext<{
    readonly prompt: Prompt.RawInput
    readonly toolkit?: Toolkit.WithHandler<Tools>
  }>
> =>
  LanguageModel.generateText({
    prompt,
    toolkit: options.toolkit
  }).pipe(
    Effect.map((response) =>
      new TextCallResult({
        text: response.text,
        usage: response.usage,
        toolCalls: response.toolCalls.map((toolCall) =>
          new TextToolCallSummary({
            id: toolCall.id,
            name: toolCall.name,
            params: toolCall.params
          })
        ),
        toolResults: response.toolResults.map((toolResult) =>
          new TextToolResultSummary({
            id: toolResult.id,
            name: toolResult.name,
            result: toolResult.result,
            isFailure: toolResult.isFailure
          })
        )
      })
    )
  )

/**
 * Calls the language model in text mode and returns only the completion
 * string, discarding usage and tool metadata.
 *
 * @see {@link callLmTextResponse} for the full response variant
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const callLmText = <
  Tools extends Record<string, Tool.Any> = Record<never, Tool.Any>
>(
  prompt: Prompt.RawInput,
  options: TextCallOptions<Tools> = {}
): Effect.Effect<
  string,
  LanguageModel.ExtractError<{
    readonly prompt: Prompt.RawInput
    readonly toolkit?: Toolkit.WithHandler<Tools>
  }>,
  | LanguageModel.LanguageModel
  | LanguageModel.ExtractContext<{
    readonly prompt: Prompt.RawInput
    readonly toolkit?: Toolkit.WithHandler<Tools>
  }>
> =>
  callLmTextResponse(prompt, options).pipe(
    Effect.map((response) => response.text)
  )
