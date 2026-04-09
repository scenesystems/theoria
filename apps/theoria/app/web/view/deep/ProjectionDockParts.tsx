import { EyeSlashIcon } from "@heroicons/react/20/solid"
import { projectionDockHideTargetProps } from "../../runtime/kernel/projection-dock-target.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import type { DeepDiveProjectionControlModel } from "./projection-model.js"
import { ProjectionSurfaceChip } from "./ProjectionSurfaceChip.js"

import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const hideDockClassName =
  "inline-flex min-h-11 items-center gap-2 border border-dashed border-stage-300/90 border-l-2 border-l-stage-400 bg-stage-50/60 px-3 text-ink-700 transition-colors duration-150"

export const ProjectionDockSectionHeading = ({
  text,
  detail
}: {
  readonly text: string
  readonly detail: string
}) => (
  <Stack className="gap-1">
    <SemanticText
      as="p"
      className="text-ink-700 uppercase tracking-[0.16em]"
      role="code-meta"
      text={text}
      variant="expanded"
    />
    <SemanticText as="p" className="max-w-none text-ink-500" role="status" text={detail} variant="compact" />
  </Stack>
)

export const ProjectionDockHideTarget = ({ active }: { readonly active: boolean }) => (
  <Layer
    className={[
      hideDockClassName,
      active ? "border-stage-400 bg-stage-100" : ""
    ].join(" ")}
    {...projectionDockHideTargetProps()}
  >
    <EyeSlashIcon aria-hidden className="h-4 w-4" />
    <SemanticText as="span" role="code-meta" text="Drop to unbind" variant="compact" />
  </Layer>
)

export type ProjectionDockSurfaceInteraction = {
  readonly draggedSurface: DeepDiveProjectionPlane | null
  readonly onCompleteDragSurface: (clientX: number, clientY: number) => void
  readonly onMoveDragSurface: (clientX: number, clientY: number) => void
  readonly onStartDragSurface: (surface: DeepDiveProjectionPlane, clientX: number, clientY: number) => void
  readonly setDraggedSurface: (surface: DeepDiveProjectionPlane | null) => void
}

export const ProjectionDockSurface = ({
  interaction,
  library,
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  option,
  projectIndex,
  projectedCount
}: {
  readonly interaction: ProjectionDockSurfaceInteraction
  readonly library?: boolean
  readonly onFocusSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onHideSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"], index?: number) => void
  readonly option: DeepDiveProjectionControlModel["surfaces"][number]
  readonly projectIndex?: number
  readonly projectedCount: number
}) => (
  <ProjectionSurfaceChip
    draggedSurface={interaction.draggedSurface}
    onCompleteDragSurface={interaction.onCompleteDragSurface}
    onMoveDragSurface={interaction.onMoveDragSurface}
    onStartDragSurface={interaction.onStartDragSurface}
    onFocusSurface={onFocusSurface}
    onHideSurface={onHideSurface}
    onProjectSurface={onProjectSurface}
    option={option}
    projectedCount={projectedCount}
    setDraggedSurface={interaction.setDraggedSurface}
    {...(library ? { library: true } : {})}
    {...(typeof projectIndex === "number" ? { projectIndex } : {})}
  />
)
