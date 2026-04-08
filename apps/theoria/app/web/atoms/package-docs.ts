import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import type { PackageName } from "@theoria/source-proof/contracts"
import { Effect, Option } from "effect"

import type {
  PackageDocsBundle,
  PackageDocsCatalogEntry,
  PackageDocsError
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

export const packageDocsBundleAtom = Atom.family((packageId: PackageName | null) =>
  packageDocsRuntime.atom(
    Effect.gen(function*() {
      if (packageId === null) {
        return Option.none<PackageDocsBundle>()
      }

      const client = yield* PackageDocsClient

      return Option.some(yield* client.bundle(packageId))
    })
  )
)
