import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import { deepDiveProjectionSurfaceDescriptorFor, DeepDiveProjectionSurfacePane } from "./projection-model.js"
import type { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"
import { deepDiveProjectionPaneFor } from "./projection-surface-panes.js"

export const deepDiveProjectionSurfaceFor = (
  surface: DeepDiveProjectionPlane,
  context: DeepDiveProjectionSurfaceContext
): DeepDiveProjectionSurfacePane => {
  const descriptor = deepDiveProjectionSurfaceDescriptorFor(surface)

  return DeepDiveProjectionSurfacePane.make({
    description: descriptor.description,
    id: descriptor.id,
    label: descriptor.label,
    pane: deepDiveProjectionPaneFor({ context, descriptor, surface })
  })
}
