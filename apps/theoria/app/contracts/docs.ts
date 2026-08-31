import { Match, Schema } from "effect"

const ModuleSlug = Schema.String.pipe(Schema.minLength(1))

export const DocsPackageSlug = Schema.Literal(
  "digest",
  "effect-dsp",
  "effect-inference",
  "effect-math",
  "effect-search",
  "effect-text",
  "seal",
  "sign"
)

export type DocsPackageSlug = typeof DocsPackageSlug.Type

export const DocsSection = Schema.Literal("overview", "getting-started", "api")

export type DocsSection = typeof DocsSection.Type

export const DocsCodeExample = Schema.Literal("study", "objective")

export type DocsCodeExample = typeof DocsCodeExample.Type

export const DocsOverviewRoute = Schema.TaggedStruct("DocsOverviewRoute", {
  packageSlug: DocsPackageSlug
})

export const DocsGettingStartedRoute = Schema.TaggedStruct("DocsGettingStartedRoute", {
  packageSlug: DocsPackageSlug
})

export const DocsApiRoute = Schema.TaggedStruct("DocsApiRoute", {
  packageSlug: DocsPackageSlug,
  moduleSlug: Schema.NullOr(ModuleSlug)
})

export const DocsRoute = Schema.Union(
  DocsOverviewRoute,
  DocsGettingStartedRoute,
  DocsApiRoute
)

export type DocsRoute = typeof DocsRoute.Type

export const docsOverviewRoute = (packageSlug: DocsPackageSlug): DocsRoute => ({
  _tag: "DocsOverviewRoute",
  packageSlug
})

export const docsGettingStartedRoute = (packageSlug: DocsPackageSlug): DocsRoute => ({
  _tag: "DocsGettingStartedRoute",
  packageSlug
})

export const docsApiRoute = (packageSlug: DocsPackageSlug, moduleSlug: string | null = null): DocsRoute => ({
  _tag: "DocsApiRoute",
  packageSlug,
  moduleSlug
})

export const docsSectionFor = (route: DocsRoute): DocsSection =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", (): DocsSection => "overview"),
    Match.tag("DocsGettingStartedRoute", (): DocsSection => "getting-started"),
    Match.tag("DocsApiRoute", (): DocsSection => "api"),
    Match.exhaustive
  )

export const docsPathFor = (route: DocsRoute): string =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", ({ packageSlug }) => `/docs/${packageSlug}`),
    Match.tag("DocsGettingStartedRoute", ({ packageSlug }) => `/docs/${packageSlug}/getting-started`),
    Match.tag("DocsApiRoute", ({ moduleSlug, packageSlug }) =>
      `/docs/${packageSlug}/api${moduleSlug === null ? "" : `/${moduleSlug}`}`),
    Match.exhaustive
  )
