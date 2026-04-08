import { surfaceDraftAtom } from "../../atoms/surface/state.js"
import { defaultSurfaceViewExtension, makeEntryRuntimeAdapterDescriptor } from "../kernel/descriptor.js"
import { makeEntryFetchSurfaceRuntime } from "../kernel/kind.js"

const digestEntryId = "digest"

export const entryRuntimeAdapterDescriptor = makeEntryRuntimeAdapterDescriptor({
  entryId: digestEntryId,
  runtime: makeEntryFetchSurfaceRuntime({
    entryId: digestEntryId,
    snapshot: (registry) => ({
      draft: registry.get(surfaceDraftAtom(digestEntryId)),
      localProjectionScript: null
    })
  }),
  surface: defaultSurfaceViewExtension
})
