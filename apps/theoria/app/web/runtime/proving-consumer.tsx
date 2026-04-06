import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import {
  type ConsumerId,
  isRunnableDemoId,
  type PublishedConsumerId,
  publishedConsumerIds
} from "../../contracts/id.js"
import {
  type PublishedConsumerDescriptor,
  publishedConsumerDescriptorForId,
  publishedConsumerDescriptors
} from "../../contracts/proving-substrate.js"
import type { RunRegistry } from "../atoms/run-registry-context.js"
import { DemoClient } from "../services/DemoClient.js"
import type { LocalRunFrame } from "../state/local-run.js"
import type { RunOwnership } from "../state/types.js"
import {
  defaultSurfaceViewExtension,
  fetchSurfaceRuntime,
  makeFetchSurfaceRuntime,
  makeProvingConsumerDescriptor,
  makeProvingConsumerLaneDescriptor,
  type ProjectionDriverDescriptor,
  type ProjectionDriverSnapshot,
  type ProjectionPlaneHint,
  type ProvingConsumerDescriptor,
  type ProvingConsumerLaneDescriptor,
  serverOnlyOwnership,
  type SurfaceRuntime,
  type SurfaceRuntimeSnapshot,
  type SurfaceViewExtension,
  type SurfaceViewExtensionContext,
  type TabHint
} from "./proving-consumer-shared.js"
import { effectDspProvingConsumerLaneDescriptor } from "./proving-consumers/effect-dsp.js"
import { effectMathProvingConsumerLaneDescriptor } from "./proving-consumers/effect-math.js"
import { effectSearchProvingConsumerLaneDescriptor } from "./proving-consumers/effect-search.js"
import { effectTextProvingConsumerLaneDescriptor } from "./proving-consumers/effect-text.js"
import { workflowComparisonProvingConsumerLaneDescriptor } from "./proving-consumers/workflow-comparison.js"

export type {
  AuthoredStepQueueEvent,
  CompletionEvent,
  ProjectionDriverDescriptor,
  ProjectionDriverEvent,
  ProjectionDriverSnapshot,
  ProjectionPlaneHint,
  ProvingAuthorityDescriptor,
  ProvingConsumerDescriptor,
  ProvingConsumerLaneDescriptor,
  ProvingConsumerLaneProvenance,
  SurfaceRuntime,
  SurfaceTransport,
  SurfaceViewExtension,
  TabHint
} from "./proving-consumer-shared.js"

export {
  defaultProjectionPlaneHint,
  defaultTabHint,
  makeProvingConsumerDescriptor,
  makeProvingConsumerLaneDescriptor,
  provingConsumerDescriptorFingerprint,
  provingConsumerLaneFingerprint,
  provingConsumerRegistryFingerprint,
  resolveProvingConsumerRuntimeProvenance
} from "./proving-consumer-shared.js"

const passiveSnapshotFor = (consumerId: ConsumerId): SurfaceRuntimeSnapshot => ({
  runPlan: isRunnableDemoId(consumerId) ? { id: consumerId, manifest: null } : null,
  localRunPlan: null
})

const passiveRuntimeFor = (consumerId: ConsumerId): SurfaceRuntime =>
  isRunnableDemoId(consumerId)
    ? makeFetchSurfaceRuntime({
      preload: Option.some(
        Effect.gen(function*() {
          const client = yield* DemoClient
          return yield* client.preload(consumerId)
        })
      ),
      runWithMeta: Option.some(() =>
        Effect.gen(function*() {
          const client = yield* DemoClient
          return yield* client.runWithMeta(consumerId)
        })
      ),
      snapshot: () => passiveSnapshotFor(consumerId)
    })
    : fetchSurfaceRuntime

const makePassiveProvingConsumerLaneDescriptor = (consumerId: ConsumerId): ProvingConsumerLaneDescriptor =>
  makeProvingConsumerLaneDescriptor({
    consumerId,
    runtime: passiveRuntimeFor(consumerId),
    surface: defaultSurfaceViewExtension
  })

const provingConsumerLaneById: Readonly<Record<PublishedConsumerId, ProvingConsumerLaneDescriptor>> = {
  "effect-math": effectMathProvingConsumerLaneDescriptor,
  "effect-search": effectSearchProvingConsumerLaneDescriptor,
  "effect-dsp": effectDspProvingConsumerLaneDescriptor,
  "effect-text": effectTextProvingConsumerLaneDescriptor,
  "effect-inference": makePassiveProvingConsumerLaneDescriptor("effect-inference"),
  digest: makePassiveProvingConsumerLaneDescriptor("digest"),
  seal: makePassiveProvingConsumerLaneDescriptor("seal"),
  sign: makePassiveProvingConsumerLaneDescriptor("sign"),
  "workflow-comparison": workflowComparisonProvingConsumerLaneDescriptor
}

const descriptorForConsumer = (consumer: PublishedConsumerDescriptor): ProvingConsumerDescriptor =>
  makeProvingConsumerDescriptor({
    consumer,
    lane: provingConsumerLaneById[consumer.publication.consumerId]
  })

const provingConsumerDescriptorById: Readonly<Record<PublishedConsumerId, ProvingConsumerDescriptor>> = {
  "effect-math": descriptorForConsumer(publishedConsumerDescriptorForId("effect-math")),
  "effect-search": descriptorForConsumer(publishedConsumerDescriptorForId("effect-search")),
  "effect-dsp": descriptorForConsumer(publishedConsumerDescriptorForId("effect-dsp")),
  "effect-text": descriptorForConsumer(publishedConsumerDescriptorForId("effect-text")),
  "effect-inference": descriptorForConsumer(publishedConsumerDescriptorForId("effect-inference")),
  digest: descriptorForConsumer(publishedConsumerDescriptorForId("digest")),
  seal: descriptorForConsumer(publishedConsumerDescriptorForId("seal")),
  sign: descriptorForConsumer(publishedConsumerDescriptorForId("sign")),
  "workflow-comparison": descriptorForConsumer(publishedConsumerDescriptorForId("workflow-comparison"))
}

export const provingConsumerDescriptors: ReadonlyArray<ProvingConsumerDescriptor> = Arr.map(
  publishedConsumerDescriptors,
  descriptorForConsumer
)

export const provingConsumerDescriptorFor = (id: PublishedConsumerId): ProvingConsumerDescriptor =>
  provingConsumerDescriptorById[id]

export const surfaceRuntimeFor = (id: PublishedConsumerId): SurfaceRuntime => provingConsumerDescriptorFor(id).runtime

export const surfaceViewExtensionFor = (id: PublishedConsumerId): SurfaceViewExtension =>
  provingConsumerDescriptorFor(id).surface

export const streamingSurfaceIds: ReadonlyArray<PublishedConsumerId> = Arr.filter(
  publishedConsumerIds,
  (id) => surfaceRuntimeFor(id).transport === "sse"
)

export const projectionDriverFor = (id: PublishedConsumerId): Option.Option<ProjectionDriverDescriptor> =>
  surfaceRuntimeFor(id).projectionDriver

export const surfaceUsesSseTransport = (id: PublishedConsumerId): boolean => surfaceRuntimeFor(id).transport === "sse"

export const projectionPlaneHintFor = (id: PublishedConsumerId): ProjectionPlaneHint =>
  surfaceViewExtensionFor(id).projectionPlaneHint

export const tabHintFor = (id: PublishedConsumerId): TabHint => {
  const projectionPlaneHint = projectionPlaneHintFor(id)

  return {
    interactive: projectionPlaneHint.stage,
    evidence: projectionPlaneHint.evidence
  }
}

export const interactiveWidgetFor = (id: PublishedConsumerId) =>
  surfaceViewExtensionFor(id).interactiveWidget ?? undefined

export const runLifecycleDiagnosticsSectionsFor = (
  id: PublishedConsumerId,
  get: SurfaceViewExtensionContext
) => surfaceViewExtensionFor(id).diagnosticsSections(get)

export const surfaceRuntimeSnapshotFor = (
  id: PublishedConsumerId,
  registry: RunRegistry
): SurfaceRuntimeSnapshot => surfaceRuntimeFor(id).snapshot(registry)

export const runOwnershipFor = (projectionDriver: Option.Option<ProjectionDriverDescriptor>): RunOwnership =>
  Option.match(projectionDriver, {
    onNone: () => serverOnlyOwnership,
    onSome: ({ ownership }) => ownership
  })

export const snapshotProjectionDriver = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry
): ProjectionDriverSnapshot =>
  Option.match(projectionDriver, {
    onNone: () => ({ manifest: null, localRunPlan: null }),
    onSome: (driver) => driver.snapshot(registry)
  })

export const resetProjectionDriverState = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry
): Effect.Effect<void, never, never> =>
  Option.match(projectionDriver, {
    onNone: () => Effect.void,
    onSome: (driver) => driver.reset(registry)
  })

export const setProjectionPlayback = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Option.match(projectionDriver, {
    onNone: () => Effect.void,
    onSome: (driver) => driver.setPlayback(registry, isAnimating)
  })

export const syncProjectionFrameToControls = (
  projectionDriver: Option.Option<ProjectionDriverDescriptor>,
  registry: RunRegistry,
  localRunFrame: LocalRunFrame | null
): Effect.Effect<void, never, never> =>
  Option.match(projectionDriver, {
    onNone: () => Effect.void,
    onSome: (driver) => driver.syncFrameToControls(registry, localRunFrame)
  })
