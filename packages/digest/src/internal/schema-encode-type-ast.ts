/** Stack-safe cooperative projection of an Effect Schema type AST. @internal */

import { Array as Arr, Effect, MutableHashMap, MutableHashSet, MutableRef, Option, SchemaAST } from "effect"

import { appendMutable, cooperate, type EncodeState, scan } from "./schema-encode-model.js"
import { projectDeclaration, projectRecord, projectTuple, projectUnion } from "./schema-encode-type-ast-structure.js"

const preservedTransformationAnnotations = [
  SchemaAST.ExamplesAnnotationId,
  SchemaAST.DefaultAnnotationId,
  SchemaAST.JSONSchemaAnnotationId,
  SchemaAST.ArbitraryAnnotationId,
  SchemaAST.PrettyAnnotationId,
  SchemaAST.EquivalenceAnnotationId
]

class SuspendedProjection {
  readonly source: SchemaAST.Suspend
  readonly body: MutableRef.MutableRef<Option.Option<SchemaAST.AST>>

  constructor(source: SchemaAST.Suspend, body: MutableRef.MutableRef<Option.Option<SchemaAST.AST>>) {
    this.source = source
    this.body = body
  }
}

const transformationTarget = (ast: SchemaAST.Transformation): SchemaAST.AST => {
  const annotations: Record<symbol, unknown> = {}
  const hasPreserved = MutableRef.make(false)
  Arr.forEach(preservedTransformationAnnotations, (id) => {
    if (Object.prototype.hasOwnProperty.call(ast.annotations, id)) {
      annotations[id] = ast.annotations[id]
      MutableRef.set(hasPreserved, true)
    }
  })
  return MutableRef.get(hasPreserved) ? SchemaAST.annotations(ast.to, annotations) : ast.to
}

export class TypeAstProjector {
  readonly #cache = MutableHashMap.empty<SchemaAST.AST, SchemaAST.AST>()
  readonly #suspensions = MutableHashMap.empty<SchemaAST.Suspend, SuspendedProjection>()
  readonly #cooperation: EncodeState

  constructor(cooperation: EncodeState) {
    this.#cooperation = cooperation
  }

  project(ast: SchemaAST.AST): Effect.Effect<SchemaAST.AST> {
    return Effect.suspend(() =>
      Option.match(MutableHashMap.get(this.#cache, ast), {
        onNone: () => Effect.zipRight(cooperate(this.#cooperation), this.#projectUncached(ast)),
        onSome: Effect.succeed
      })
    )
  }

  resolve(ast: SchemaAST.Suspend): Effect.Effect<SchemaAST.AST> {
    return Effect.suspend(() =>
      Option.match(MutableHashMap.get(this.#suspensions, ast), {
        onNone: () => Effect.sync(ast.f),
        onSome: ({ body, source }) =>
          Option.match(MutableRef.get(body), {
            onNone: () =>
              Effect.flatMap(
                Effect.zipRight(cooperate(this.#cooperation), Effect.sync(source.f)),
                (resolved) =>
                  Effect.tap(this.project(resolved), (projected) =>
                    Effect.sync(() => {
                      MutableRef.set(body, Option.some(projected))
                    }))
              ),
            onSome: Effect.succeed
          })
      })
    )
  }

  seal(ast: SchemaAST.AST): Effect.Effect<void> {
    return Effect.suspend(() => {
      const pending: Array<SchemaAST.AST> = [ast]
      const visited = MutableHashSet.empty<SchemaAST.AST>()
      const append = (child: SchemaAST.AST): void => appendMutable(pending, child)
      return scan(this.#cooperation, 0, (index) => index < pending.length, (index) =>
        Effect.suspend(() => {
          const current = pending[index]!
          if (MutableHashSet.has(visited, current)) return Effect.void
          MutableHashSet.add(visited, current)
          if (SchemaAST.isSuspend(current)) {
            return Option.match(MutableHashMap.get(this.#suspensions, current), {
              onNone: () => Effect.void,
              onSome: () => Effect.map(this.resolve(current), append)
            })
          }
          if (SchemaAST.isDeclaration(current)) {
            return scan(this.#cooperation, 0, (child) =>
              child < current.typeParameters.length, (child) =>
              Effect.sync(() =>
                append(current.typeParameters[child]!)
              ))
          }
          if (SchemaAST.isUnion(current)) {
            return scan(this.#cooperation, 0, (child) =>
              child < current.types.length, (child) =>
              Effect.sync(() =>
                append(current.types[child]!)
              ))
          }
          if (SchemaAST.isTupleType(current)) {
            return Effect.zipRight(
              scan(this.#cooperation, 0, (child) =>
                child < current.elements.length, (child) =>
                Effect.sync(() =>
                  append(current.elements[child]!.type)
                )),
              scan(this.#cooperation, 0, (child) =>
                child < current.rest.length, (child) =>
                Effect.sync(() =>
                  append(current.rest[child]!.type)
                ))
            )
          }
          if (SchemaAST.isTypeLiteral(current)) {
            return Effect.zipRight(
              scan(this.#cooperation, 0, (child) =>
                child < current.propertySignatures.length, (child) =>
                Effect.sync(() =>
                  append(current.propertySignatures[child]!.type)
                )),
              scan(this.#cooperation, 0, (child) =>
                child < current.indexSignatures.length, (child) =>
                Effect.sync(() =>
                  append(current.indexSignatures[child]!.type)
                ))
            )
          }
          if (SchemaAST.isRefinement(current)) {
            append(current.from)
          } else if (SchemaAST.isTransformation(current)) {
            append(current.from)
            append(current.to)
          }
          return Effect.void
        }))
    })
  }

  #remember(source: SchemaAST.AST, projected: SchemaAST.AST): SchemaAST.AST {
    MutableHashMap.set(this.#cache, source, projected)
    return projected
  }

  #projectUncached(ast: SchemaAST.AST): Effect.Effect<SchemaAST.AST> {
    if (SchemaAST.isSuspend(ast)) {
      const body = MutableRef.make(Option.none<SchemaAST.AST>())
      const projected = new SchemaAST.Suspend(
        () => Option.getOrThrow(MutableRef.get(body)),
        ast.annotations
      )
      this.#remember(ast, projected)
      MutableHashMap.set(this.#suspensions, projected, new SuspendedProjection(ast, body))
      return Effect.succeed(projected)
    }
    if (SchemaAST.isTransformation(ast)) {
      return Effect.flatMap(
        this.project(transformationTarget(ast)),
        (projected) => Effect.succeed(this.#remember(ast, projected))
      )
    }
    if (SchemaAST.isRefinement(ast)) {
      return Effect.map(
        this.project(ast.from),
        (from) =>
          this.#remember(ast, from === ast.from ? ast : new SchemaAST.Refinement(from, ast.filter, ast.annotations))
      )
    }
    if (SchemaAST.isDeclaration(ast)) {
      return Effect.map(
        projectDeclaration(ast, (child) => this.project(child), this.#cooperation),
        (projected) => this.#remember(ast, projected)
      )
    }
    if (SchemaAST.isUnion(ast)) {
      return Effect.map(
        projectUnion(ast, (child) => this.project(child), this.#cooperation),
        (projected) => this.#remember(ast, projected)
      )
    }
    if (SchemaAST.isTupleType(ast)) {
      return Effect.map(
        projectTuple(ast, (child) => this.project(child), this.#cooperation),
        (projected) => this.#remember(ast, projected)
      )
    }
    if (SchemaAST.isTypeLiteral(ast)) {
      return Effect.map(
        projectRecord(ast, (child) => this.project(child), this.#cooperation),
        (projected) => this.#remember(ast, projected)
      )
    }
    return Effect.succeed(this.#remember(ast, ast))
  }
}

export const dropRightRefinement = (
  ast: SchemaAST.AST,
  cooperation: EncodeState
): Effect.Effect<SchemaAST.AST> =>
  Effect.iterate(ast, {
    while: SchemaAST.isRefinement,
    body: (current) => Effect.as(cooperate(cooperation), current.from)
  })

export const projectLiteral = (
  ast: SchemaAST.AST,
  direction: "Decode" | "Encode",
  cooperation: EncodeState
): Effect.Effect<Option.Option<SchemaAST.Literal>> =>
  Effect.map(
    Effect.iterate(ast, {
      while: (current) =>
        SchemaAST.isTransformation(current) || (direction === "Decode" && SchemaAST.isRefinement(current)),
      body: (current) =>
        Effect.as(
          cooperate(cooperation),
          SchemaAST.isTransformation(current)
            ? direction === "Decode" ? current.from : transformationTarget(current)
            : SchemaAST.isRefinement(current)
            ? current.from
            : current
        )
    }),
    (projected) => SchemaAST.isLiteral(projected) ? Option.some(projected) : Option.none()
  )
