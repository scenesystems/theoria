import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { SurfaceRuntime } from "../kernel/kind.js"

const sealEntryId = "seal"

export const sealSurfaceRuntime = SurfaceRuntime.entryFetch({
  entryId: sealEntryId,
  snapshot: (registry) => ({
    draft: registry.get(surfaceDraftAtom(sealEntryId)),
    localProjectionScript: null
  })
})
