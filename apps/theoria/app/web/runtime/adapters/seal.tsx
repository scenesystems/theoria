import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { defaultSurfaceViewExtension, makeEntryRuntimeAdapterDescriptor } from "../kernel/descriptor.js"
import { makeEntryFetchSurfaceRuntime } from "../kernel/kind.js"

const sealEntryId = "seal"

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: sealEntryId,
  runtime: makeEntryFetchSurfaceRuntime({
    entryId: sealEntryId,
    snapshot: (registry) => ({
      draft: registry.get(surfaceDraftAtom(sealEntryId)),
      localProjectionScript: null
    })
  }),
  surface: defaultSurfaceViewExtension
})
