import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Effect, Match } from "effect"

import {
  type PackageDocsBundle,
  type PackageDocsBundleRoute,
  type PackageDocsCatalogEntry,
  packageDocsCatalogRoute,
  type PackageDocsError,
  PackageDocsRequestError,
  type PackageDocsSearchResult
} from "../../contracts/presentation/package-docs.js"
import { PackageDocsClient } from "../services/PackageDocsClient.js"

const packageDocsRuntime = Atom.runtime(PackageDocsClient.Default)

export const packageDocsCatalogRouteAtom = Atom.family((_route: typeof packageDocsCatalogRoute) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      const client = yield* PackageDocsClient
      return yield* client.catalog()
    })
  )
)

export const packageDocsCatalogAtom: AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError>
> = packageDocsCatalogRouteAtom(packageDocsCatalogRoute)

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

export type PackageDocsSearchAtom = AtomType.Atom<
  Result.Result<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError>
>
