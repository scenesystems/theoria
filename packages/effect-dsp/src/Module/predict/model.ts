/**
 * Predict-forward execution model.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as Response from "@effect/ai/Response"
import type { Schema } from "effect"
import { Data } from "effect"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import type { Payload } from "../../contracts/Payload.js"
import type { Signature } from "../../Signature/model.js"
import type { PredictPolicy } from "./policy.js"

/**
 * Shared configuration for structured and text forward execution.
 *
 * @since 0.1.0
 * @internal
 */
export class ForwardOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly params: ModuleParams
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly outputSchema: Schema.Struct<O>
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
