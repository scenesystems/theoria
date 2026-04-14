import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import type {
  PackageDocsBundle,
  PackageDocsCatalogEntry,
  PackageDocsError
} from "../../contracts/presentation/package-docs.js"

import {
  PackageDocsCatalogSelection,
  PackageDocsEmptyCatalog,
  PackageDocsRouteState,
  type ResolvedPackageDocsCatalogSelection
} from "../../contracts/presentation/package-docs.js"

import { packageDocsRouteFromLocationAtom } from "./package-docs-navigation.js"
import { packageDocsBundleRouteAtom, packageDocsBundleWarmupAtom, packageDocsCatalogAtom } from "./package-docs.js"

const bundleRouteState = ({
  bundleResult,
  catalog,
  selection
}: {
  readonly bundleResult: Result.Result<PackageDocsBundle, PackageDocsError>
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly selection: ResolvedPackageDocsCatalogSelection
}): PackageDocsRouteState.Value =>
  Result.match(bundleResult, {
    onInitial: () =>
      PackageDocsRouteState.projectBundle({
        bundle: null,
        catalog,
        description: null,
        selection
      }),
    onFailure: (failure) =>
      PackageDocsRouteState.projectBundle({
        bundle: null,
        catalog,
        description: failure.cause.toString(),
        selection
      }),
    onSuccess: (success) =>
      PackageDocsRouteState.projectBundle({
        bundle: success.value,
        catalog,
        description: null,
        selection
      })
  })

export const packageDocsCurrentRouteStateAtom: AtomType.Atom<PackageDocsRouteState.Value> = Atom.make(
  (get: AtomType.Context): PackageDocsRouteState.Value => {
    const route = get(packageDocsRouteFromLocationAtom)

    get.mount(packageDocsBundleWarmupAtom)

    return Result.match(get(packageDocsCatalogAtom), {
      onInitial: () => PackageDocsRouteState.projectCatalog({ description: null, route }),
      onFailure: (failure) => PackageDocsRouteState.projectCatalog({ description: failure.cause.toString(), route }),
      onSuccess: (success) => {
        const selection = PackageDocsCatalogSelection.project({
          catalog: success.value,
          route
        })

        return Match.value(selection).pipe(
          Match.tag("EmptyPackageDocsCatalogSelection", () => PackageDocsEmptyCatalog.make({ route })),
          Match.tag("ResolvedPackageDocsCatalogSelection", (resolvedSelection) =>
            bundleRouteState({
              bundleResult: get(packageDocsBundleRouteAtom(resolvedSelection.selectedPackageId)),
              catalog: success.value,
              selection: resolvedSelection
            })),
          Match.exhaustive
        )
      }
    })
  }
)
