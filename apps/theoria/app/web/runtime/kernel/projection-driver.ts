import { Effect, Option } from "effect"
import type { Deferred, Queue, Stream } from "effect"

import type { DemoError } from "../../../contracts/demo-error.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import type { RunSignal } from "../../atoms/run/lifecycle.js"
import type { LocalProjectionScript, LocalRunFrame } from "../../state/run/local.js"
import type { RunOwnership } from "../../state/run/types.js"

export type CompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>

export type AuthoredStepQueueEvent = CanonicalFrame | CompletionEvent

export type ProjectionDriverEvent =
  | { readonly _tag: "LocalRunFrameUpdated"; readonly frame: LocalRunFrame }
  | { readonly _tag: "LocalDriverCompleted" }

export type ProjectionDriverSnapshot = {
  readonly manifest: StreamManifest | null
  readonly localProjectionScript: LocalProjectionScript | null
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
    onNone: () => ({ manifest: null, localProjectionScript: null }),
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
