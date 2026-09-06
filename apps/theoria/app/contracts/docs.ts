import { Match, Option, Schema } from "effect"

const RouteSegment = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[A-Za-z0-9._~-]+$/u)
)

export const DocsModuleSlug = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/u)
)
export type DocsModuleSlug = typeof DocsModuleSlug.Type

export const DocsPackageSlug = RouteSegment
export type DocsPackageSlug = typeof DocsPackageSlug.Type

export const DocsGuideSlug = RouteSegment
export type DocsGuideSlug = typeof DocsGuideSlug.Type

export const DocsSection = Schema.Literal("packages", "guides", "api")
export type DocsSection = typeof DocsSection.Type

export const DocsIndexRoute = Schema.TaggedStruct("DocsIndexRoute", {})

export const DocsOverviewRoute = Schema.TaggedStruct("DocsOverviewRoute", {
  packageSlug: DocsPackageSlug
})

export const DocsGuideRoute = Schema.TaggedStruct("DocsGuideRoute", {
  packageSlug: DocsPackageSlug,
  guideSlug: DocsGuideSlug
})

export const DocsApiRoute = Schema.TaggedStruct("DocsApiRoute", {
  packageSlug: DocsPackageSlug,
  moduleSlug: Schema.OptionFromNullOr(DocsModuleSlug)
})

export const DocsNotFoundRoute = Schema.TaggedStruct("DocsNotFoundRoute", {})

export const DocsRoute = Schema.Union(
  DocsIndexRoute,
  DocsOverviewRoute,
  DocsGuideRoute,
  DocsApiRoute,
  DocsNotFoundRoute
)

export type DocsRoute = typeof DocsRoute.Type

export const docsIndexRoute = (): DocsRoute => ({ _tag: "DocsIndexRoute" })

export const docsOverviewRoute = (packageSlug: DocsPackageSlug): DocsRoute => ({
  _tag: "DocsOverviewRoute",
  packageSlug
})

export const docsGuideRoute = (packageSlug: DocsPackageSlug, guideSlug: DocsGuideSlug): DocsRoute => ({
  _tag: "DocsGuideRoute",
  packageSlug,
  guideSlug
})

export const docsApiRoute = (
  packageSlug: DocsPackageSlug,
  moduleSlug: Option.Option<DocsModuleSlug> = Option.none()
): DocsRoute => ({
  _tag: "DocsApiRoute",
  packageSlug,
  moduleSlug
})

export const docsNotFoundRoute = (): DocsRoute => ({ _tag: "DocsNotFoundRoute" })

export const docsSectionFor = (route: DocsRoute): DocsSection =>
  Match.value(route).pipe(
    Match.tag("DocsIndexRoute", (): DocsSection => "packages"),
    Match.tag("DocsOverviewRoute", (): DocsSection => "guides"),
    Match.tag("DocsGuideRoute", (): DocsSection => "guides"),
    Match.tag("DocsApiRoute", (): DocsSection => "api"),
    Match.tag("DocsNotFoundRoute", (): DocsSection => "packages"),
    Match.exhaustive
  )

export const docsPathFor = (route: DocsRoute): string =>
  Match.value(route).pipe(
    Match.tag("DocsIndexRoute", () => "/docs"),
    Match.tag("DocsOverviewRoute", ({ packageSlug }) => `/docs/${packageSlug}`),
    Match.tag("DocsGuideRoute", ({ guideSlug, packageSlug }) => `/docs/${packageSlug}/${guideSlug}`),
    Match.tag("DocsApiRoute", ({ moduleSlug, packageSlug }) =>
      `/docs/${packageSlug}/api${
        Option.match(moduleSlug, {
          onNone: () => "",
          onSome: (slug) => `/${slug}`
        })
      }`),
    Match.tag("DocsNotFoundRoute", () => "/docs"),
    Match.exhaustive
  )
