import type { Atom } from "@effect-atom/atom"
import type { Result } from "@effect-atom/atom"
import { Effect } from "effect"

import type { PackageVersions } from "../../contracts/capability/package-versions.js"
import type { EntryError } from "../../contracts/entry-error.js"
import { EntryClient } from "../services/EntryClient.js"

import { appRuntime } from "./runtime.js"

/**
 * Live package versions fetched from the `/api/versions/packages` endpoint.
 *
 * Returns a `Result<PackageVersions, EntryError>` atom that resolves on first
 * subscriber mount. Components fall back to the static `card.version` field
 * while this is loading or if the fetch fails.
 *
 * @since 0.1.0
 */
export const packageVersionsAtom: Atom.Atom<Result.Result<PackageVersions, EntryError>> = appRuntime.atom(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.versions()
  })
)
