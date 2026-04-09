import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { SurfaceRuntime } from "../kernel/kind.js"

const effectInferenceEntryId = "effect-inference"

export const effectInferenceSurfaceRuntime = SurfaceRuntime.entryFetch({
  entryId: effectInferenceEntryId,
  preload: false,
  snapshot: (registry) => ({
    draft: registry.get(surfaceDraftAtom(effectInferenceEntryId)),
    localProjectionScript: null
  })
})
