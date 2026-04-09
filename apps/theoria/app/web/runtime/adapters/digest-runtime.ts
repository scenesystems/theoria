import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { SurfaceRuntime } from "../kernel/kind.js"

const digestEntryId = "digest"

export const digestSurfaceRuntime = SurfaceRuntime.entryFetch({
  entryId: digestEntryId,
  snapshot: (registry) => ({
    draft: registry.get(surfaceDraftAtom(digestEntryId)),
    localProjectionScript: null
  })
})
