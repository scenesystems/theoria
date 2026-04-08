import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { defaultSurfaceViewExtension, makeEntryRuntimeAdapterDescriptor } from "../kernel/descriptor.js"
import { makeEntryFetchSurfaceRuntime } from "../kernel/kind.js"

const effectInferenceEntryId = "effect-inference"

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: effectInferenceEntryId,
  runtime: makeEntryFetchSurfaceRuntime({
    entryId: effectInferenceEntryId,
    preload: false,
    snapshot: (registry) => ({
      draft: registry.get(surfaceDraftAtom(effectInferenceEntryId)),
      localProjectionScript: null
    })
  }),
  surface: defaultSurfaceViewExtension
})
