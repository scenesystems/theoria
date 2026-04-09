import { type EntryId } from "../../../contracts/entry/id.js"
import { EntryRuntimeDescriptorProvenance } from "./descriptor.js"

const entryRuntimeProvenanceById: Readonly<Record<EntryId, EntryRuntimeDescriptorProvenance>> = {
  "effect-dsp": EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: "effect-dsp/runtime",
    interactiveWidgetKey: "effect-dsp/live-evaluation",
    projectionDriverKey: "effect-dsp/projection-stream"
  }),
  "effect-inference": EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: null,
    interactiveWidgetKey: null,
    projectionDriverKey: null
  }),
  "effect-math": EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: "effect-math/power-runtime",
    interactiveWidgetKey: "effect-math/live-power-explorer",
    projectionDriverKey: "effect-math/power-animation"
  }),
  "effect-search": EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: "effect-search/study-runtime",
    interactiveWidgetKey: "effect-search/live-optimization",
    projectionDriverKey: "effect-search/optimization-animation"
  }),
  "effect-text": EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: "effect-text/projection-runtime",
    interactiveWidgetKey: "effect-text/live-reflow",
    projectionDriverKey: "effect-text/animation"
  }),
  digest: EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: null,
    interactiveWidgetKey: null,
    projectionDriverKey: null
  }),
  seal: EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: null,
    interactiveWidgetKey: null,
    projectionDriverKey: null
  }),
  sign: EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: null,
    interactiveWidgetKey: null,
    projectionDriverKey: null
  }),
  workflow: EntryRuntimeDescriptorProvenance.make({
    diagnosticsKey: "workflow/runtime",
    interactiveWidgetKey: "workflow/control",
    projectionDriverKey: null
  })
}

export const entryRuntimeProvenanceFor = (id: EntryId): EntryRuntimeDescriptorProvenance =>
  entryRuntimeProvenanceById[id]
