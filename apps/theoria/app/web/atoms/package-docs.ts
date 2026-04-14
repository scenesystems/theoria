import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option, Schema } from "effect"

import {
  classifyPackageDocsSearchIntent,
  type PackageDocsBundle,
  type PackageDocsCatalogEntry,
  type PackageDocsError,
  PackageDocsLandingPageRoute,
  PackageDocsPackagePageRoute,
  type PackageDocsPageRoute,
  type PackageDocsPreviousSearch,
  packageDocsPreviousSearch,
  type PackageDocsQuery,
  PackageDocsRequestError,
  packageDocsSearchIdle,
  type PackageDocsSearchIntent,
  PackageDocsSearchItem,
  type PackageDocsSearchItem as PackageDocsSearchItemType,
  PackageDocsSearchModel,
  type PackageDocsSearchPanelContent,
  packageDocsSearchPanelContent,
  packageDocsSearchQuery,
  packageDocsSearchReady,
  type PackageDocsSearchResult,
  PackageDocsSearchRoute,
  type PackageDocsSearchState,
  packageDocsSearchState,
  packageDocsSearchSuggestionsFromBundle,
  packageDocsSearchSuggestionsFromCatalog,
  type PackageName
} from "../../contracts/presentation/package-docs.js"
import { PageLocation } from "../../contracts/presentation/page-location.js"
import { PackageDocsClient } from "../services/PackageDocsClient.js"
import { packageDocsRouteFromLocationAtom } from "./package-docs-navigation.js"

const packageDocsRuntime = Atom.runtime(PackageDocsClient.Default)
const packageDocsSearchTimeout = "5 seconds"
const packageDocsSearchRecentSelectionsStorageKey = "theoria-package-docs-search-recent-selections"
const PackageDocsSearchRecentSelections = Schema.Array(PackageDocsSearchItem)
const decodePackageDocsSearchRecentSelections = Schema.decodeUnknownOption(
  Schema.parseJson(PackageDocsSearchRecentSelections)
)
const encodePackageDocsSearchRecentSelections = Schema.encodeSync(
  Schema.parseJson(PackageDocsSearchRecentSelections)
)

const packageDocsSearchKey = (query: PackageDocsQuery): string => PackageDocsSearchRoute.fromQuery(query).path()

const packageDocsPageRouteKey = (route: PackageDocsPageRoute): string => route.path()

const packageDocsPageRouteFromKey = (key: string): PackageDocsPageRoute => {
  const location = PageLocation.fromUrl(key)

  return PackageDocsPackagePageRoute.fromLocation(location).pipe(
    Option.orElse(() => PackageDocsLandingPageRoute.fromLocation(location)),
    Option.getOrElse(() => PackageDocsLandingPageRoute.landing())
  )
}

const packageDocsSearchRouteFromKey = (key: string): PackageDocsSearchRoute =>
  Option.getOrElse(
    PackageDocsSearchRoute.fromLocation(PageLocation.fromUrl(key)),
    () => PackageDocsSearchRoute.missing()
  )

const withPackageDocsSearchTimeout = <A, E>(
  effect: Effect.Effect<A, E>
): Effect.Effect<A, E | PackageDocsRequestError> =>
  effect.pipe(
    Effect.timeoutFail({
      duration: packageDocsSearchTimeout,
      onTimeout: () =>
        new PackageDocsRequestError({
          message: `Package docs search timed out after ${packageDocsSearchTimeout}.`
        })
    })
  )

const readStoredPackageDocsSearchRecentSelections = (): ReadonlyArray<PackageDocsSearchItem> =>
  typeof window === "undefined"
    ? []
    : Option.getOrElse(
      Option.fromNullable(window.localStorage.getItem(packageDocsSearchRecentSelectionsStorageKey)).pipe(
        Option.flatMap(decodePackageDocsSearchRecentSelections)
      ),
      () => []
    )

const persistPackageDocsSearchRecentSelections = (items: ReadonlyArray<PackageDocsSearchItem>): void => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    packageDocsSearchRecentSelectionsStorageKey,
    encodePackageDocsSearchRecentSelections(items)
  )
}

const nextPackageDocsSearchRecentSelections = (
  current: ReadonlyArray<PackageDocsSearchItemType>,
  item: PackageDocsSearchItemType
): ReadonlyArray<PackageDocsSearchItemType> =>
  [
    item,
    ...current.filter((selection) => selection.id !== item.id)
  ].slice(0, 6)

export const packageDocsCatalogAtom: AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError>
> = packageDocsRuntime.atom(
  Effect.gen(function*() {
    const client = yield* PackageDocsClient
    return yield* client.catalog()
  })
)

export const packageDocsBundleRouteAtom = Atom.family((packageId: PackageName) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* PackageDocsClient
      return yield* client.bundle(packageId)
    })
  ).pipe(Atom.keepAlive)
)

export type PackageDocsBundleAtom = AtomType.Atom<Result.Result<PackageDocsBundle, PackageDocsError>>

export const packageDocsBundleWarmupAtom: AtomType.Atom<void> = Atom.make((get: AtomType.Context): void =>
  Result.match(get(packageDocsCatalogAtom), {
    onInitial: () => undefined,
    onFailure: () => undefined,
    onSuccess: (success) => {
      // Warm every package bundle once the catalog is known so package switches keep the current
      // workspace geometry stable while the next document surface is already hydrating in atoms.
      success.value.forEach((entry) => {
        get.mount(packageDocsBundleRouteAtom(entry.packageId))
      })
    }
  })
)

export const packageDocsSearchQueryAtom = Atom.make("").pipe(Atom.keepAlive)

const packageDocsDebouncedSearchQueryAtom = packageDocsSearchQueryAtom.pipe(Atom.debounce("180 millis"), Atom.keepAlive)

export const packageDocsCurrentRouteKeyAtom: AtomType.Atom<string> = Atom.make((get: AtomType.Context): string =>
  packageDocsPageRouteKey(get(packageDocsRouteFromLocationAtom))
)

export const packageDocsSearchPanelOpenAtom = Atom.family((_routeKey: string) => Atom.make(false).pipe(Atom.keepAlive))

export const packageDocsSearchHighlightIndexAtom = Atom.family((_routeKey: string) => Atom.make(0).pipe(Atom.keepAlive))

export const packageDocsSearchRecentSelectionsAtom = Atom.make<ReadonlyArray<PackageDocsSearchItem>>(
  readStoredPackageDocsSearchRecentSelections()
).pipe(
  Atom.keepAlive
)

export const rememberPackageDocsSearchSelectionAtom = Atom.fnSync<PackageDocsSearchItem>()((item, ctx) => {
  const next = nextPackageDocsSearchRecentSelections(ctx.registry.get(packageDocsSearchRecentSelectionsAtom), item)

  persistPackageDocsSearchRecentSelections(next)
  ctx.set(packageDocsSearchRecentSelectionsAtom, next)
})

export const packageDocsSearchIntentAtom = Atom.family((_routeKey: string): AtomType.Atom<PackageDocsSearchIntent> =>
  Atom.make((get: AtomType.Context) => {
    const query = get(packageDocsSearchQueryAtom)

    return classifyPackageDocsSearchIntent(query)
  }).pipe(Atom.keepAlive)
)

const packageDocsSearchSuggestionsForRoute = (
  get: AtomType.Context,
  route: PackageDocsPageRoute
): ReadonlyArray<PackageDocsSearchItem> => {
  const selectedPackageId = route.selectedPackageId()

  if (selectedPackageId === null) {
    return Result.match(get(packageDocsCatalogAtom), {
      onInitial: () => [],
      onFailure: () => [],
      onSuccess: (success) => packageDocsSearchSuggestionsFromCatalog(success.value)
    })
  }

  return Result.match(get(packageDocsBundleRouteAtom(selectedPackageId)), {
    onInitial: () => [],
    onFailure: () => [],
    onSuccess: (success) => packageDocsSearchSuggestionsFromBundle(success.value)
  })
}

const packageDocsSearchModelFromPrevious = (input: {
  readonly previous: PackageDocsPreviousSearch | null
  readonly recentSelections: ReadonlyArray<PackageDocsSearchItem>
  readonly suggestions: ReadonlyArray<PackageDocsSearchItem>
}): PackageDocsSearchModel | null =>
  input.previous === null
    ? null
    : PackageDocsSearchModel.project({
      intent: classifyPackageDocsSearchIntent(input.previous.query),
      packageId: null,
      query: input.previous.query,
      recentSelections: input.recentSelections,
      results: input.previous.results,
      suggestions: input.suggestions
    })

const packageDocsSearchReadyModel = (input: {
  readonly recentSelections: ReadonlyArray<PackageDocsSearchItem>
  readonly state: PackageDocsSearchState
  readonly suggestions: ReadonlyArray<PackageDocsSearchItem>
}): PackageDocsSearchModel | null =>
  input.state._tag === "ReadyPackageDocsSearch"
    ? PackageDocsSearchModel.project({
      intent: classifyPackageDocsSearchIntent(input.state.query),
      packageId: null,
      query: input.state.query,
      recentSelections: input.recentSelections,
      results: input.state.results,
      suggestions: input.suggestions
    })
    : null

export const packageDocsSearchRouteAtom = Atom.family((requestKey: string) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* PackageDocsClient
      const route = packageDocsSearchRouteFromKey(requestKey)

      return yield* Match.value(route.selection).pipe(
        Match.tag("PackageDocsSearchQuery", ({ query }) => withPackageDocsSearchTimeout(client.search(query))),
        Match.tag(
          "MissingPackageDocsSearchQuery",
          () => Effect.fail(new PackageDocsRequestError({ message: "Package docs search route requires a query." }))
        ),
        Match.tag(
          "InvalidPackageDocsSearchPackage",
          ({ rawPackageId }) =>
            Effect.fail(
              new PackageDocsRequestError({
                message: `Package docs search route received an invalid package id: ${rawPackageId}.`
              })
            )
        ),
        Match.exhaustive
      )
    })
  ).pipe(Atom.keepAlive)
)

const packageDocsLatestReadySearchAtom = Atom.family((_routeKey: string) =>
  Atom.make<PackageDocsPreviousSearch | null>(null).pipe(Atom.keepAlive)
)

export const packageDocsSearchStateAtom = Atom.family((routeKey: string): AtomType.Atom<PackageDocsSearchState> =>
  Atom.make((get: AtomType.Context): PackageDocsSearchState => {
    const route = packageDocsPageRouteFromKey(routeKey)
    const previous = get.once(packageDocsLatestReadySearchAtom(routeKey))
    const inputQuery = get(packageDocsSearchQueryAtom)
    const requestQuery = get(packageDocsDebouncedSearchQueryAtom).trim()

    if (inputQuery.trim().length === 0) {
      return packageDocsSearchIdle(route, inputQuery)
    }

    const request = packageDocsSearchQuery({ query: requestQuery, route })

    if (request === null) {
      return packageDocsSearchState({
        description: null,
        previous,
        query: inputQuery,
        results: null,
        route
      })
    }

    return Result.match(get(packageDocsSearchRouteAtom(packageDocsSearchKey(request))), {
      onInitial: () =>
        packageDocsSearchState({
          description: null,
          previous,
          query: requestQuery,
          results: null,
          route
        }),
      onFailure: (failure) =>
        packageDocsSearchState({
          description: failure.cause.toString(),
          previous,
          query: requestQuery,
          results: null,
          route
        }),
      onSuccess: (success) => {
        const ready = packageDocsSearchReady({
          query: requestQuery,
          results: success.value,
          route
        })
        const nextPrevious = packageDocsPreviousSearch(ready)

        if (
          previous === null
          || previous.query !== nextPrevious.query
          || previous.results !== nextPrevious.results
          || previous.selectedPackageId !== nextPrevious.selectedPackageId
        ) {
          get.set(packageDocsLatestReadySearchAtom(routeKey), nextPrevious)
        }

        return ready
      }
    })
  })
)

export type PackageDocsSearchAtom = AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError>
>

export const packageDocsCurrentSearchStateAtom: AtomType.Atom<PackageDocsSearchState> = Atom.make(
  (get: AtomType.Context): PackageDocsSearchState => {
    const route = get(packageDocsRouteFromLocationAtom)

    return get(packageDocsSearchStateAtom(packageDocsPageRouteKey(route)))
  }
)

export const packageDocsSearchPresentationAtom = Atom.family((
  routeKey: string
): AtomType.Atom<PackageDocsSearchPanelContent> =>
  Atom.make((get: AtomType.Context): PackageDocsSearchPanelContent => {
    const route = packageDocsPageRouteFromKey(routeKey)
    const state = get(packageDocsSearchStateAtom(routeKey))
    const recentSelections = get(packageDocsSearchRecentSelectionsAtom)
    const suggestions = packageDocsSearchSuggestionsForRoute(get, route)
    const emptyModel = PackageDocsSearchModel.project({
      intent: get(packageDocsSearchIntentAtom(routeKey)),
      packageId: route.selectedPackageId(),
      query: "",
      recentSelections,
      results: [],
      suggestions
    })
    const previousModel = state._tag === "LoadingPackageDocsSearch" || state._tag === "FailedPackageDocsSearch"
      ? packageDocsSearchModelFromPrevious({
        previous: state.previous,
        recentSelections,
        suggestions
      })
      : null
    const readyModel = packageDocsSearchReadyModel({
      recentSelections,
      state,
      suggestions
    })

    return packageDocsSearchPanelContent({
      emptyModel,
      previousModel,
      readyModel,
      state
    })
  })
)

export const packageDocsCurrentSearchPresentationAtom: AtomType.Atom<PackageDocsSearchPanelContent> = Atom.make(
  (get: AtomType.Context): PackageDocsSearchPanelContent =>
    get(packageDocsSearchPresentationAtom(get(packageDocsCurrentRouteKeyAtom)))
)
