/**
 * Defines labeled and input-only dataset rows used by evaluation and optimization.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Dataset row containing module input and an optional expected output.
 *
 * @remarks
 * Record values remain `unknown`; construction does not validate them against a
 * module signature or establish label correctness. {@link Evaluate.run} reports
 * input-only rows as failures, while optimizers may accept them as unlabeled data.
 *
 * @since 0.1.0
 * @category models
 */
export class Example extends Schema.Class<Example>("Example")({
  /** Fields passed to the evaluated module. */
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Expected fields used by metrics; absence marks an input-only example. */
  output: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/**
 * Input and expected output retained as a few-shot demonstration.
 *
 * @remarks
 * Both records are required and their values remain `unknown`. Construction
 * does not validate the records against a signature or establish provenance,
 * correctness, or permission to send their contents to a model provider.
 *
 * @since 0.1.0
 * @category models
 */
export class Demo extends Schema.Class<Demo>("Demo")({
  /** Input fields rendered into the few-shot example. */
  input: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Expected output fields rendered into the few-shot example. */
  output: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
