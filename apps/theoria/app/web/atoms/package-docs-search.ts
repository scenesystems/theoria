import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Schema } from "effect"

import {
  type PackageDocsError,
  type PackageDocsPageRoute,
  PackageDocsQuerySchema,
  PackageDocsRequestError,
  type PackageDocsSearchResult,
  type PackageDocsSearchRoute,
  packageDocsSearchRoute,
  packageDocsSelectedPackageId
} from "../../contracts/presentation/package-docs.js"
import { PackageDocsClient } from "../services/PackageDocsClient.js"
import {
  packageDocsSearchIdle,
  type PackageDocsSearchState,
  packageDocsSearchState
} from "../state/package-docs-search.js"

const packageDocsRuntime = Atom.runtime(PackageDocsClient.Default)

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

const searchQuery = ({
  query,
  route
}: {
  readonly query: string
  readonly route: PackageDocsPageRoute
}) =>
  Schema.decodeUnknownSync(PackageDocsQuerySchema)({
    query,
    packageId: packageDocsSelectedPackageId(route),
    limit: 8
  })

export const packageDocsSearchStateAtom: (route: PackageDocsPageRoute) => AtomType.Atom<PackageDocsSearchState> = Atom
  .family(
    (route: PackageDocsPageRoute) =>
      Atom.make((get: AtomType.Context): PackageDocsSearchState => {
        const query = get(packageDocsSearchQueryAtom).trim()

        if (query.length === 0) {
          return packageDocsSearchIdle(route, query)
        }

        return Result.match(
          get(packageDocsSearchRouteAtom(packageDocsSearchRoute(searchQuery({ query, route })))),
          {
            onInitial: () => packageDocsSearchState({ description: null, query, results: null, route }),
            onFailure: (failure) =>
              packageDocsSearchState({
                description: failure.cause.toString(),
                query,
                results: null,
                route
              }),
            onSuccess: (success) => packageDocsSearchState({ description: null, query, results: success.value, route })
          }
        )
      })
  )

export type PackageDocsSearchAtom = AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError>
>
