/**
 * Defines labeled and input-only dataset rows used by evaluation and optimization.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Effect, Option, Schema } from "effect"

/** Stable caller-assigned or content-derived example identity.
 * @since 0.6.0
 * @category schemas
 */
export const Id = Schema.String.pipe(Schema.brand("@scenesystems/effect-dsp/Example/Id"))

/** Example identity.
 * @since 0.6.0
 * @category type-level
 */
export type Id = typeof Id.Type

/**
 * Dataset row with labels independent of the module's output schema.
 *
 * @remarks
 * Record values remain `unknown`; construction does not validate them against a
 * module signature or establish label correctness. Metrics decide whether
 * absent labels can be scored. Metadata does not participate in content identity.
 *
 * @since 0.1.0
 * @category models
 */
export class Example extends Schema.Class<Example>("@scenesystems/effect-dsp/Example")({
  id: Schema.Option(Id).pipe(Schema.withConstructorDefault(Effect.succeed(Option.none<Id>()))),
  /** Fields passed to the evaluated module. */
  input: Schema.Record(Schema.String, Schema.Unknown),
  /** Raw labels used by metrics, never decoded through the output signature. */
  labels: Schema.Option(Schema.Record(Schema.String, Schema.Unknown)).pipe(
    Schema.withConstructorDefault(Effect.succeedNone)
  ),
  metadata: Schema.Option(Schema.Record(Schema.String, Schema.Unknown)).pipe(
    Schema.withConstructorDefault(Effect.succeedNone)
  )
}) {}

const Identity = Schema.Struct({
  input: Example.fields.input,
  labels: Schema.Array(Example.fields.input)
})

/** Resolves an explicit identity or hashes the canonical input and labels.
 * Non-JSON label/input values fail through digest's typed admission errors.
 * @since 0.6.0
 * @category combinators
 */
export const id = (example: Example) =>
  Option.match(example.id, {
    onSome: Effect.succeed,
    onNone: () =>
      ContentDigest.fromSchema(Identity, {
        input: example.input,
        labels: Option.toArray(example.labels)
      }).pipe(Effect.map((digest) => Schema.decodeSync(Id)(ContentDigest.toString(digest))))
  })
