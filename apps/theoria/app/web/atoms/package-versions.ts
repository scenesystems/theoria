import type { Atom } from "@effect-atom/atom"
import type { Result } from "@effect-atom/atom"
import { Effect } from "effect"

import type { DemoError } from "../../contracts/demo-error.js"
import type { PackageVersions } from "../../contracts/package-versions.js"
import { DemoClient } from "../services/DemoClient.js"

import { appRuntime } from "./runtime.js"

/**
 * Live package versions fetched from the `/api/versions/packages` endpoint.
 *
 * Returns a `Result<PackageVersions, DemoError>` atom that resolves on first
 * subscriber mount. Components fall back to the static `card.version` field
 * while this is loading or if the fetch fails.
 *
 * @since 0.1.0
 */
export const packageVersionsAtom: Atom.Atom<Result.Result<PackageVersions, DemoError>> = appRuntime.atom(
  Effect.gen(function*() {
    const client = yield* DemoClient
    return yield* client.versions()
  })
)
