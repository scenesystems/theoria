import { Array as Arr, Data, Effect, Option } from "effect"
import { type DeclarationReflection } from "typedoc"

import { type ApiDocLink } from "./links.js"
import { ApiReferenceGenerationError, type ApiReferenceRoute } from "./model.js"
import { buildApiPresentation } from "./presentation.js"
import { ApiDocContext, documentation, summaryText, tagText } from "./typedoc-comments.js"
import { apiExports } from "./typedoc-declarations.js"

class MakeApiPresentationInput extends Data.Class<{
  readonly packageName: string
  readonly packageVersion: string
  readonly packageSlug: string
  readonly packageDescription: string
  readonly moduleSource: string
  readonly moduleReflection: DeclarationReflection
  readonly moduleSourceUrl: string
  readonly routes: ReadonlyArray<ApiReferenceRoute>
  readonly links: ReadonlyArray<ApiDocLink>
}> {}

export const makeApiPresentation = (input: ConstructorParameters<typeof MakeApiPresentationInput>[0]) =>
  Effect.gen(function*() {
    const canonicalRoute = yield* Effect.fromOption(Arr.findFirst(input.routes, (route) => route.canonical)).pipe(
      Effect.mapError(() =>
        new ApiReferenceGenerationError({
          packageName: input.packageName,
          detail: `${input.moduleReflection.name} has no canonical documentation route`
        })
      )
    )
    const exportsByRoute = yield* Effect.forEach(input.routes, (route) =>
      apiExports(
        input.packageName,
        input.packageSlug,
        input.moduleReflection,
        route,
        new ApiDocContext({ packageName: input.packageName, route, links: input.links })
      ))
    const moduleComment = Option.fromNullishOr(input.moduleReflection.comment)

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
