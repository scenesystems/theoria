/**
 * Internal signature construction for `Module.parallel`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Schema } from "effect"
import * as Signature from "../../Signature/index.js"

/**
 * Canonical field carrying the ordered batch of parallel inputs.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const PARALLEL_INPUTS_FIELD = "inputs"

/**
 * Canonical field carrying the ordered batch of parallel outputs.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const PARALLEL_OUTPUTS_FIELD = "outputs"

/**
 * Input fields projected into `Module.parallel`.
 *
 * @since 0.2.0
 * @category models
 */
export type ParallelInputFields<I extends Schema.Struct.Fields> = Readonly<
  Record<typeof PARALLEL_INPUTS_FIELD, Schema.Array$<Schema.Struct<I>>>
>

/**
 * Output fields projected from `Module.parallel`.
 *
 * @since 0.2.0
 * @category models
 */
export type ParallelOutputFields<O extends Schema.Struct.Fields> = Readonly<
  Record<typeof PARALLEL_OUTPUTS_FIELD, Schema.Array$<Schema.Struct<O>>>
>

/**
 * Build the batch signature consumed by `Module.parallel`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const ParallelSignature = {
  make: <
    I extends Schema.Struct.Fields,
    O extends Schema.Struct.Fields
  >(options: {
    readonly signature: Signature.Signature<I, O>
  }) =>
    Signature.make(
      `Run ${options.signature.description} over an ordered batch of inputs and preserve output ordering.`,
      {
        [PARALLEL_INPUTS_FIELD]: Signature.describe(
          Schema.Array(options.signature.inputSchema),
          "Ordered batch inputs evaluated by the wrapped module"
        )
      },
      {
        [PARALLEL_OUTPUTS_FIELD]: Signature.describe(
          Schema.Array(options.signature.outputSchema),
          "Ordered batch outputs projected from the wrapped module"
        )
      }
    )
}
