/** Effect Schema union discriminator search for cooperative encoding. @internal */

import { Array as Arr, Effect, MutableRef, Option, SchemaAST } from "effect"

import { appendMutable, cooperate, type EncodeState, scan, scanItems } from "./schema-encode-model.js"
import { projectLiteral, type TypeAstProjector } from "./schema-encode-type-ast.js"

type Literal = readonly [PropertyKey, SchemaAST.Literal]

const getOwn = <K extends PropertyKey, V>(record: Record<K, V>, key: K): Option.Option<V> =>
  Object.prototype.hasOwnProperty.call(record, key) ? Option.fromNullable(record[key]) : Option.none()

const setOwn = <K extends PropertyKey, V>(record: Record<K, V>, key: K, value: V): V => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  })
  return value
}

export class UnionBucket {
  readonly buckets: Record<string, Array<SchemaAST.AST>> = {}
  readonly literals: Array<SchemaAST.Literal> = []
  readonly candidates: Array<SchemaAST.AST> = []
}

export class UnionSearchTree {
  readonly keys: Record<PropertyKey, UnionBucket> = {}
  readonly otherwise: Array<SchemaAST.AST> = []
  readonly candidates: Array<SchemaAST.AST> = []
}

const unwrap = (
  ast: SchemaAST.AST,
  direction: "Decode" | "Encode",
  cooperation: EncodeState,
  typeAst: TypeAstProjector
): Effect.Effect<SchemaAST.AST> =>
  Effect.iterate(ast, {
    while: (current) => {
      if (SchemaAST.isDeclaration(current)) return Option.isSome(SchemaAST.getSurrogateAnnotation(current))
      return SchemaAST.isRefinement(current) || SchemaAST.isSuspend(current) || SchemaAST.isTransformation(current)
    },
    body: (current) =>
      Effect.zipRight(
        cooperate(cooperation),
        SchemaAST.isSuspend(current)
          ? typeAst.resolve(current)
          : Effect.succeed(
            SchemaAST.isDeclaration(current)
              ? Option.getOrThrow(SchemaAST.getSurrogateAnnotation(current))
              : SchemaAST.isRefinement(current)
              ? current.from
              : SchemaAST.isTransformation(current)
              ? direction === "Decode" ? current.from : current.to
              : current
          )
      )
  })

const literals = (
  ast: SchemaAST.AST,
  direction: "Decode" | "Encode",
  cooperation: EncodeState,
  typeAst: TypeAstProjector
): Effect.Effect<ReadonlyArray<Literal>> =>
  Effect.flatMap(unwrap(ast, direction, cooperation, typeAst), (unwrapped) => {
    const output: Array<Literal> = []
    if (SchemaAST.isTypeLiteral(unwrapped)) {
      return Effect.as(
        scanItems(cooperation, unwrapped.propertySignatures, (property) => {
          if (property.isOptional) return Effect.void
          return Effect.map(projectLiteral(property.type, direction, cooperation), (literal) => {
            if (Option.isSome(literal)) appendMutable(output, [property.name, literal.value])
          })
        }),
        output
      )
    }
    if (SchemaAST.isTupleType(unwrapped)) {
      return Effect.as(
        scanItems(cooperation, unwrapped.elements, (element, index) => {
          if (element.isOptional) return Effect.void
          return Effect.map(projectLiteral(element.type, direction, cooperation), (literal) => {
            if (Option.isSome(literal)) appendMutable(output, [index, literal.value])
          })
        }),
        output
      )
    }
    return Effect.succeed(output)
  })

export const makeUnionSearchTree = (
  ast: SchemaAST.Union,
  direction: "Decode" | "Encode",
  cooperation: EncodeState,
  typeAst: TypeAstProjector
): Effect.Effect<UnionSearchTree> => {
  const tree = new UnionSearchTree()
  return Effect.as(
    scanItems(
      cooperation,
      ast.types,
      (member) =>
        Effect.flatMap(literals(member, direction, cooperation, typeAst), (tags) => {
          if (tags.length === 0) {
            appendMutable(tree.otherwise, member)
            return Effect.void
          }
          appendMutable(tree.candidates, member)
          const selected = MutableRef.make(false)
          return scan(
            cooperation,
            0,
            (tagIndex) => tagIndex < tags.length && !MutableRef.get(selected),
            (tagIndex) =>
              Effect.sync(() => {
                const tag = Arr.get(tags, tagIndex)
                if (Option.isNone(tag)) return
                const [key, literal] = tag.value
                const bucket = Option.getOrElse(getOwn(tree.keys, key), () => {
                  return setOwn(tree.keys, key, new UnionBucket())
                })
                const hash = String(literal.literal)
                const existing = getOwn(bucket.buckets, hash)
                if (Option.isSome(existing) && tagIndex < tags.length - 1) return
                if (Option.isSome(existing)) appendMutable(existing.value, member)
                else setOwn(bucket.buckets, hash, [member])
                appendMutable(bucket.literals, literal)
                appendMutable(bucket.candidates, member)
                MutableRef.set(selected, Option.isNone(existing))
              })
          )
        })
    ),
    tree
  )
}

export const expectedUnionDiscriminator = (bucket: UnionBucket): SchemaAST.AST => SchemaAST.Union.make(bucket.literals)

export const getUnionBucket = (tree: UnionSearchTree, key: PropertyKey): UnionBucket =>
  Option.getOrElse(getOwn(tree.keys, key), () => {
    const created = new UnionBucket()
    return setOwn(tree.keys, key, created)
  })
