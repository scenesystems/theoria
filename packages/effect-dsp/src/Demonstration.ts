/**
 * Defines few-shot wire values and codecs compiled from module signatures.
 *
 * @since 0.4.0
 * @module
 */
import { Array as Arr, Data, Effect, Option, Record, Schema, Tuple } from "effect"
import { Id } from "./Example.js"
import { encodedFieldSchema, encodedFieldsToInfoArray } from "./internal/signature/fields.js"
import { decode, encode, Payload } from "./Payload.js"

/**
 * A schema-encoded input and expected output used as a few-shot example.
 * @since 0.4.0
 * @category models
 */
export class Demonstration extends Schema.Class<Demonstration>("@scenesystems/effect-dsp/Demonstration")({
  input: Schema.Record(Schema.String, Schema.Unknown),
  output: Schema.Record(Schema.String, Schema.Unknown),
  /** Source row identity for leave-one-out teacher execution. */
  exampleId: Schema.Option(Id).pipe(Schema.withConstructorDefault(Effect.succeedNone)),
  /** Teacher-generated evidence, independent of labeled-output completeness. @since 0.7.0 */
  augmented: Schema.Boolean.pipe(Schema.withConstructorDefault(Effect.succeed(false))),
  /** Labeled outputs may omit fields required by a destination predictor. */
  incomplete: Schema.Boolean.pipe(Schema.withConstructorDefault(Effect.succeed(false)))
}) {}

/**
 * Lossless input and output documents produced by a destination codec.
 * @since 0.4.0
 * @category schemas
 */
export const Documents = Schema.Tuple([Payload, Payload])
/**
 * Lossless input and output documents produced by a destination codec.
 * @since 0.4.0
 * @category models
 */
export type Documents = typeof Documents.Type

/**
 * Executable demonstration operations compiled from a destination signature.
 * Validation and equivalence use the encoded schemas and never rerun domain
 * transformations.
 * @since 0.4.0
 * @category models
 */
export class Codec extends Data.Class<{
  /** Projects labels onto destination fields, retaining missing outputs as incomplete. */
  readonly labeled: (value: Demonstration) => Effect.Effect<Demonstration, Schema.SchemaError>
  readonly decode: (value: unknown) => Effect.Effect<Demonstration, Schema.SchemaError>
  readonly encode: (value: Demonstration) => Effect.Effect<Documents, Schema.SchemaError>
  readonly decodeDocuments: (
    input: Payload,
    output: Payload
  ) => Effect.Effect<Demonstration, Schema.SchemaError>
  readonly equivalent: (
    left: Demonstration,
    right: Demonstration
  ) => Effect.Effect<boolean, Schema.SchemaError>
}> {}

const equivalentWire = <A, I>(schema: Schema.Codec<A, I>, left: unknown, right: unknown) =>
  Effect.gen(function*() {
    const first = yield* Schema.decodeUnknownEffect(schema)(left, { onExcessProperty: "error" })
    const second = yield* Schema.decodeUnknownEffect(schema)(right, { onExcessProperty: "error" })
    return Schema.toEquivalence(schema)(first, second)
  })

/**
 * Compiles a destination-specific codec from input and output schemas.
 * @since 0.4.0
 * @category constructors
 */
export const codec = <I, O, IDR, IER, ODR, OER>(
  inputSchema: Schema.Codec<I, Record.ReadonlyRecord<string, unknown>, IDR, IER>,
  outputSchema: Schema.Codec<O, Record.ReadonlyRecord<string, unknown>, ODR, OER>
): Codec => {
  const input = Schema.toEncoded(inputSchema)
  const output = Schema.toEncoded(outputSchema)
  const partialOutput = Schema.Struct(
    Record.fromEntries(
      Arr.map(
        encodedFieldsToInfoArray(outputSchema),
        (field) => Tuple.make(field.name, Schema.optionalKey(Option.getOrThrow(encodedFieldSchema(output, field.name))))
      )
    )
  )
  const full = Schema.Struct({
    input,
    output,
    exampleId: Demonstration.fields.exampleId,
    augmented: Schema.Boolean,
    incomplete: Schema.Literal(false)
  })
  const partial = Schema.Struct({
    input,
    output: partialOutput,
    exampleId: Demonstration.fields.exampleId,
    augmented: Schema.Boolean,
    incomplete: Schema.Literal(true)
  })
  const wire = Schema.Union([full, partial])
  return new Codec({
    labeled: (value) =>
      Effect.gen(function*() {
        const inputs = yield* Schema.decodeEffect(input)(value.input)
        const labels = yield* Schema.decodeEffect(partialOutput)(value.output)
        return new Demonstration({
          input: inputs,
          output: labels,
          exampleId: value.exampleId,
          incomplete: !Schema.is(output)(labels)
        })
      }),
    decode: (value) =>
      Schema.decodeUnknownEffect(wire)(value, { onExcessProperty: "error" }).pipe(
        Effect.map((demonstration) => new Demonstration(demonstration))
      ),
    encode: (demonstration) =>
      Schema.decodeEffect(wire)(demonstration, { onExcessProperty: "error" }).pipe(
        Effect.flatMap((validated) =>
          Effect.zip(
            encode(input, validated.input),
            encode(validated.incomplete ? partialOutput : output, validated.output)
          )
        )
      ),
    decodeDocuments: (inputDocument, outputDocument) =>
      Effect.gen(function*() {
        const inputValue = yield* decode(input, inputDocument, { onExcessProperty: "error" })
        const outputValue = yield* decode(output, outputDocument, { onExcessProperty: "error" })
        return new Demonstration({ input: inputValue, output: outputValue })
      }),
    equivalent: (left, right) =>
      equivalentWire(input, left.input, right.input).pipe(
        Effect.flatMap((equivalent) =>
          equivalent ? equivalentWire(output, left.output, right.output) : Effect.succeed(false)
        )
      )
  })
}
