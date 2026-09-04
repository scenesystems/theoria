/** Cooperative structural construction for projected Effect Schema ASTs. @internal */

import { Array as Arr, Effect, SchemaAST } from "effect"

import { appendMutable, cooperate, type EncodeState, scanItems } from "./schema-encode-model.js"

class ProjectedChildren {
  readonly children: ReadonlyArray<SchemaAST.AST>
  readonly changed: boolean

  constructor(children: ReadonlyArray<SchemaAST.AST>, changed: boolean) {
    this.children = children
    this.changed = changed
  }
}

const mapChildren = (
  sources: ReadonlyArray<SchemaAST.AST>,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<ProjectedChildren> =>
  Effect.map(
    Effect.forEach(sources, (source) => Effect.zipRight(cooperate(cooperation), project(source))),
    (children) =>
      new ProjectedChildren(children, Arr.some(Arr.zip(children, sources), ([child, source]) => child !== source))
  )

export const projectDeclaration = (
  ast: SchemaAST.Declaration,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.map(
    mapChildren(ast.typeParameters, project, cooperation),
    ({ changed, children }) =>
      changed ? new SchemaAST.Declaration(children, ast.decodeUnknown, ast.encodeUnknown, ast.annotations) : ast
  )

export const projectUnion = (
  ast: SchemaAST.Union,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.map(
    mapChildren(ast.types, project, cooperation),
    ({ changed, children }) => changed ? SchemaAST.Union.make(children, ast.annotations) : ast
  )

export const projectTuple = (
  ast: SchemaAST.TupleType,
  project: (ast: SchemaAST.AST) => Effect.Effect<SchemaAST.AST>,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.flatMap(
    mapChildren(
      Arr.appendAll(
        Arr.map(ast.elements, (element) => element.type),
        Arr.map(ast.rest, (type) => type.type)
      ),
      project,
      cooperation
    ),
    ({ changed, children }) => {
      if (!changed) return Effect.succeed(ast)
      const [elementChildren, restChildren] = Arr.splitAt(children, ast.elements.length)
      const elements: Array<SchemaAST.OptionalType> = []
      const rest: Array<SchemaAST.Type> = []
      return Effect.map(
        Effect.zipRight(
          scanItems(cooperation, Arr.zip(ast.elements, elementChildren), ([element, child]) =>
            Effect.sync(() =>
              appendMutable(elements, new SchemaAST.OptionalType(child, element.isOptional))
            )),
          scanItems(cooperation, restChildren, (child) =>
            Effect.sync(() =>
              appendMutable(rest, new SchemaAST.Type(child))
            ))
        ),
        () =>
          new SchemaAST.TupleType(elements, rest, ast.isReadonly, ast.annotations)
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
      Arr.appendAll(
        Arr.map(ast.propertySignatures, (property) => property.type),
        Arr.map(ast.indexSignatures, (signature) => signature.type)
      ),
      project,
      cooperation
    ),
    ({ changed, children }) => {
      if (!changed) return Effect.succeed(ast)
      const [propertyChildren, signatureChildren] = Arr.splitAt(children, ast.propertySignatures.length)
      const properties: Array<SchemaAST.PropertySignature> = []
      const signatures: Array<SchemaAST.IndexSignature> = []
      return Effect.map(
        Effect.zipRight(
          scanItems(cooperation, Arr.zip(ast.propertySignatures, propertyChildren), ([property, child]) =>
            Effect.sync(() =>
              appendMutable(
                properties,
                new SchemaAST.PropertySignature(property.name, child, property.isOptional, property.isReadonly)
              )
            )),
          scanItems(cooperation, Arr.zip(ast.indexSignatures, signatureChildren), ([signature, child]) =>
            Effect.sync(() =>
              appendMutable(signatures, new SchemaAST.IndexSignature(signature.parameter, child, signature.isReadonly))
            ))
        ),
        () =>
          new SchemaAST.TypeLiteral(properties, signatures, ast.annotations)
      )
    }
  )
