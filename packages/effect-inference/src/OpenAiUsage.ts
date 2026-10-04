/**
 * Usage observation for the native Effect OpenAI client.
 *
 * @since 0.4.0
 * @module
 */
import type * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiSchema from "@effect/ai-openai/OpenAiSchema"
import * as AiResponse from "effect/ai/Response"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

/**
 * Canonical usage paired with the exact OpenAI usage report.
 *
 * @since 0.5.0
 * @category models
 */
const tokenDetail = (details: unknown, key: string): Option.Option<number> =>
  Predicate.hasProperty(details, key) && Predicate.isNumber(details[key]) ? Option.some(details[key]) : Option.none()

const projectUsage = (raw: OpenAiSchema.ResponseUsage): AiResponse.Usage => {
  const cached = tokenDetail(raw.input_tokens_details, "cached_tokens")
  const reasoning = tokenDetail(raw.output_tokens_details, "reasoning_tokens")
  return new AiResponse.Usage({
    inputTokens: {
      total: raw.input_tokens,
      ...Option.match(cached, {
        onNone: () => ({}),
        onSome: (cacheRead) => ({
          cacheRead,
          ...Option.match(Option.liftPredicate((value: number) => value <= raw.input_tokens)(cacheRead), {
            onNone: () => ({}),
            onSome: (value) => ({ uncached: raw.input_tokens - value })
          })
        })
      }),
      ...Option.match(tokenDetail(raw.input_tokens_details, "cache_write_tokens"), {
        onNone: () => ({}),
        onSome: (cacheWrite) => ({ cacheWrite })
      })
    },
    outputTokens: {
      total: raw.output_tokens,
      ...Option.match(reasoning, {
        onNone: () => ({}),
        onSome: (reasoning) => ({
          reasoning,
          ...Option.match(Option.liftPredicate((value: number) => value <= raw.output_tokens)(reasoning), {
            onNone: () => ({}),
            onSome: (value) => ({ text: raw.output_tokens - value })
          })
        })
      })
    }
  })
}

/** Canonical usage with its retained provider report. @since 0.5.0 @category schemas */
export const Observation = Schema.toType(OpenAiSchema.ResponseUsage).pipe(
  Schema.decodeTo(
    Schema.Struct({ usage: Schema.toType(AiResponse.Usage), raw: Schema.toType(OpenAiSchema.ResponseUsage) }),
    {
      decode: SchemaGetter.transform((raw) => ({ usage: projectUsage(raw), raw })),
      encode: SchemaGetter.transform((observation) => observation.raw)
    }
  )
)
/** Canonical and raw usage observation. @since 0.5.0 @category models */
export type Observation = typeof Observation.Type

const decodeObservation = Schema.decodeSync(Observation)

const observeOptional = (
  usage: Option.Option<OpenAiSchema.ResponseUsage>,
  observe: (usage: AiResponse.Usage, raw: Option.Option<OpenAiSchema.ResponseUsage>) => Effect.Effect<void>
): Effect.Effect<void> =>
  usage.pipe(
    Option.match({
      onNone: () =>
        observe(
          new AiResponse.Usage({ inputTokens: {}, outputTokens: {} }),
          Option.none()
        ),
      onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
    })
  )

const responseUsage = (response: OpenAiSchema.Response): Option.Option<OpenAiSchema.ResponseUsage> =>
  Option.fromNullishOr(response.usage)

const streamUsage = (
  event: OpenAiClient.ResponseStreamEvent
): Option.Option<OpenAiSchema.ResponseUsage> =>
  Match.value(event).pipe(
    Match.discriminator("type")(
      "response.created",
      "response.queued",
      "response.in_progress",
      "response.completed",
      "response.incomplete",
      "response.failed",
      (event) => responseUsage(event.response)
    ),
    Match.discriminator("type")(
      "response.output_item.added",
      "response.output_item.done",
      "response.content_part.added",
      "response.content_part.done",
      "response.output_text.delta",
      "response.output_text.done",
      "response.output_text.annotation.added",
      "response.refusal.delta",
      "response.refusal.done",
      "response.function_call_arguments.delta",
      "response.function_call_arguments.done",
      "response.file_search_call.in_progress",
      "response.file_search_call.searching",
      "response.file_search_call.completed",
      "response.web_search_call.in_progress",
      "response.web_search_call.searching",
      "response.web_search_call.completed",
      "response.reasoning_summary_part.added",
      "response.reasoning_summary_part.done",
      "response.reasoning_summary_text.delta",
      "response.reasoning_summary_text.done",
      "response.reasoning_text.delta",
      "response.reasoning_text.done",
      "response.image_generation_call.in_progress",
      "response.image_generation_call.generating",
      "response.image_generation_call.partial_image",
      "response.image_generation_call.completed",
      "response.mcp_call_arguments.delta",
      "response.mcp_call_arguments.done",
      "response.mcp_call.in_progress",
      "response.mcp_call.completed",
      "response.mcp_call.failed",
      "response.mcp_list_tools.in_progress",
      "response.mcp_list_tools.completed",
      "response.mcp_list_tools.failed",
      "response.code_interpreter_call.in_progress",
      "response.code_interpreter_call.interpreting",
      "response.code_interpreter_call.completed",
      "response.code_interpreter_call_code.delta",
      "response.code_interpreter_call_code.done",
      "response.custom_tool_call_input.delta",
      "response.custom_tool_call_input.done",
      "error",
      () => Option.none()
    ),
    Match.orElse(() => Option.none())
  )

const decorateCreateResponse = (
  createResponse: OpenAiClient.Service["createResponse"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<OpenAiSchema.ResponseUsage>) => Effect.Effect<void>
): OpenAiClient.Service["createResponse"] =>
(options) =>
  createResponse(options).pipe(
    Effect.tap(([response]) => observeOptional(responseUsage(response), observe))
  )

const decorateCreateResponseStream = (
  createResponseStream: OpenAiClient.Service["createResponseStream"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<OpenAiSchema.ResponseUsage>) => Effect.Effect<void>
): OpenAiClient.Service["createResponseStream"] =>
(options) =>
  createResponseStream(options).pipe(
    Effect.map(([response, stream]) => [
      response,
      stream.pipe(
        Stream.tap((event) =>
          Option.match(streamUsage(event), {
            onNone: () => Effect.void,
            onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
          })
        )
      )
    ])
  )

/**
 * Decorates a native OpenAI client so response usage is observed before the
 * native language model transforms the response. Every other client method,
 * response, stream event, failure, and interruption is preserved.
 * The second callback argument retains the original native usage report in an
 * Option. A non-streaming response without usage emits unknown canonical counters
 * and None, preventing fallback to totals synthesized by the native converter.
 * Every available stream snapshot is observed, not only terminal events; events
 * without usage do not erase earlier snapshots.
 *
 * @example
 * ```ts
 * import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
 * import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
 * import { Effect } from "effect"
 * import { OpenAiUsage } from "@scenesystems/effect-inference"
 *
 * const model = Effect.gen(function*() {
 *   const client = yield* OpenAiClient.OpenAiClient
 *   const observed = OpenAiUsage.observe(client, (usage) => Effect.log(usage))
 *   return yield* OpenAiLanguageModel.make({ model: "gpt-4o" }).pipe(
 *     Effect.provideService(OpenAiClient.OpenAiClient, observed)
 *   )
 * })
 * ```
 *
 * @since 0.4.0
 * @category combinators
 */
export const observe = (
  client: OpenAiClient.Service,
  observe: (usage: AiResponse.Usage, raw: Option.Option<OpenAiSchema.ResponseUsage>) => Effect.Effect<void>
): OpenAiClient.Service =>
  Struct.evolve(client, {
    createResponse: (createResponse) => decorateCreateResponse(createResponse, observe),
    createResponseStream: (createResponseStream) => decorateCreateResponseStream(createResponseStream, observe)
  })
