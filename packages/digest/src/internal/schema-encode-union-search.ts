/** Effect Schema union discriminator search for cooperative encoding. @internal */

import { Array as Arr, MutableList, Option, SchemaAST } from "effect"

type Literal = readonly [PropertyKey, SchemaAST.Literal]

export class UnionBucket {
  readonly buckets: Record<string, MutableList.MutableList<SchemaAST.AST>> = {}
  readonly literals = MutableList.empty<SchemaAST.Literal>()
  readonly candidates = MutableList.empty<SchemaAST.AST>()
}

export class UnionSearchTree {
  readonly keys: Record<PropertyKey, UnionBucket> = {}
  readonly otherwise = MutableList.empty<SchemaAST.AST>()
  readonly candidates = MutableList.empty<SchemaAST.AST>()
}

const literals = (ast: SchemaAST.AST, direction: "Decode" | "Encode"): ReadonlyArray<Literal> => {
  if (SchemaAST.isDeclaration(ast)) {
    const surrogate = SchemaAST.getSurrogateAnnotation(ast)
    if (Option.isSome(surrogate)) return literals(surrogate.value, direction)
  }
  if (SchemaAST.isTypeLiteral(ast)) {
    return Arr.flatMap(ast.propertySignatures, (property) => {
      const type = direction === "Decode" ? SchemaAST.encodedAST(property.type) : SchemaAST.typeAST(property.type)
      return SchemaAST.isLiteral(type) && !property.isOptional ? [[property.name, type]] : []
    })
  }
  if (SchemaAST.isTupleType(ast)) {
    return Arr.flatMap(ast.elements, (element, index) => {
      const type = direction === "Decode" ? SchemaAST.encodedAST(element.type) : SchemaAST.typeAST(element.type)
      return SchemaAST.isLiteral(type) && !element.isOptional ? [[index, type]] : []
    })
  }
  if (SchemaAST.isRefinement(ast)) return literals(ast.from, direction)
  if (SchemaAST.isSuspend(ast)) return literals(ast.f(), direction)
  if (SchemaAST.isTransformation(ast)) return literals(direction === "Decode" ? ast.from : ast.to, direction)
  return []
}

export const makeUnionSearchTree = (
  ast: SchemaAST.Union,
  direction: "Decode" | "Encode"
): UnionSearchTree => {
  const tree = new UnionSearchTree()
  Arr.forEach(ast.types, (member) => {
    const tags = literals(member, direction)
    if (tags.length === 0) {
      MutableList.append(tree.otherwise, member)
      return
    }
    MutableList.append(tree.candidates, member)
    tags.some(([key, literal], index) => {
      const bucket = Option.getOrElse(Option.fromNullable(tree.keys[key]), () => {
        const created = new UnionBucket()
        tree.keys[key] = created
        return created
      })
      const hash = String(literal.literal)
      const existing = Object.prototype.hasOwnProperty.call(bucket.buckets, hash)
        ? Option.fromNullable(bucket.buckets[hash])
        : Option.none()
      if (Option.isSome(existing)) {
        if (index < tags.length - 1) return false
        MutableList.append(existing.value, member)
      } else {
        bucket.buckets[hash] = MutableList.make(member)
      }
      MutableList.append(bucket.literals, literal)
      MutableList.append(bucket.candidates, member)
      return Option.isNone(existing)
    })
  })
  return tree
}

export const expectedUnionDiscriminator = (bucket: UnionBucket): SchemaAST.AST =>
  SchemaAST.Union.make(Arr.fromIterable(bucket.literals))

export const getUnionBucket = (tree: UnionSearchTree, key: PropertyKey): UnionBucket =>
  Option.getOrElse(Option.fromNullable(tree.keys[key]), () => {
    const created = new UnionBucket()
    tree.keys[key] = created
    return created
  })
