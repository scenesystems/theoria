import { Effect, Schema } from "effect"

import { type DurableFingerprint, fingerprintOf } from "../../../contracts/entry/fingerprint.js"
import type { AnyEntryDescriptor } from "../../../contracts/entry/registry.js"

import type { EntryRuntimeDescriptor } from "./entry-runtime-descriptor-model.js"

export class EntryRuntimeDescriptorProvenance extends Schema.Class<EntryRuntimeDescriptorProvenance>(
  "EntryRuntimeDescriptorProvenance"
)({
  diagnosticsKey: Schema.NullOr(Schema.String),
  interactiveWidgetKey: Schema.NullOr(Schema.String),
  projectionDriverKey: Schema.NullOr(Schema.String)
}) {}

const entryRuntimeDescriptorFingerprintInput = (descriptor: EntryRuntimeDescriptor) => ({
  entryId: descriptor.entryId,
  diagnosticsKey: descriptor.provenance.diagnosticsKey,
  interactiveWidgetKey: descriptor.provenance.interactiveWidgetKey,
  projectionDriverKey: descriptor.provenance.projectionDriverKey,
  projectionHint: descriptor.entry.projectionHint,
  transport: descriptor.runtime.transport
})

const entryFingerprintInput = (entry: AnyEntryDescriptor) => ({
  entryId: entry.entryId,
  title: entry.title,
  packageName: entry.packageName,
  path: entry.path,
  projectionHint: entry.projectionHint,
  primaryAuthorityId: entry.primaryAuthorityId,
  authorityIds: entry.authorityIds,
  seeds: entry.seeds,
  releaseState: entry.releaseState
})

export type EntryRuntimeProvenance = {
  readonly descriptorFingerprint: DurableFingerprint
  readonly provenanceFingerprint: DurableFingerprint
  readonly entryFingerprint: DurableFingerprint
}

export const entryRuntimeProvenanceFingerprint = (
  descriptor: EntryRuntimeDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(entryRuntimeDescriptorFingerprintInput(descriptor))

export const resolveEntryRuntimeProvenance = (
  descriptor: EntryRuntimeDescriptor
): Effect.Effect<EntryRuntimeProvenance, never, never> =>
  Effect.gen(function*() {
    const entryFingerprint = yield* fingerprintOf(entryFingerprintInput(descriptor.entry))
    const provenanceFingerprint = yield* entryRuntimeProvenanceFingerprint(descriptor)
    const descriptorFingerprint = yield* fingerprintOf({
      entryFingerprint,
      provenanceFingerprint
    })

    return {
      descriptorFingerprint,
      provenanceFingerprint,
      entryFingerprint
    }
  })

export const entryRuntimeDescriptorFingerprint = (
  descriptor: EntryRuntimeDescriptor
): Effect.Effect<DurableFingerprint, never, never> =>
  resolveEntryRuntimeProvenance(descriptor).pipe(Effect.map((provenance) => provenance.descriptorFingerprint))

export const entryRuntimeRegistryFingerprint = (
  descriptors: ReadonlyArray<EntryRuntimeDescriptor>
): Effect.Effect<DurableFingerprint, never, never> =>
  Effect.forEach(descriptors, entryRuntimeDescriptorFingerprint).pipe(Effect.flatMap(fingerprintOf))
