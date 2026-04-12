import { Match, Schema } from "effect"

import type { EntryProjectionHint } from "../entry/descriptor.js"
import type { DeepDiveProjectionPlane } from "./deep-dive-projection.js"
import {
  DeepDiveDiagnosticsPlaneValue,
  deepDiveProjectionSurfaceDescriptorFor,
  projectionSurfaceOrdinalLabel
} from "./deep-dive-projection.js"
import { DeepDiveSurfacePlaneValue } from "./layout.js"

const diagnosticsPaneHintText =
  "Development-only reducer and projection-driver diagnostics. Excluded from production builds."

export class DeepDiveProjectionFallbackContent extends Schema.Class<DeepDiveProjectionFallbackContent>(
  "DeepDiveProjectionFallbackContent"
)({
  description: Schema.String,
  title: Schema.String
}) {}

export class DeepDiveProjectionPaneChrome extends Schema.Class<DeepDiveProjectionPaneChrome>(
  "DeepDiveProjectionPaneChrome"
)({
  badgeLabel: Schema.NullOr(Schema.String),
  hintText: Schema.String,
  summaryText: Schema.String,
  title: Schema.String
}) {}

export const deepDiveProjectionHintText = ({
  projectionHint,
  surface
}: {
  readonly projectionHint: EntryProjectionHint
  readonly surface: DeepDiveProjectionPlane
}): string =>
  Match.value(surface).pipe(
    Match.when(DeepDiveSurfacePlaneValue.Stage, () => projectionHint.stage),
    Match.when(DeepDiveSurfacePlaneValue.Evidence, () => projectionHint.evidence),
    Match.when(DeepDiveSurfacePlaneValue.Source, () => projectionHint.source),
    Match.when(DeepDiveDiagnosticsPlaneValue, () => diagnosticsPaneHintText),
    Match.exhaustive
  )

export const deepDiveProjectionPaneChrome = ({
  projectionHint,
  projectionIndex,
  surface
}: {
  readonly projectionHint: EntryProjectionHint
  readonly projectionIndex: number | null
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionPaneChrome => {
  const descriptor = deepDiveProjectionSurfaceDescriptorFor(surface)

  return DeepDiveProjectionPaneChrome.make({
    badgeLabel: projectionSurfaceOrdinalLabel(projectionIndex),
    hintText: deepDiveProjectionHintText({ projectionHint, surface }),
    summaryText: descriptor.description,
    title: descriptor.label
  })
}

export const deepDiveStageProjectionFallbackContent = (): DeepDiveProjectionFallbackContent =>
  DeepDiveProjectionFallbackContent.make({
    description:
      "This surface projects directly into the evidence and source planes. Run it to materialize the canonical outputs side by side.",
    title: "Projection Surface"
  })
