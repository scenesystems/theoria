import * as Arr from "effect/Array"
import type * as Option from "effect/Option"

import { type EntryId, entryIds } from "../../../contracts/entry/id.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import type { SurfaceRuntimeSnapshot } from "./kind.js"
import type { ProjectionDriverDescriptor } from "./projection-driver.js"
import { surfaceRuntimeForEntry } from "./surface-runtime-registry.js"

export type { SurfaceRuntimeServices, SurfaceRuntimeSnapshot, SurfaceTransport } from "./kind.js"
export type {
  AuthoredStepQueueEvent,
  CompletionEvent,
  ProjectionDriverDescriptor,
  ProjectionDriverEvent,
  ProjectionDriverSnapshot
} from "./projection-driver.js"

export { fetchSurfaceRuntime, SurfaceRuntime } from "./kind.js"
export {
  resetProjectionDriverState,
  runOwnershipFor,
  setProjectionPlayback,
  snapshotProjectionDriver,
  syncProjectionFrameToControls
} from "./projection-driver.js"

export const surfaceRuntimeFor = (id: EntryId) => surfaceRuntimeForEntry(id)

export const streamingEntryIds: ReadonlyArray<EntryId> = Arr.filter(
  entryIds,
  (id) => surfaceRuntimeFor(id).transport === "sse"
)

export const projectionDriverFor = (id: EntryId): Option.Option<ProjectionDriverDescriptor> =>
  surfaceRuntimeFor(id).projectionDriver

export const surfaceUsesSseTransport = (id: EntryId): boolean => streamingEntryIds.includes(id)

export const surfaceRuntimeSnapshotFor = (
  id: EntryId,
  registry: RunRegistry
): SurfaceRuntimeSnapshot => surfaceRuntimeFor(id).snapshot(registry)
