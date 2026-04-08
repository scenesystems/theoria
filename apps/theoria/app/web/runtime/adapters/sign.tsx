import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { defaultSurfaceViewExtension, makeEntryRuntimeAdapterDescriptor } from "../kernel/descriptor.js"
import { makeEntryFetchSurfaceRuntime } from "../kernel/kind.js"

const signEntryId = "sign"

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: signEntryId,
  runtime: makeEntryFetchSurfaceRuntime({
    entryId: signEntryId,
    snapshot: (registry) => ({
      draft: registry.get(surfaceDraftAtom(signEntryId)),
      localProjectionScript: null
    })
  }),
  surface: defaultSurfaceViewExtension
})
