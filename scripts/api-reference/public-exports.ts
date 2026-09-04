import type { Path } from "@effect/platform"
import { Array as Arr, Effect, Either, Option, Record, Schema } from "effect"
import { Comment, type DeclarationReflection, ReflectionKind } from "typedoc"

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
  reflection.isReference()
    ? Option.fromNullable(reflection.tryGetTargetReflectionDeep()).pipe(
      Option.filter((target): target is DeclarationReflection => target.isDeclaration()),
      Option.getOrElse(() => reflection)
    )
    : reflection

const typeOnlyKinds = ReflectionKind.Interface | ReflectionKind.TypeAlias

// One exported name can carry several declarations (a Schema `const` merged
// with its `type` alias is the common case). The export is a namespace when
// any declaration is one, a type only when every declaration is, else a value.
const exportKind = (exportName: string, reflections: ReadonlyArray<DeclarationReflection>): ApiImportKind => {
  if (exportName === "default") return "default"
  if (reflections.some((reflection) => reflection.kindOf(ReflectionKind.Namespace))) return "namespace"
  if (reflections.every((reflection) => reflection.kindOf(typeOnlyKinds))) return "type"
  return "value"
}

// Documentation is read from the declaration that matches the export's kind
// first, so a value export shows its value documentation even when a type
// alias of the same name is documented too.
const matchesKind = (kind: ApiImportKind, reflection: DeclarationReflection): boolean =>
  kind === "type" || kind === "namespace"
    ? reflection.kindOf(typeOnlyKinds | ReflectionKind.Namespace)
    : !reflection.kindOf(typeOnlyKinds)

const nonEmpty = (value: string): Option.Option<string> => {
  const trimmed = value.trim()
  return trimmed.length === 0 ? Option.none() : Option.some(trimmed)
}

// Function documentation is attached to signatures rather than the
// declaration, so every comment TypeDoc associated with the export is a
// candidate. The first comment carrying the requested content wins.
const commentsFor = (reflection: DeclarationReflection): ReadonlyArray<Comment> =>
  Arr.getSomes([
    Option.fromNullable(reflection.comment),
    ...Arr.map(reflection.getAllSignatures(), (signature) => Option.fromNullable(signature.comment))
  ])

const summaryOf = (comments: ReadonlyArray<Comment>): Option.Option<string> =>
  Arr.findFirst(
    Arr.map(comments, (comment) => nonEmpty(Comment.combineDisplayParts(comment.summary))),
    Option.isSome
  ).pipe(Option.flatten)

const tagOf = (comments: ReadonlyArray<Comment>, tag: `@${string}`): Option.Option<string> =>
  Arr.findFirst(
    Arr.map(comments, (comment) => nonEmpty(Comment.combineDisplayParts(comment.getTag(tag)?.content ?? []))),
    Option.isSome
  ).pipe(Option.flatten)

const declarationSourceFile = (
  path: Path.Path,
  packageRoot: string,
  entrypoint: PackagePublicEntrypoint,
  reflection: DeclarationReflection
): SourceFilePath =>
  Option.match(Arr.head(reflection.sources ?? []), {
    onNone: () => entrypoint.sourceFile,
    onSome: (source) => ({
      absolute: source.fullFileName,
      relative: toForwardSlashes(path, path.relative(packageRoot, source.fullFileName))
    })
  })

const exportKey = (entry: PackagePublicExport): string => `${entry.subpath}::${entry.exportName}::${entry.kind}`

export const publicExportsFromReflection = (input: {
  readonly path: Path.Path
  readonly packageName: string
  readonly packageRoot: string
  readonly entrypoint: PackagePublicEntrypoint
  readonly reflection: DeclarationReflection
}): Effect.Effect<ReadonlyArray<PackagePublicExport>, ApiReferenceGenerationError> =>
  Effect.gen(function*() {
    const groups = Record.values(Arr.groupBy(input.reflection.children ?? [], (child) => child.name))
    const entries = Arr.map(groups, (group): Either.Either<PackagePublicExport, string> => {
      const exportName = group[0].name
      const resolved = Arr.map(group, resolvedReflection)
      const kind = exportKind(exportName, resolved)
      const [rest, preferred] = Arr.partition(Arr.zip(group, resolved), ([, target]) => matchesKind(kind, target))
      const comments = Arr.dedupe(
        Arr.flatMap([...preferred, ...rest], ([child, target]) => [...commentsFor(child), ...commentsFor(target)])
      )
      const summary = summaryOf(comments)
      const since = tagOf(comments, "@since")
      const category = tagOf(comments, "@category")

      if (Option.isNone(summary) || Option.isNone(since) || Option.isNone(category)) {
        const missing = [
          ...(Option.isNone(summary) ? ["summary"] : []),
          ...(Option.isNone(since) ? ["@since"] : []),
          ...(Option.isNone(category) ? ["@category"] : [])
        ]
        return Either.left(`${input.entrypoint.subpath}#${exportName} (${missing.join(", ")})`)
      }

      return Either.right({
        subpath: input.entrypoint.subpath,
        exportName,
        kind,
        sourceFile: declarationSourceFile(input.path, input.packageRoot, input.entrypoint, resolved[0]),
        summary: summary.value,
        since: since.value,
        category: category.value
      })
    })
    const [incomplete, publicExports] = Arr.separate(entries)

    if (incomplete.length > 0) {
      return yield* new ApiReferenceGenerationError({
        packageName: input.packageName,
        detail: `public API documentation is incomplete: ${incomplete.join(", ")}`
      })
    }

    return publicExports.sort((left, right) => exportKey(left).localeCompare(exportKey(right)))
  })
