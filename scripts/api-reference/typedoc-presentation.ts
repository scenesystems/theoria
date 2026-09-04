import { Array as Arr, Effect, Option } from "effect"
import { type DeclarationReflection } from "typedoc"

import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferenceRoute } from "./model.js"
import { buildApiPresentation } from "./presentation.js"
import { ApiDocContext, documentation, summaryText, tagText } from "./typedoc-comments.js"
import { apiExports } from "./typedoc-declarations.js"

export const makeApiPresentation = (input: {
  readonly packageName: string
  readonly packageVersion: string
  readonly packageSlug: string
  readonly packageDescription: string
  readonly moduleSource: string
  readonly moduleReflection: DeclarationReflection
  readonly moduleSourceUrl: string
  readonly routes: ReadonlyArray<ApiReferenceRoute>
  readonly links: ReadonlyArray<ApiDocLink>
}) =>
  Effect.gen(function*() {
    const canonicalRoute = yield* Option.match(Arr.findFirst(input.routes, (route) => route.canonical), {
      onNone: () =>
        Effect.fail(
          new ApiReferenceGenerationError({
            packageName: input.packageName,
            detail: `${input.moduleReflection.name} has no canonical documentation route`
          })
        ),
      onSome: Effect.succeed
    })
    const exportsByRoute = yield* Effect.forEach(input.routes, (route) =>
      apiExports(
        input.packageName,
        input.packageSlug,
        input.moduleReflection,
        route,
        new ApiDocContext({ packageName: input.packageName, route, links: input.links })
      ))
    const moduleComment = Option.fromNullable(input.moduleReflection.comment)

    return buildApiPresentation({
      ...input,
      moduleDocs: documentation(
        moduleComment,
        new ApiDocContext({ packageName: input.packageName, route: canonicalRoute, links: input.links })
      ),
      moduleSummary: summaryText(moduleComment),
      moduleSince: tagText(moduleComment, "@since"),
      canonicalPath: canonicalRoute.path,
      exportsByRoute
    })
  })
