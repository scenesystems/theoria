import { Schema } from "effect"

import type { OpenAgentTraceRegistryEntry } from "./study-material.js"

export class OpenAgentTraceCoverageItem extends Schema.Class<OpenAgentTraceCoverageItem>(
  "OpenAgentTraceCoverageItem"
)({
  detail: Schema.String,
  label: Schema.String,
  severity: Schema.Literal("info", "warning", "error")
}) {
  static gaps(entry: OpenAgentTraceRegistryEntry): ReadonlyArray<OpenAgentTraceCoverageItem> {
    return entry.workflowProjection.coverageGaps.map((gap) =>
      OpenAgentTraceCoverageItem.make({
        detail: gap.reason,
        label: `${gap.sourceKind} · ${gap.gapId}`,
        severity: gap.severity
      })
    )
  }
}
