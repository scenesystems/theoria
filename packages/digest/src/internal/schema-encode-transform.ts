/** Effect Schema transformation execution for cooperative encoding. @internal */

import { Array as Arr, Effect, Either, Option, ParseResult, Predicate, Schema, SchemaAST } from "effect"

import type { EncodeState, SemanticResult } from "./schema-encode-model.js"
import { cooperate } from "./schema-encode-model.js"

const transformProperties = (
  transformation: SchemaAST.TypeLiteralTransformation,
  input: Record<PropertyKey, unknown>,
  direction: "Decode" | "Encode",
  cooperation: EncodeState
): Effect.Effect<SemanticResult> =>
  Effect.map(
    Effect.iterate(0, {
      while: (index) => index < transformation.propertySignatureTransformations.length,
      body: (index) =>
        Effect.zipRight(
          cooperate(cooperation),
          Effect.sync(() => {
            const property = Arr.unsafeGet(transformation.propertySignatureTransformations, index)
            const keys = direction === "Decode" ? [property.from, property.to] : [property.to, property.from]
            const from = Arr.unsafeGet(keys, 0)
            const to = Arr.unsafeGet(keys, 1)
            const apply = direction === "Decode" ? property.decode : property.encode
            const value = apply(
              Object.prototype.hasOwnProperty.call(input, from) ? Option.some(input[from]) : Option.none()
            )
            Reflect.deleteProperty(input, from)
            if (Option.isSome(value)) input[to] = value.value
            return index + 1
          })
        )
    }),
    () => Either.right(input)
  )

export const transform = (
  transformation: SchemaAST.TransformationKind,
  input: unknown,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  ast: SchemaAST.Transformation,
  original: unknown,
  cooperation: EncodeState
): Effect.Effect<SemanticResult> => {
  if (SchemaAST.isFinalTransformation(transformation)) {
    const wrapped = new SchemaAST.FinalTransformation(
      (value, parseOptions) => transformation.decode(value, parseOptions, ast, original),
      (value, parseOptions) => transformation.encode(value, parseOptions, ast, original)
    )
    const wrapper = Schema.make<unknown, unknown, never>(
      new SchemaAST.Transformation(SchemaAST.unknownKeyword, SchemaAST.unknownKeyword, wrapped)
    )
    const parsed = direction === "Decode"
      ? ParseResult.decode(wrapper)(input, options)
      : ParseResult.encode(wrapper)(input, options)
    return Effect.succeed(
      ParseResult.mapError(
        parsed,
        (issue) => issue._tag === "Transformation" && issue.kind === "Transformation" ? issue.issue : issue
      )
    )
  }
  if (SchemaAST.isComposeTransformation(transformation)) return Effect.succeed(Either.right(input))
  return transformProperties(
    transformation,
    Predicate.isRecord(input) ? input : {},
    direction,
    cooperation
  )
}
