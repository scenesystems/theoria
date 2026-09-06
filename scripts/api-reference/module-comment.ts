import { Array as Arr, Effect, Option, String as Str } from "effect"
import {
  type Application,
  type Comment,
  type CommentDisplayPart,
  type DeclarationReflection,
  type DocumentationEntryPoint,
  type ProjectReflection,
  ReflectionKind
} from "typedoc"

import { ApiReferenceGenerationError } from "./model.js"

// Module documentation comes from TypeDoc's own file-comment handling: the
// leading `/** … @module */` block of a converted entrypoint becomes the module
// reflection's comment, with `{@link}` targets already resolved.

export const moduleReflection = (project: ProjectReflection): Option.Option<DeclarationReflection> =>
  Arr.findFirst(
    project.children ?? [],
    (reflection): reflection is DeclarationReflection => reflection.kindOf(ReflectionKind.Module)
  )

const hasText = (parts: ReadonlyArray<CommentDisplayPart>): boolean =>
  Arr.some(parts, (part) => Str.isNonEmpty(part.text.trim()))

export const hasCommentSummary = (comment: Comment): boolean => hasText(comment.summary)

export const hasCommentTag = (comment: Comment, tagName: `@${string}`): boolean =>
  Arr.some(comment.blockTags, (tag) => tag.tag === tagName && hasText(tag.content))

export const requireModuleComment = (input: {
  readonly packageName: string
  readonly relative: string
  readonly reflection: DeclarationReflection
}): Effect.Effect<Comment, ApiReferenceGenerationError> => {
  const missing = (part: string) =>
    new ApiReferenceGenerationError({
      packageName: input.packageName,
      detail: `${input.relative} is missing module ${part}`
    })

  return Option.fromNullable(input.reflection.comment).pipe(
    Option.filter(hasCommentSummary),
    Effect.mapError(() => missing("summary")),
    Effect.filterOrFail((comment) => hasCommentTag(comment, "@since"), () => missing("@since"))
  )
}

// Converts one source file of an already-converted module as its own
// entrypoint so its leading `@module` comment can document a source page.
// The whole project is kept: the comment's `{@link}` targets point into it.
export const sourceFileModuleProject = (input: {
  readonly app: Application
  readonly entrypoint: DocumentationEntryPoint
  readonly packageName: string
  readonly displayName: string
  readonly sourceFile: { readonly absolute: string; readonly relative: string }
}): Effect.Effect<ProjectReflection, ApiReferenceGenerationError> =>
  Effect.gen(function*() {
    const failure = (detail: string) => new ApiReferenceGenerationError({ packageName: input.packageName, detail })
    const sourceFile = yield* Option.fromNullable(input.entrypoint.program.getSourceFile(input.sourceFile.absolute))
      .pipe(Effect.mapError(() => failure(`${input.sourceFile.relative} is not part of the TypeDoc program`)))

    const project = yield* Effect.try({
      try: () =>
        input.app.converter.convert([
          { displayName: input.displayName, program: input.entrypoint.program, sourceFile }
        ]),
      catch: () => failure(`TypeDoc conversion failed for ${input.sourceFile.relative}`)
    })

    if (input.app.logger.hasErrors()) {
      return yield* failure(`TypeDoc reported an error while converting ${input.sourceFile.relative}`)
    }

    const reflection = yield* Option.match(moduleReflection(project), {
      onNone: () => failure(`TypeDoc did not create a module reflection for ${input.sourceFile.relative}`),
      onSome: Effect.succeed
    })

    yield* requireModuleComment({
      packageName: input.packageName,
      relative: input.sourceFile.relative,
      reflection
    })

    return project
  })
