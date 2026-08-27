/** Cooperative structural construction for projected Effect Schema ASTs. @internal */

import { Effect, MutableRef, SchemaAST } from "effect"

import { appendMutable, type EncodeState, scan } from "./schema-encode-model.js"

class ProjectedChildren {
  readonly children: ReadonlyArray<SchemaAST.AST>
  readonly changed: boolean

  constructor(children: ReadonlyArray<SchemaAST.AST>, changed: boolean) {
    this.children = children
    this.changed = changed
  }
}

const mapChildren = (
  length: number,
  child: (index: number) => SchemaAST.AST,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<ProjectedChildren> =>
  Effect.suspend(() => {
    const output = new Array<SchemaAST.AST>(length)
    const changed = MutableRef.make(false)
    return Effect.map(
      scan(cooperation, 0, (index) => index < length, (index) => {
        const source = child(index)
        return Effect.map(project(source), (projected) => {
          output[index] = projected
          if (projected !== source) MutableRef.set(changed, true)
        })
      }),
      () => new ProjectedChildren(output, MutableRef.get(changed))
    )
  })

export const projectDeclaration = (
  ast: SchemaAST.Declaration,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.map(
    mapChildren(ast.typeParameters.length, (index) => ast.typeParameters[index]!, project, cooperation),
    ({ changed, children }) =>
      changed ? new SchemaAST.Declaration(children, ast.decodeUnknown, ast.encodeUnknown, ast.annotations) : ast
  )

export const projectUnion = (
  ast: SchemaAST.Union,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.map(
    mapChildren(ast.types.length, (index) => ast.types[index]!, project, cooperation),
    ({ changed, children }) => changed ? SchemaAST.Union.make(children, ast.annotations) : ast
  )

export const projectTuple = (
  ast: SchemaAST.TupleType,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.flatMap(
    mapChildren(
      ast.elements.length + ast.rest.length,
      (index) =>
        index < ast.elements.length
          ? ast.elements[index]!.type
          : ast.rest[index - ast.elements.length]!.type,
      project,
      cooperation
    ),
    ({ changed, children }) => {
      if (!changed) return Effect.succeed(ast)
      const elements: Array<SchemaAST.OptionalType> = []
      const rest: Array<SchemaAST.Type> = []
      return Effect.map(
        Effect.zipRight(
          scan(cooperation, 0, (index) => index < ast.elements.length, (index) =>
            Effect.sync(() => {
              const element = ast.elements[index]!
              appendMutable(elements, new SchemaAST.OptionalType(children[index]!, element.isOptional))
            })),
          scan(cooperation, 0, (index) => index < ast.rest.length, (index) =>
            Effect.sync(() => {
              appendMutable(rest, new SchemaAST.Type(children[ast.elements.length + index]!))
            }))
        ),
        () => new SchemaAST.TupleType(elements, rest, ast.isReadonly, ast.annotations)
      )
    }
  )

export const projectRecord = (
  ast: SchemaAST.TypeLiteral,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.flatMap(
    mapChildren(
      ast.propertySignatures.length + ast.indexSignatures.length,
      (index) =>
        index < ast.propertySignatures.length
          ? ast.propertySignatures[index]!.type
          : ast.indexSignatures[index - ast.propertySignatures.length]!.type,
      project,
      cooperation
    ),
    ({ changed, children }) => {
      if (!changed) return Effect.succeed(ast)
      const properties: Array<SchemaAST.PropertySignature> = []
      const signatures: Array<SchemaAST.IndexSignature> = []
      return Effect.map(
        Effect.zipRight(
          scan(cooperation, 0, (index) => index < ast.propertySignatures.length, (index) =>
            Effect.sync(() => {
              const property = ast.propertySignatures[index]!
              appendMutable(
                properties,
                new SchemaAST.PropertySignature(
                  property.name,
                  children[index]!,
                  property.isOptional,
                  property.isReadonly
                )
              )
            })),
          scan(cooperation, 0, (index) => index < ast.indexSignatures.length, (index) =>
            Effect.sync(() => {
              const signature = ast.indexSignatures[index]!
              appendMutable(
                signatures,
                new SchemaAST.IndexSignature(
                  signature.parameter,
                  children[ast.propertySignatures.length + index]!,
                  signature.isReadonly
                )
              )
            }))
        ),
        () => new SchemaAST.TypeLiteral(properties, signatures, ast.annotations)
      )
    }
  )
