import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { SurfaceRuntime } from "../kernel/kind.js"

const signEntryId = "sign"

export const signSurfaceRuntime = SurfaceRuntime.entryFetch({
  entryId: signEntryId,
  snapshot: (registry) => ({
    draft: registry.get(surfaceDraftAtom(signEntryId)),
    localProjectionScript: null
  })
})
