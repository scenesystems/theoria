import type { Effect } from "effect"
import { Schema } from "effect"
import * as Arr from "effect/Array"

import { type DurableFingerprint, fingerprintOf } from "../entry/fingerprint.js"
import { authorityIds } from "../entry/id.js"
import { AuthorityCatalogDescriptor, authorityCatalogForId } from "./catalog.js"

export const CapabilityCatalogRegistry = Schema.Array(AuthorityCatalogDescriptor)

export type CapabilityCatalogRegistry = typeof CapabilityCatalogRegistry.Type

export const capabilityCatalogRegistry: CapabilityCatalogRegistry = Arr.map(authorityIds, authorityCatalogForId)

const encodeCapabilityCatalogRegistry = Schema.encodeSync(CapabilityCatalogRegistry)

export const capabilityCatalogRegistryFingerprint = (
  registry: CapabilityCatalogRegistry
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(encodeCapabilityCatalogRegistry(registry))
