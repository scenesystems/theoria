import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import type {
  PackageDocsBundle,
  PackageDocsCatalogEntry,
  PackageDocsError,
  PackageDocsPageRoute
} from "../../contracts/presentation/package-docs.js"

import { PackageDocsBundleRoute } from "../../contracts/presentation/package-docs.js"

import type { ResolvedPackageDocsCatalogSelection } from "../state/package-docs-route.js"
import {
  packageDocsBundleState,
  packageDocsCatalogSelection,
  packageDocsCatalogState,
  PackageDocsEmptyCatalog,
  type PackageDocsRouteState
} from "../state/package-docs-route.js"

import { packageDocsBundleRouteAtom, packageDocsCatalogAtom } from "./package-docs.js"

const bundleRouteState = ({
  bundleResult,
  catalog,
  selection
}: {
  readonly bundleResult: Result.Result<PackageDocsBundle, PackageDocsError>
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly selection: ResolvedPackageDocsCatalogSelection
}): PackageDocsRouteState =>
  Result.match(bundleResult, {
    onInitial: () =>
      packageDocsBundleState({
        bundle: null,
        catalog,
        description: null,
        selection
      }),
    onFailure: (failure) =>
      packageDocsBundleState({
        bundle: null,
        catalog,
        description: failure.cause.toString(),
        selection
      }),
    onSuccess: (success) =>
      packageDocsBundleState({
        bundle: success.value,
        catalog,
        description: null,
        selection
      })
  })

export const packageDocsRouteStateAtom = Atom.family((route: PackageDocsPageRoute) =>
  Atom.make((get: AtomType.Context): PackageDocsRouteState =>
    Result.match(get(packageDocsCatalogAtom), {
      onInitial: () => packageDocsCatalogState({ description: null, route }),
      onFailure: (failure) => packageDocsCatalogState({ description: failure.cause.toString(), route }),
      onSuccess: (success) => {
        const selection = packageDocsCatalogSelection({
          catalog: success.value,
          route
        })

        return Match.value(selection).pipe(
          Match.tag("EmptyPackageDocsCatalogSelection", () => PackageDocsEmptyCatalog.make({ route })),
          Match.tag("ResolvedPackageDocsCatalogSelection", (resolvedSelection) =>
            bundleRouteState({
              bundleResult: get(
                packageDocsBundleRouteAtom(PackageDocsBundleRoute.fromPackageId(resolvedSelection.selectedPackageId))
              ),
              catalog: success.value,
              selection: resolvedSelection
            })),
          Match.exhaustive
        )
      }
    })
  )
)
