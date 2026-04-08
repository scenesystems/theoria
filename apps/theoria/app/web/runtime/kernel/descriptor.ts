import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect } from "effect"
import type { ReactNode } from "react"

import { type AuthorityCatalogDescriptor, authorityCatalogForId } from "../../../contracts/capability/catalog.js"
import { type DurableFingerprint, fingerprintOf } from "../../../contracts/entry/fingerprint.js"
import { primaryAuthorityIdForEntry } from "../../../contracts/entry/focus.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import { type AnyEntryDescriptor, entryDescriptorForId } from "../../../contracts/entry/registry.js"
import type { RunRuntimeTelemetryRow, RunRuntimeTelemetrySection } from "../../atoms/surface/state.js"
import type { SurfaceRuntime } from "./kind.js"

export type ProjectionPlaneHint = {
  readonly stage: string
  readonly evidence: string
  readonly source: string
}

export type TabHint = {
  readonly interactive: string
  readonly evidence: string
}

export type SurfaceViewExtension = {
  readonly interactiveWidget: ReactNode | null
  readonly projectionPlaneHint: ProjectionPlaneHint
  readonly diagnosticsSections: (get: AtomType.Context) => ReadonlyArray<RunRuntimeTelemetrySection>
}

export type SurfaceViewExtensionContext = AtomType.Context

export type EntryRuntimeAuthorityDescriptor = {
  readonly authorityId: AuthorityCatalogDescriptor["authorityId"]
  readonly catalog: AuthorityCatalogDescriptor
}

export type EntryRuntimeAdapterProvenance = {
  readonly diagnosticsKey: string | null
  readonly interactiveWidgetKey: string | null
  readonly projectionDriverKey: string | null
}

export type EntryRuntimeAdapterDescriptor = {
  readonly entryId: EntryId
  readonly provenance: EntryRuntimeAdapterProvenance
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}

export type EntryRuntimeDescriptor = {
  readonly entryId: EntryId
  readonly entry: AnyEntryDescriptor
  readonly authority: EntryRuntimeAuthorityDescriptor
  readonly adapter: EntryRuntimeAdapterDescriptor
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}

export const defaultTabHint: TabHint = {
  interactive: "Adjust parameters and see the results change in real time.",
  evidence: "Quantitative evidence from the benchmark — every number is reproducible."
}

export const defaultProjectionPlaneHint: ProjectionPlaneHint = {
  stage: defaultTabHint.interactive,
  evidence: defaultTabHint.evidence,
  source: "Inspect the prepared and runtime program projections exactly as executed, file by file."
}

export const noDiagnosticsSections = (_get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => []

export const defaultSurfaceViewExtension: SurfaceViewExtension = {
  interactiveWidget: null,
  projectionPlaneHint: defaultProjectionPlaneHint,
  diagnosticsSections: noDiagnosticsSections
}

export const makeEntryRuntimeAuthorityDescriptor = (
  catalog: AuthorityCatalogDescriptor
): EntryRuntimeAuthorityDescriptor => ({
  authorityId: catalog.authorityId,
  catalog
})

export const makeEntryRuntimeAdapterDescriptor = ({
  entryId,
  diagnosticsKey = null,
  interactiveWidgetKey = null,
  projectionDriverKey = null,
  runtime,
  surface
}: {
  readonly entryId: EntryId
  readonly diagnosticsKey?: string | null
  readonly interactiveWidgetKey?: string | null
  readonly projectionDriverKey?: string | null
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}): EntryRuntimeAdapterDescriptor => ({
  entryId,
  provenance: {
    diagnosticsKey,
    interactiveWidgetKey,
    projectionDriverKey
  },
  runtime,
  surface
})

export const makeEntryRuntimeDescriptor = ({
  entryId,
  adapter
}: {
  readonly entryId: EntryId
  readonly adapter: EntryRuntimeAdapterDescriptor
}): EntryRuntimeDescriptor => {
  const entry = entryDescriptorForId(entryId)

  return {
    entryId: entry.entryId,
    entry,
    authority: makeEntryRuntimeAuthorityDescriptor(authorityCatalogForId(primaryAuthorityIdForEntry(entryId))),
    adapter,
    runtime: adapter.runtime,
    surface: adapter.surface
  }
}

const entryRuntimeAdapterFingerprintInput = (adapter: EntryRuntimeAdapterDescriptor) => ({
  entryId: adapter.entryId,
  diagnosticsKey: adapter.provenance.diagnosticsKey,
  interactiveWidgetKey: adapter.provenance.interactiveWidgetKey,
  projectionDriverKey: adapter.provenance.projectionDriverKey,
  projectionPlaneHint: adapter.surface.projectionPlaneHint,
  transport: adapter.runtime.transport
})

const entryFingerprintInput = (entry: AnyEntryDescriptor) => ({
  entryId: entry.entryId,
  title: entry.title,
  packageName: entry.packageName,
  path: entry.path,
  primaryAuthorityId: entry.primaryAuthorityId,
  authorityIds: entry.authorityIds,
  seeds: entry.seeds,
  releaseState: entry.releaseState
})

export type EntryRuntimeProvenance = {
  readonly descriptorFingerprint: DurableFingerprint
  readonly adapterFingerprint: DurableFingerprint
  readonly entryFingerprint: DurableFingerprint
}

export const entryRuntimeAdapterFingerprint = (
  adapter: EntryRuntimeAdapterDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(entryRuntimeAdapterFingerprintInput(adapter))

export const resolveEntryRuntimeProvenance = (
  descriptor: EntryRuntimeDescriptor
): Effect.Effect<EntryRuntimeProvenance, never, never> =>
  Effect.gen(function*() {
    const entryFingerprint = yield* fingerprintOf(entryFingerprintInput(descriptor.entry))
    const adapterFingerprint = yield* entryRuntimeAdapterFingerprint(descriptor.adapter)
    const descriptorFingerprint = yield* fingerprintOf({
      entryFingerprint,
      adapterFingerprint
    })

    return {
      descriptorFingerprint,
      adapterFingerprint,
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

export const telemetryRow = (label: string, value: string): RunRuntimeTelemetryRow => ({ label, value })

export const telemetrySection = (
  description: string,
  rows: ReadonlyArray<RunRuntimeTelemetryRow>,
  title: string,
  kind: RunRuntimeTelemetrySection["kind"] = "facts"
): RunRuntimeTelemetrySection => ({
  description,
  kind,
  rows,
  title
})
