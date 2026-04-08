import type { Option } from "effect"
import * as Arr from "effect/Array"

import { type EntryId, entryIds } from "../../../contracts/entry/id.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import { entryRuntimeAdapterDescriptor as digestRuntimeAdapter } from "../adapters/digest.js"
import { entryRuntimeAdapterDescriptor as effectDspRuntimeAdapter } from "../adapters/effect-dsp.js"
import { entryRuntimeAdapterDescriptor as effectInferenceRuntimeAdapter } from "../adapters/effect-inference.js"
import { entryRuntimeAdapterDescriptor as effectMathRuntimeAdapter } from "../adapters/effect-math.js"
import { entryRuntimeAdapterDescriptor as effectSearchRuntimeAdapter } from "../adapters/effect-search.js"
import { entryRuntimeAdapterDescriptor as effectTextRuntimeAdapter } from "../adapters/effect-text.js"
import { entryRuntimeAdapterDescriptor as sealRuntimeAdapter } from "../adapters/seal.js"
import { entryRuntimeAdapterDescriptor as signRuntimeAdapter } from "../adapters/sign.js"
import { entryRuntimeAdapterDescriptor as workflowRuntimeAdapter } from "../adapters/workflow.js"
import {
  type EntryRuntimeAdapterDescriptor,
  type EntryRuntimeDescriptor,
  type ProjectionPlaneHint,
  type SurfaceViewExtension,
  type SurfaceViewExtensionContext,
  type TabHint
} from "./descriptor.js"
import { makeEntryRuntimeDescriptor } from "./descriptor.js"
import type { SurfaceRuntime, SurfaceRuntimeSnapshot } from "./kind.js"
import type { ProjectionDriverDescriptor } from "./projection-driver.js"

export type {
  EntryRuntimeAdapterDescriptor,
  EntryRuntimeAdapterProvenance,
  EntryRuntimeAuthorityDescriptor,
  EntryRuntimeDescriptor,
  EntryRuntimeProvenance,
  ProjectionPlaneHint,
  SurfaceViewExtension,
  TabHint
} from "./descriptor.js"
export type { SurfaceRuntime, SurfaceRuntimeServices, SurfaceRuntimeSnapshot, SurfaceTransport } from "./kind.js"
export type {
  AuthoredStepQueueEvent,
  CompletionEvent,
  ProjectionDriverDescriptor,
  ProjectionDriverEvent,
  ProjectionDriverSnapshot
} from "./projection-driver.js"

export {
  defaultProjectionPlaneHint,
  defaultTabHint,
  entryRuntimeDescriptorFingerprint,
  entryRuntimeRegistryFingerprint,
  resolveEntryRuntimeProvenance
} from "./descriptor.js"
export {
  fetchSurfaceRuntime,
  makeEntryFetchSurfaceRuntime,
  makeFetchSurfaceRuntime,
  makeServerOnlyStreamingSurfaceRuntime,
  makeStreamingSurfaceRuntime
} from "./kind.js"
export {
  resetProjectionDriverState,
  runOwnershipFor,
  setProjectionPlayback,
  snapshotProjectionDriver,
  syncProjectionFrameToControls
} from "./projection-driver.js"

const entryRuntimeAdapterById: Readonly<Record<EntryId, EntryRuntimeAdapterDescriptor>> = {
  "effect-math": effectMathRuntimeAdapter,
  "effect-search": effectSearchRuntimeAdapter,
  "effect-dsp": effectDspRuntimeAdapter,
  "effect-text": effectTextRuntimeAdapter,
  "effect-inference": effectInferenceRuntimeAdapter,
  digest: digestRuntimeAdapter,
  seal: sealRuntimeAdapter,
  sign: signRuntimeAdapter,
  workflow: workflowRuntimeAdapter
}

const entryRuntimeDescriptorById: Readonly<Record<EntryId, EntryRuntimeDescriptor>> = {
  "effect-math": makeEntryRuntimeDescriptor({ entryId: "effect-math", adapter: effectMathRuntimeAdapter }),
  "effect-search": makeEntryRuntimeDescriptor({ entryId: "effect-search", adapter: effectSearchRuntimeAdapter }),
  "effect-dsp": makeEntryRuntimeDescriptor({ entryId: "effect-dsp", adapter: effectDspRuntimeAdapter }),
  "effect-text": makeEntryRuntimeDescriptor({ entryId: "effect-text", adapter: effectTextRuntimeAdapter }),
  "effect-inference": makeEntryRuntimeDescriptor({
    entryId: "effect-inference",
    adapter: effectInferenceRuntimeAdapter
  }),
  digest: makeEntryRuntimeDescriptor({ entryId: "digest", adapter: digestRuntimeAdapter }),
  seal: makeEntryRuntimeDescriptor({ entryId: "seal", adapter: sealRuntimeAdapter }),
  sign: makeEntryRuntimeDescriptor({ entryId: "sign", adapter: signRuntimeAdapter }),
  workflow: makeEntryRuntimeDescriptor({ entryId: "workflow", adapter: workflowRuntimeAdapter })
}

export const entryRuntimeDescriptors: ReadonlyArray<EntryRuntimeDescriptor> = Arr.map(
  entryIds,
  (id) => entryRuntimeDescriptorById[id]
)

export const dedicatedEntryIds: ReadonlyArray<EntryId> = entryIds

export const entryRuntimeDescriptorFor = (id: EntryId): EntryRuntimeDescriptor => entryRuntimeDescriptorById[id]

export const entryRuntimeAdapterFor = (id: EntryId): EntryRuntimeAdapterDescriptor => entryRuntimeAdapterById[id]

export const surfaceRuntimeFor = (id: EntryId): SurfaceRuntime => entryRuntimeDescriptorFor(id).runtime

export const surfaceViewExtensionFor = (id: EntryId): SurfaceViewExtension => entryRuntimeDescriptorFor(id).surface

export const streamingEntryIds: ReadonlyArray<EntryId> = Arr.filter(
  entryIds,
  (id) => surfaceRuntimeFor(id).transport === "sse"
)

export const projectionDriverFor = (id: EntryId): Option.Option<ProjectionDriverDescriptor> =>
  surfaceRuntimeFor(id).projectionDriver

export const surfaceUsesSseTransport = (id: EntryId): boolean => surfaceRuntimeFor(id).transport === "sse"

export const projectionPlaneHintFor = (id: EntryId): ProjectionPlaneHint =>
  surfaceViewExtensionFor(id).projectionPlaneHint

export const tabHintFor = (id: EntryId): TabHint => {
  const projectionPlaneHint = projectionPlaneHintFor(id)

  return {
    interactive: projectionPlaneHint.stage,
    evidence: projectionPlaneHint.evidence
  }
}

export const interactiveWidgetFor = (id: EntryId) => surfaceViewExtensionFor(id).interactiveWidget ?? undefined

export const runLifecycleDiagnosticsSectionsFor = (
  id: EntryId,
  get: SurfaceViewExtensionContext
) => surfaceViewExtensionFor(id).diagnosticsSections(get)

export const surfaceRuntimeSnapshotFor = (
  id: EntryId,
  registry: RunRegistry
): SurfaceRuntimeSnapshot => surfaceRuntimeFor(id).snapshot(registry)
