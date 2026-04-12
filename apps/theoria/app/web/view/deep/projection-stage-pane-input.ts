import type { ReactNode } from "react"

import type { EntryId } from "../../../contracts/entry/id.js"
import {
  type DeepDiveProjectionFallbackContent,
  deepDiveStageProjectionFallbackContent
} from "../../../contracts/presentation/deep-dive-pane.js"
import { interactiveWidgetFor } from "../../runtime/kernel/surface-view.js"

export type ProjectionStagePaneInput = {
  readonly fallbackContent: DeepDiveProjectionFallbackContent
  readonly interactiveContent: ReactNode | null
}

export const projectionStagePaneInput = ({ entryId }: { readonly entryId: EntryId }): ProjectionStagePaneInput => ({
  fallbackContent: deepDiveStageProjectionFallbackContent(),
  interactiveContent: interactiveWidgetFor(entryId) ?? null
})
