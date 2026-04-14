import type { Atom } from "@effect-atom/atom"
import type { Result } from "@effect-atom/atom"
import { Effect } from "effect"

import type { CapabilityAvailability } from "../../contracts/capability/availability.js"
import type { EntryError } from "../../contracts/entry-error.js"
import { EntryClient } from "../services/EntryClient.js"

import { appRuntime } from "./runtime.js"

/**
 * Live entry readiness fetched from the canonical `/api/availability` route.
 *
 * Components render against this result so home-surface readiness is projected
 * from shared transport authority instead of from view-local assumptions.
 *
 * @since 0.1.0
 */
export const capabilityAvailabilityAtom: Atom.Atom<Result.Result<CapabilityAvailability, EntryError>> = appRuntime.atom(
  Effect.gen(function*() {
    const client = yield* EntryClient
    return yield* client.capabilityAvailability()
  })
)
