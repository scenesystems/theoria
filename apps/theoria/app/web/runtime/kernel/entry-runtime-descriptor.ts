import { type EntryId } from "../../../contracts/entry/id.js"
import { EntryRuntimeDescriptor } from "./entry-runtime-descriptor-model.js"
import { entryRuntimeProvenanceFor } from "./entry-runtime-provenance-registry.js"
import { surfaceRuntimeForEntry } from "./surface-runtime-registry.js"
import { surfaceViewExtensionFor } from "./surface-view-registry.js"

export const entryRuntimeDescriptorFor = (id: EntryId): EntryRuntimeDescriptor =>
  EntryRuntimeDescriptor.resolve({
    entryId: id,
    provenance: entryRuntimeProvenanceFor(id),
    runtime: surfaceRuntimeForEntry(id),
    surface: surfaceViewExtensionFor(id)
  })
