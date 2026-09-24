/**
 * Predict-forward execution model.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type * as Prompt from "@effect/ai/Prompt"
import type * as Response from "@effect/ai/Response"
import type { Effect, Option, Schema } from "effect"
import { Data } from "effect"
import type { TraceError } from "../../../DspError.js"
import type { PredictPolicy } from "../../../Module.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type { Payload } from "../../../Payload.js"

/**
 * Shared configuration for structured and text forward execution.
 *
 * @since 0.1.0
 * @internal
 */
export class ForwardOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly buildPrompt: (
    params: ModuleParameters,
    input: Schema.Schema.Type<Schema.Struct<I>>,
    feedback?: Option.Option<string>
  ) => Effect.Effect<Prompt.Prompt, AiError.MalformedInput, Schema.Schema.Context<Schema.Struct<I>>>
  readonly params: ModuleParameters
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
  readonly encodeOutput: (
    value: Schema.Schema.Type<Schema.Struct<O>>
  ) => Effect.Effect<Payload, TraceError, Schema.Schema.Context<Schema.Struct<O>>>
  readonly policy: PredictPolicy
}> {}

/**
 * Runtime output bundle produced by the predict forward engine.
 *
 * @since 0.1.0
 * @internal
 */
export class ForwardExecution<A> extends Data.Class<{
  readonly output: A
  readonly traceOutput: Payload
  readonly promptText: string
  readonly rawResponse: string
  readonly usage: Response.Usage
}> {}
