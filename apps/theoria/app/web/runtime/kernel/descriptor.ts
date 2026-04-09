import type { Atom as AtomType } from "@effect-atom/atom"
import { Data, Effect, Schema } from "effect"
import type { ReactNode } from "react"

import { type AuthorityCatalogDescriptor, authorityCatalogForId } from "../../../contracts/capability/catalog.js"
import { type DurableFingerprint, fingerprintOf } from "../../../contracts/entry/fingerprint.js"
import { primaryAuthorityIdForEntry } from "../../../contracts/entry/focus.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import { type AnyEntryDescriptor, entryDescriptorForId } from "../../../contracts/entry/registry.js"
import type { RunRuntimeTelemetryRow, RunRuntimeTelemetrySection } from "../../atoms/surface/run-telemetry.js"
import type { SurfaceRuntime } from "./kind.js"

export class ProjectionPlaneHint extends Data.Class<ProjectionPlaneHint.Shape> {
  static make(hint: ProjectionPlaneHint.Shape): ProjectionPlaneHint {
    return new ProjectionPlaneHint(hint)
  }
}

export namespace ProjectionPlaneHint {
  export interface Shape {
    readonly stage: string
    readonly evidence: string
    readonly source: string
  }
}

export class TabHint extends Data.Class<TabHint.Shape> {
  static make(hint: TabHint.Shape): TabHint {
    return new TabHint(hint)
  }
}

export namespace TabHint {
  export interface Shape {
    readonly interactive: string
    readonly evidence: string
  }
}

export class SurfaceViewExtension extends Data.Class<SurfaceViewExtension.Shape> {
  static make(extension: SurfaceViewExtension.Shape): SurfaceViewExtension {
    return new SurfaceViewExtension(extension)
  }
}

export namespace SurfaceViewExtension {
  export interface Shape {
    readonly interactiveWidget: ReactNode | null
    readonly projectionPlaneHint: ProjectionPlaneHint
    readonly diagnosticsSections: (get: AtomType.Context) => ReadonlyArray<RunRuntimeTelemetrySection>
  }
}

export type SurfaceViewExtensionContext = AtomType.Context

export class EntryRuntimeAuthorityDescriptor extends Data.Class<EntryRuntimeAuthorityDescriptor.Shape> {
  static make(descriptor: EntryRuntimeAuthorityDescriptor.Shape): EntryRuntimeAuthorityDescriptor {
    return new EntryRuntimeAuthorityDescriptor(descriptor)
  }

  static fromCatalog(catalog: AuthorityCatalogDescriptor): EntryRuntimeAuthorityDescriptor {
    return EntryRuntimeAuthorityDescriptor.make({
      authorityId: catalog.authorityId,
      catalog
    })
  }
}

export namespace EntryRuntimeAuthorityDescriptor {
  export interface Shape {
    readonly authorityId: AuthorityCatalogDescriptor["authorityId"]
    readonly catalog: AuthorityCatalogDescriptor
  }
}

export class EntryRuntimeDescriptorProvenance extends Schema.Class<EntryRuntimeDescriptorProvenance>(
  "EntryRuntimeDescriptorProvenance"
)({
  diagnosticsKey: Schema.NullOr(Schema.String),
  interactiveWidgetKey: Schema.NullOr(Schema.String),
  projectionDriverKey: Schema.NullOr(Schema.String)
}) {}

export class EntryRuntimeDescriptor extends Data.Class<EntryRuntimeDescriptor.Shape> {
  static make(descriptor: EntryRuntimeDescriptor.Shape): EntryRuntimeDescriptor {
    return new EntryRuntimeDescriptor(descriptor)
  }

  static resolve({
    entryId,
    provenance,
    runtime,
    surface
  }: {
    readonly entryId: EntryId
    readonly provenance: EntryRuntimeDescriptorProvenance
    readonly runtime: SurfaceRuntime
    readonly surface: SurfaceViewExtension
  }): EntryRuntimeDescriptor {
    const entry = entryDescriptorForId(entryId)

    return EntryRuntimeDescriptor.make({
      entryId: entry.entryId,
      entry,
      authority: EntryRuntimeAuthorityDescriptor.fromCatalog(
        authorityCatalogForId(primaryAuthorityIdForEntry(entryId))
      ),
      provenance,
      runtime,
      surface
    })
  }
}

export namespace EntryRuntimeDescriptor {
  export interface Shape {
    readonly entryId: EntryId
    readonly entry: AnyEntryDescriptor
    readonly authority: EntryRuntimeAuthorityDescriptor
    readonly provenance: EntryRuntimeDescriptorProvenance
    readonly runtime: SurfaceRuntime
    readonly surface: SurfaceViewExtension
  }
}

export const defaultTabHint: TabHint = TabHint.make({
  interactive: "Adjust parameters and see the results change in real time.",
  evidence: "Quantitative evidence from the benchmark — every number is reproducible."
})

export const defaultProjectionPlaneHint: ProjectionPlaneHint = ProjectionPlaneHint.make({
  stage: defaultTabHint.interactive,
  evidence: defaultTabHint.evidence,
  source: "Inspect the prepared and runtime program projections exactly as executed, file by file."
})

export const noDiagnosticsSections = (_get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => []

const entryRuntimeDescriptorFingerprintInput = (descriptor: EntryRuntimeDescriptor) => ({
  entryId: descriptor.entryId,
  diagnosticsKey: descriptor.provenance.diagnosticsKey,
  interactiveWidgetKey: descriptor.provenance.interactiveWidgetKey,
  projectionDriverKey: descriptor.provenance.projectionDriverKey,
  projectionPlaneHint: descriptor.surface.projectionPlaneHint,
  transport: descriptor.runtime.transport
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
