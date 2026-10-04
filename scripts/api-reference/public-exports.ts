import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Match,
  Option,
  Order,
  type Path,
  Record,
  Result,
  Schema
} from "effect"
import * as Str from "effect/String"
import { Comment, type DeclarationReflection, type ReferenceReflection, ReflectionKind } from "typedoc"

import { type ApiImportKind, ApiImportKindSchema, ApiReferenceGenerationError } from "./model.js"
import { type PackagePublicEntrypoint, SourceFilePath, toForwardSlashes } from "./source.js"

export const PackagePublicExport = Schema.Struct({
  subpath: Schema.String,
  exportName: Schema.String,
  kind: ApiImportKindSchema,
  sourceFile: SourceFilePath,
  summary: Schema.String,
  since: Schema.String,
  category: Schema.String
})
export type PackagePublicExport = typeof PackagePublicExport.Type

// A re-exported symbol that TypeDoc has already documented elsewhere in the
// module appears as a Reference reflection; its documentation lives on the
// target.
const resolvedReflection = (reflection: DeclarationReflection): DeclarationReflection =>
  Option.liftPredicate(
    (candidate: DeclarationReflection): candidate is ReferenceReflection => candidate.isReference()
  )(reflection).pipe(
    Option.flatMap((reference) => Option.fromNullishOr(reference.tryGetTargetReflectionDeep())),
    Option.filter((target): target is DeclarationReflection => target.isDeclaration()),
    Option.getOrElse(() => reflection)
  )

const typeOnlyKinds = Arr.make(ReflectionKind.Interface, ReflectionKind.TypeAlias)

// One exported name can carry several declarations (a Schema `const` merged
// with its `type` alias is the common case). The export is a namespace when
// any declaration is one, a type only when every declaration is, else a value.
const exportKind = (exportName: string, reflections: ReadonlyArray<DeclarationReflection>): ApiImportKind => {
  return Match.value(exportName).pipe(
    Match.when("default", (): ApiImportKind => "default"),
    Match.orElse(() =>
      Bool.match(Arr.some(reflections, (reflection) => reflection.kindOf(ReflectionKind.Namespace)), {
        onTrue: (): ApiImportKind => "namespace",
        onFalse: () =>
          Bool.match(Arr.every(reflections, (reflection) => reflection.kindOf(typeOnlyKinds)), {
            onTrue: (): ApiImportKind => "type",
            onFalse: (): ApiImportKind => "value"
          })
      })
    )
  )
}

// Documentation is read from the declaration that matches the export's kind
// first, so a value export shows its value documentation even when a type
// alias of the same name is documented too.
const matchesKind = (kind: ApiImportKind, reflection: DeclarationReflection): boolean =>
  Bool.match(Bool.or(Str.Equivalence(kind, "type"), Str.Equivalence(kind, "namespace")), {
    onTrue: () => reflection.kindOf(Arr.append(typeOnlyKinds, ReflectionKind.Namespace)),
    onFalse: () => Bool.not(reflection.kindOf(typeOnlyKinds))
  })

const nonEmpty = (value: string): Option.Option<string> => {
  const trimmed = Str.trim(value)
  return Bool.match(Str.isEmpty(trimmed), { onTrue: Option.none, onFalse: () => Option.some(trimmed) })
}

// Function documentation is attached to signatures rather than the
// declaration, so every comment TypeDoc associated with the export is a
// candidate. The first comment carrying the requested content wins.
const commentsFor = (reflection: DeclarationReflection): ReadonlyArray<Comment> =>
  Arr.getSomes(
    Arr.prepend(
      Arr.map(reflection.getAllSignatures(), (signature) => Option.fromNullishOr(signature.comment)),
      Option.fromNullishOr(reflection.comment)
    )
  )

const summaryOf = (comments: ReadonlyArray<Comment>): Option.Option<string> =>
  Arr.findFirst(
    Arr.map(comments, (comment) => nonEmpty(Comment.combineDisplayParts(comment.summary))),
    Option.isSome
  ).pipe(Option.flatten)

const tagOf = (comments: ReadonlyArray<Comment>, tag: `@${string}`): Option.Option<string> =>
  Arr.findFirst(
    Arr.map(comments, (comment) =>
      nonEmpty(
        Comment.combineDisplayParts(
          Option.match(Option.fromNullishOr(comment.getTag(tag)), {
            onNone: Arr.empty,
            onSome: (commentTag) => commentTag.content
          })
        )
      )),
    Option.isSome
  ).pipe(Option.flatten)

const declarationSourceFile = (
  path: Path.Path,
  packageRoot: string,
  entrypoint: PackagePublicEntrypoint,
  reflection: DeclarationReflection
): SourceFilePath =>
  Option.match(Arr.head(Option.fromNullishOr(reflection.sources).pipe(Option.getOrElse(Arr.empty))), {
    onNone: () => entrypoint.sourceFile,
    onSome: (source) => ({
      absolute: source.fullFileName,
      relative: toForwardSlashes(path, path.relative(packageRoot, source.fullFileName))
    })
  })

const exportKey = (entry: PackagePublicExport): string => `${entry.subpath}::${entry.exportName}::${entry.kind}`

class PublicExportsInput extends Data.Class<{
  readonly path: Path.Path
  readonly packageName: string
  readonly packageRoot: string
  readonly entrypoint: PackagePublicEntrypoint
  readonly reflection: DeclarationReflection
}> {}

export const publicExportsFromReflection = (
  input: ConstructorParameters<typeof PublicExportsInput>[0]
): Effect.Effect<ReadonlyArray<PackagePublicExport>, ApiReferenceGenerationError> =>
  Effect.gen(function*() {
    const groups = Record.values(
      Arr.groupBy(
        Option.fromNullishOr(input.reflection.children).pipe(Option.getOrElse(Arr.empty)),
        (child) => child.name
      )
    )
    const entries = Arr.map(groups, (group): Result.Result<PackagePublicExport, string> => {
      const exportName = Arr.headNonEmpty(group).name
      const resolved = Arr.map(group, resolvedReflection)
      const kind = exportKind(exportName, resolved)
      const candidates = Arr.zip(group, resolved)
      const preferred = Arr.filter(candidates, ([, target]) => matchesKind(kind, target))
      const rest = Arr.filter(candidates, ([, target]) => Bool.not(matchesKind(kind, target)))
      // TypeDoc comments contain reflection back-references. Effect's structural
      // deduplication recursively compares those cyclic graphs and can never
      // complete; ordering already makes repeated comments harmless here.
      const comments = Arr.flatMap(
        Arr.appendAll(preferred, rest),
        ([child, target]: readonly [DeclarationReflection, DeclarationReflection]) =>
          Arr.appendAll(commentsFor(child), commentsFor(target))
      )
      const summary = summaryOf(comments)
      const since = tagOf(comments, "@since")
      const category = tagOf(comments, "@category")

      return Option.match(Option.all({ summary, since, category }), {
        onNone: () => {
          const missing = Arr.getSomes(Arr.make(
            Bool.match(Option.isNone(summary), {
              onTrue: () => Option.some("summary"),
              onFalse: Option.none
            }),
            Bool.match(Option.isNone(since), { onTrue: () => Option.some("@since"), onFalse: Option.none }),
            Bool.match(Option.isNone(category), { onTrue: () => Option.some("@category"), onFalse: Option.none })
          ))
          return Result.fail(`${input.entrypoint.subpath}#${exportName} (${Arr.join(missing, ", ")})`)
        },
        onSome: (documentation) =>
          Result.succeed({
            subpath: input.entrypoint.subpath,
            exportName,
            kind,
            sourceFile: declarationSourceFile(
              input.path,
              input.packageRoot,
              input.entrypoint,
              Arr.headNonEmpty(resolved)
            ),
            summary: documentation.summary,
            since: documentation.since,
            category: documentation.category
          })
      })
    })
    // Result uses its success channel on the left and failure channel on the
    // right, which is the opposite ordering from Either.
    const [publicExports, incomplete] = Arr.separate(entries)

    return yield* Bool.match(Arr.isReadonlyArrayNonEmpty(incomplete), {
      onTrue: () =>
        Effect.fail(
          new ApiReferenceGenerationError({
            packageName: input.packageName,
            detail: `public API documentation is incomplete: ${Arr.join(incomplete, ", ")}`
          })
        ),
      onFalse: () =>
        Effect.succeed(Arr.sort(
          publicExports,
          Order.mapInput(
            Order.make<string>((left, right) => Str.localeCompare(right)(left)),
            exportKey
          )
        ))
    })
  })
