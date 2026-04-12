import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match } from "effect"

import {
  type PackageDocsBundle,
  type PackageDocsBundleRoute,
  type PackageDocsCatalogEntry,
  type PackageDocsError,
  type PackageDocsPageRoute,
  PackageDocsRequestError,
  packageDocsSearchIdle,
  packageDocsSearchQuery,
  type PackageDocsSearchResult,
  PackageDocsSearchRoute,
  type PackageDocsSearchState,
  packageDocsSearchState
} from "../../contracts/presentation/package-docs.js"
import { PackageDocsClient } from "../services/PackageDocsClient.js"

const packageDocsRuntime = Atom.runtime(PackageDocsClient.Default)

export const packageDocsCatalogAtom: AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError>
> = packageDocsRuntime.atom(
  Effect.gen(function*() {
    const client = yield* PackageDocsClient
    return yield* client.catalog()
  })
)

export const packageDocsBundleRouteAtom = Atom.family((route: PackageDocsBundleRoute) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* PackageDocsClient

      return yield* Match.value(route.selection).pipe(
        Match.tag("PackageDocsBundlePackage", ({ packageId }) => client.bundle(packageId)),
        Match.tag(
          "MissingPackageDocsBundlePackage",
          () =>
            Effect.fail(new PackageDocsRequestError({ message: "Package docs bundle route requires a package id." }))
        ),
        Match.exhaustive
      )
    })
  )
)

export type PackageDocsBundleAtom = AtomType.Atom<Result.Result<PackageDocsBundle, PackageDocsError>>

export const packageDocsSearchQueryAtom = Atom.make("")

export const packageDocsSearchRouteAtom = Atom.family((route: PackageDocsSearchRoute) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* PackageDocsClient

      return yield* Match.value(route.selection).pipe(
        Match.tag("PackageDocsSearchQuery", ({ query }) => client.search(query)),
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
  )
)

export const packageDocsSearchStateAtom: (route: PackageDocsPageRoute) => AtomType.Atom<PackageDocsSearchState> = Atom
  .family(
    (route: PackageDocsPageRoute) =>
      Atom.make((get: AtomType.Context): PackageDocsSearchState => {
        const query = get(packageDocsSearchQueryAtom).trim()
        const request = packageDocsSearchQuery({ query, route })

        if (request === null) {
          return packageDocsSearchIdle(route, query)
        }

        return Result.match(get(packageDocsSearchRouteAtom(PackageDocsSearchRoute.fromQuery(request))), {
          onInitial: () => packageDocsSearchState({ description: null, query, results: null, route }),
          onFailure: (failure) =>
            packageDocsSearchState({
              description: failure.cause.toString(),
              query,
              results: null,
              route
            }),
          onSuccess: (success) => packageDocsSearchState({ description: null, query, results: success.value, route })
        })
      })
  )

export type PackageDocsSearchAtom = AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError>
>
