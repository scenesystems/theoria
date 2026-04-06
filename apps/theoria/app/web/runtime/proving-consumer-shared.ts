import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Option } from "effect"
import type { Deferred, Queue, Stream } from "effect"
import type { ReactNode } from "react"

import type { CanonicalFrame } from "../../contracts/canonical-step.js"
import type { DemoError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { type DurableFingerprint, fingerprintOf } from "../../contracts/fingerprint.js"
import type { AuthorityId, PublishedConsumerId, SurfaceId } from "../../contracts/id.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import {
  type AuthorityCatalogDescriptor,
  type ConsumerPublicationDescriptor,
  primaryAuthorityCatalogForDescriptor,
  type PublishedConsumerDescriptor,
  publishedConsumerDescriptorFingerprint
} from "../../contracts/proving-substrate.js"
import type { SurfaceRunPlan } from "../../contracts/run-plan.js"
import type { RunData } from "../../contracts/run.js"
import type { StreamManifest } from "../../contracts/stream-manifest.js"
import type { RunSignal } from "../atoms/run-lifecycle.js"
import type { RunRegistry } from "../atoms/run-registry-context.js"
import type { RunRuntimeTelemetryRow, RunRuntimeTelemetrySection } from "../atoms/surface.js"
import type { DemoClient } from "../services/DemoClient.js"
import type { WorkflowComparisonClient } from "../services/WorkflowComparisonClient.js"
import type { LocalRunFrame, LocalRunPlan } from "../state/local-run.js"
import type { RunOwnership } from "../state/types.js"

export type CompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>

export type AuthoredStepQueueEvent = CanonicalFrame | CompletionEvent

export type ProjectionDriverEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: LocalRunFrame }
  | { readonly _tag: "LocalDriverCompleted" }

export type ProjectionDriverSnapshot = {
  readonly manifest: StreamManifest | null
  readonly localRunPlan: LocalRunPlan | null
}

export type SurfaceRuntimeSnapshot = {
  readonly runPlan: SurfaceRunPlan | null
  readonly localRunPlan: LocalRunPlan | null
}

export type SurfaceRuntimeServices = DemoClient | WorkflowComparisonClient

export type SurfaceRunResult = {
  readonly data: RunData
  readonly meta: Metadata
}

export type ProjectionDriverDescriptor = {
  readonly ownership: RunOwnership
  readonly snapshot: (registry: RunRegistry) => ProjectionDriverSnapshot
  readonly makeStream: (
    registry: RunRegistry,
    signal: RunSignal,
    snapshot: ProjectionDriverSnapshot,
    stepQueue: Queue.Queue<AuthoredStepQueueEvent>,
    serverCompleted: Deferred.Deferred<CompletionEvent>
  ) => Stream.Stream<ProjectionDriverEvent, DemoError, never>
  readonly reset: (registry: RunRegistry) => Effect.Effect<void, never, never>
  readonly setPlayback: (registry: RunRegistry, isAnimating: boolean) => Effect.Effect<void, never, never>
  readonly syncFrameToControls: (
    registry: RunRegistry,
    localRunFrame: LocalRunFrame | null
  ) => Effect.Effect<void, never, never>
}

export type SurfaceTransport = "fetch" | "sse"

export type SurfaceRuntime = {
  readonly transport: SurfaceTransport
  readonly projectionDriver: Option.Option<ProjectionDriverDescriptor>
  readonly preload: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly runWithMeta: Option.Option<
    (snapshot: SurfaceRuntimeSnapshot) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >
  readonly streamUrl: Option.Option<(snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string>
}

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

export type ProvingAuthorityDescriptor = {
  readonly authorityId: AuthorityId
  readonly catalog: AuthorityCatalogDescriptor
}

export type ProvingConsumerLaneProvenance = {
  readonly diagnosticsKey: string | null
  readonly interactiveWidgetKey: string | null
  readonly projectionDriverKey: string | null
}

export type ProvingConsumerLaneDescriptor = {
  readonly consumerId: SurfaceId
  readonly provenance: ProvingConsumerLaneProvenance
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}

export type ProvingConsumerDescriptor = {
  readonly consumerId: PublishedConsumerId
  readonly consumer: PublishedConsumerDescriptor
  readonly authority: ProvingAuthorityDescriptor
  readonly publication: ConsumerPublicationDescriptor
  readonly lane: ProvingConsumerLaneDescriptor
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}

export const serverOnlyOwnership: RunOwnership = {
  localDriver: false,
  serverStream: true
}

export const sharedStreamingOwnership: RunOwnership = {
  localDriver: true,
  serverStream: true
}

export const noProjectionPlayback = (
  _registry: RunRegistry,
  _isAnimating: boolean
): Effect.Effect<void, never, never> => Effect.void

export const noProjectionFrameSync = (
  _registry: RunRegistry,
  _localRunFrame: LocalRunFrame | null
): Effect.Effect<void, never, never> => Effect.void

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

export const makeFetchSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  runWithMeta = Option.none<
    (snapshot: SurfaceRuntimeSnapshot) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >(),
  snapshot = () => ({ runPlan: null, localRunPlan: null })
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly runWithMeta?: Option.Option<
    (snapshot: SurfaceRuntimeSnapshot) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >
  readonly snapshot?: (registry: RunRegistry) => SurfaceRuntimeSnapshot
} = {}): SurfaceRuntime => ({
  transport: "fetch",
  projectionDriver: Option.none(),
  preload,
  snapshot,
  runWithMeta,
  streamUrl: Option.none()
})

export const fetchSurfaceRuntime: SurfaceRuntime = makeFetchSurfaceRuntime()

export const makeStreamingSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  projectionDriver,
  snapshot,
  streamUrl
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly projectionDriver: ProjectionDriverDescriptor
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
}): SurfaceRuntime => ({
  transport: "sse",
  projectionDriver: Option.some(projectionDriver),
  preload,
  snapshot,
  runWithMeta: Option.none(),
  streamUrl: Option.some(streamUrl)
})

export const makeServerOnlyStreamingSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  snapshot,
  streamUrl
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
}): SurfaceRuntime => ({
  transport: "sse",
  projectionDriver: Option.none(),
  preload,
  snapshot,
  runWithMeta: Option.none(),
  streamUrl: Option.some(streamUrl)
})

export const makeProvingAuthorityDescriptor = (
  catalog: AuthorityCatalogDescriptor
): ProvingAuthorityDescriptor => ({
  authorityId: catalog.authorityId,
  catalog
})

export const makeProvingConsumerLaneDescriptor = ({
  consumerId,
  diagnosticsKey = null,
  interactiveWidgetKey = null,
  projectionDriverKey = null,
  runtime,
  surface
}: {
  readonly consumerId: SurfaceId
  readonly diagnosticsKey?: string | null
  readonly interactiveWidgetKey?: string | null
  readonly projectionDriverKey?: string | null
  readonly runtime: SurfaceRuntime
  readonly surface: SurfaceViewExtension
}): ProvingConsumerLaneDescriptor => ({
  consumerId,
  provenance: {
    diagnosticsKey,
    interactiveWidgetKey,
    projectionDriverKey
  },
  runtime,
  surface
})

export const makeProvingConsumerDescriptor = ({
  consumer,
  lane
}: {
  readonly consumer: PublishedConsumerDescriptor
  readonly lane: ProvingConsumerLaneDescriptor
}): ProvingConsumerDescriptor => ({
  consumerId: consumer.publication.consumerId,
  consumer,
  authority: makeProvingAuthorityDescriptor(primaryAuthorityCatalogForDescriptor(consumer)),
  publication: consumer.publication,
  lane,
  runtime: lane.runtime,
  surface: lane.surface
})

const provingConsumerLaneFingerprintInput = (lane: ProvingConsumerLaneDescriptor) => ({
  consumerId: lane.consumerId,
  diagnosticsKey: lane.provenance.diagnosticsKey,
  interactiveWidgetKey: lane.provenance.interactiveWidgetKey,
  projectionDriverKey: lane.provenance.projectionDriverKey,
  projectionPlaneHint: lane.surface.projectionPlaneHint,
  transport: lane.runtime.transport
})

export type ProvingConsumerRuntimeProvenance = {
  readonly descriptorFingerprint: DurableFingerprint
  readonly laneFingerprint: DurableFingerprint
  readonly substrateFingerprint: DurableFingerprint
}

export const provingConsumerLaneFingerprint = (
  lane: ProvingConsumerLaneDescriptor
): Effect.Effect<DurableFingerprint, never, never> => fingerprintOf(provingConsumerLaneFingerprintInput(lane))

export const resolveProvingConsumerRuntimeProvenance = (
  descriptor: ProvingConsumerDescriptor
): Effect.Effect<ProvingConsumerRuntimeProvenance, never, never> =>
  Effect.gen(function*() {
    const substrateFingerprint = yield* publishedConsumerDescriptorFingerprint(descriptor.consumer)
    const laneFingerprint = yield* provingConsumerLaneFingerprint(descriptor.lane)
    const descriptorFingerprint = yield* fingerprintOf({
      substrateFingerprint,
      laneFingerprint
    })

    return {
      descriptorFingerprint,
      laneFingerprint,
      substrateFingerprint
    }
  })

export const provingConsumerDescriptorFingerprint = (
  descriptor: ProvingConsumerDescriptor
): Effect.Effect<DurableFingerprint, never, never> =>
  resolveProvingConsumerRuntimeProvenance(descriptor).pipe(Effect.map((provenance) => provenance.descriptorFingerprint))

export const provingConsumerRegistryFingerprint = (
  descriptors: ReadonlyArray<ProvingConsumerDescriptor>
): Effect.Effect<DurableFingerprint, never, never> =>
  Effect.forEach(descriptors, provingConsumerDescriptorFingerprint).pipe(Effect.flatMap(fingerprintOf))

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
