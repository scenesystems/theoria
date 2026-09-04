import { Array as Arr, Effect, Option } from "effect"
import {
  type Application,
  type Comment,
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

export const hasCommentSummary = (comment: Comment | undefined): boolean =>
  comment?.summary.some((part) => part.text.trim().length > 0) ?? false

export const hasCommentTag = (comment: Comment | undefined, tagName: `@${string}`): boolean =>
  comment?.blockTags.some(
    (tag) => tag.tag === tagName && tag.content.some((part) => part.text.trim().length > 0)
  ) ?? false

export const requireModuleComment = (input: {
  readonly packageName: string
  readonly relative: string
  readonly reflection: DeclarationReflection
}): Effect.Effect<Comment, ApiReferenceGenerationError> => {
  const comment = input.reflection.comment
  const missing = (part: string) =>
    new ApiReferenceGenerationError({
      packageName: input.packageName,
      detail: `${input.relative} is missing module ${part}`
    })

  if (comment === undefined || !hasCommentSummary(comment)) {
    return Effect.fail(missing("summary"))
  }

  return hasCommentTag(comment, "@since") ? Effect.succeed(comment) : Effect.fail(missing("@since"))
}

// Converts one source file of an already-converted module as its own
// entrypoint so its leading `@module` comment can document a source page.
export const sourceFileModuleComment = (input: {
  readonly app: Application
  readonly entrypoint: DocumentationEntryPoint
  readonly packageName: string
  readonly displayName: string
  readonly sourceFile: { readonly absolute: string; readonly relative: string }
}): Effect.Effect<Comment, ApiReferenceGenerationError> =>
  Effect.gen(function*() {
    const failure = (detail: string) => new ApiReferenceGenerationError({ packageName: input.packageName, detail })
    const sourceFile = input.entrypoint.program.getSourceFile(input.sourceFile.absolute)

    if (sourceFile === undefined) {
      return yield* failure(`${input.sourceFile.relative} is not part of the TypeDoc program`)
    }

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

    return yield* requireModuleComment({
      packageName: input.packageName,
      relative: input.sourceFile.relative,
      reflection
    })
  })
