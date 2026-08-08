/** Cooperative structural interpreter for Effect Schema encoding. @internal */

import { Effect, Either, MutableHashMap, Option, ParseResult, Schema, SchemaAST } from "effect"

import {
  cooperate,
  EncodeState,
  flatMapResult,
  mapResultError,
  orElseResult,
  type Parse,
  parseOptions,
  type SemanticResult
} from "./schema-encode-model.js"
import { parseRecord } from "./schema-encode-records.js"
import { transform } from "./schema-encode-transform.js"
import { parseTuple } from "./schema-encode-tuples.js"
import { dropRightRefinement, TypeAstProjector } from "./schema-encode-type-ast.js"
import { parseUnion } from "./schema-encode-unions.js"

type LeafParser = (
  input: unknown,
  options?: SchemaAST.ParseOptions
) => SemanticResult

class LeafParsers {
  readonly decode: LeafParser
  readonly encode: LeafParser

  constructor(ast: SchemaAST.AST) {
    const schema = Schema.make<unknown, unknown, never>(ast)
    this.decode = ParseResult.decode(schema)
    this.encode = ParseResult.encode(schema)
  }
}

const delegate = (
  ast: SchemaAST.AST,
  input: unknown,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  cache: MutableHashMap.MutableHashMap<SchemaAST.AST, LeafParsers>
): Effect.Effect<SemanticResult> =>
  Effect.sync(() => {
    const parsers = Option.getOrElse(MutableHashMap.get(cache, ast), () => {
      const created = new LeafParsers(ast)
      MutableHashMap.set(cache, ast, created)
      return created
    })
    return direction === "Decode"
      ? parsers.decode(input, options)
      : parsers.encode(input, options)
  })

const hasStableFilter = (ast: SchemaAST.Refinement): boolean =>
  Option.getOrElse(
    SchemaAST.getAnnotation<boolean>(ast, Symbol.for("effect/annotation/StableFilter")),
    () => false
  )

const refinement = (
  ast: SchemaAST.Refinement,
  input: unknown,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  parse: Parse,
  cooperation: EncodeState,
  typeAst: TypeAstProjector
): Effect.Effect<SemanticResult> => {
  if (direction === "Encode") {
    return Effect.flatMap(
      typeAst.project(ast),
      (projected) =>
        flatMapResult(
          Effect.zipRight(
            cooperate(cooperation),
            Effect.suspend(() => parse(projected, input, "Decode", options))
          ),
          (value) =>
            Effect.flatMap(
              dropRightRefinement(ast.from, cooperation),
              (encoded) =>
                Effect.zipRight(
                  cooperate(cooperation),
                  Effect.suspend(() => parse(encoded, value, "Encode", options))
                )
            )
        )
    )
  }

  const allErrors = options?.errors === "all"
  const from = orElseResult(
    Effect.zipRight(
      cooperate(cooperation),
      Effect.suspend(() => parse(ast.from, input, "Decode", options))
    ),
    (issue) => {
      const wrapped = new ParseResult.Refinement(ast, input, "From", issue)
      if (allErrors && hasStableFilter(ast) && ParseResult.isComposite(issue)) {
        return Option.match(ast.filter(input, options, ast), {
          onNone: () => Either.left(wrapped),
          onSome: (predicate) =>
            Either.left(
              new ParseResult.Composite(ast, input, [
                wrapped,
                new ParseResult.Refinement(ast, input, "Predicate", predicate)
              ])
            )
        })
      }
      return Either.left(wrapped)
    }
  )
  return flatMapResult(from, (value) =>
    Effect.sync(() =>
      Option.match(ast.filter(value, options, ast), {
        onNone: () => Either.right(value),
        onSome: (issue) => Either.left(new ParseResult.Refinement(ast, input, "Predicate", issue))
      })
    ))
}

const transformation = (
  ast: SchemaAST.Transformation,
  input: unknown,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  parse: Parse,
  cooperation: EncodeState
): Effect.Effect<SemanticResult> => {
  const from = direction === "Decode" ? ast.from : ast.to
  const to = direction === "Decode" ? ast.to : ast.from
  return flatMapResult(
    mapResultError(
      Effect.zipRight(
        cooperate(cooperation),
        Effect.suspend(() => parse(from, input, direction, options))
      ),
      (issue) => new ParseResult.Transformation(ast, input, direction === "Decode" ? "Encoded" : "Type", issue)
    ),
    (value) =>
      flatMapResult(
        mapResultError(
          transform(ast.transformation, value, direction, options, ast, input, cooperation),
          (issue) => new ParseResult.Transformation(ast, input, "Transformation", issue)
        ),
        (transformed) =>
          mapResultError(
            Effect.zipRight(
              cooperate(cooperation),
              Effect.suspend(() => parse(to, transformed, direction, options))
            ),
            (issue) =>
              new ParseResult.Transformation(
                ast,
                input,
                direction === "Decode" ? "Type" : "Encoded",
                issue
              )
          )
      )
  )
}

const makeParse = (cooperation: EncodeState): Parse => {
  const cache = MutableHashMap.empty<SchemaAST.AST, LeafParsers>()
  const suspended = MutableHashMap.empty<SchemaAST.Suspend, SchemaAST.AST>()
  const typeAst = new TypeAstProjector(cooperation)

  const parse: Parse = (ast, input, direction, inherited) => {
    const options = parseOptions(ast, inherited)
    const complete = (parsed: Effect.Effect<SemanticResult>): Effect.Effect<SemanticResult> => {
      if (direction === "Encode") return parsed
      return Option.match(SchemaAST.getDecodingFallbackAnnotation(ast), {
        onNone: () => parsed,
        onSome: (fallback) => orElseResult(parsed, fallback)
      })
    }

    if (SchemaAST.isTupleType(ast)) {
      return complete(parseTuple(ast, input, parse, direction, options, cooperation))
    }
    if (SchemaAST.isTypeLiteral(ast)) {
      return complete(parseRecord(ast, input, parse, direction, options, cooperation))
    }
    if (SchemaAST.isUnion(ast)) {
      return complete(parseUnion(ast, input, parse, direction, options, cooperation, typeAst))
    }
    if (SchemaAST.isRefinement(ast)) {
      return complete(refinement(ast, input, direction, options, parse, cooperation, typeAst))
    }
    if (SchemaAST.isTransformation(ast)) {
      return complete(transformation(ast, input, direction, options, parse, cooperation))
    }
    if (SchemaAST.isSuspend(ast)) {
      return complete(Effect.suspend(() => {
        const cached = MutableHashMap.get(suspended, ast)
        if (Option.isSome(cached)) return parse(cached.value, input, direction, options)
        return Effect.flatMap(typeAst.resolve(ast), (resolved) => {
          MutableHashMap.set(suspended, ast, resolved)
          return parse(resolved, input, direction, options)
        })
      }))
    }
    if (SchemaAST.isDeclaration(ast)) {
      return Effect.zipRight(typeAst.seal(ast), delegate(ast, input, direction, inherited, cache))
    }
    return delegate(ast, input, direction, inherited, cache)
  }
  return parse
}

export const encodeSchemaCooperatively = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A
): Effect.Effect<unknown, ParseResult.ParseError> =>
  Effect.suspend(() =>
    Effect.mapError(
      Effect.flatten(
        makeParse(new EncodeState())(schema.ast, value, "Encode", SchemaAST.defaultParseOption)
      ),
      ParseResult.parseError
    )
  )
