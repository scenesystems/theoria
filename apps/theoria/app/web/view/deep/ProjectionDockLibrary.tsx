import { deepDiveProjectionDockAvailableHeading } from "../../../contracts/presentation/deep-dive-dock.js"
import type { DeepDiveProjectionControlModel } from "../../../contracts/presentation/deep-dive-projection.js"
import type { ProjectionDockSurfaceInteraction } from "./ProjectionDockParts.js"

import { ProjectionDockHideTarget, ProjectionDockSectionHeading, ProjectionDockSurface } from "./ProjectionDockParts.js"

import { Stack } from "../primitives/Layout.js"

export const ProjectionDockLibrary = ({
  dragInteraction,
  hidden,
  hideTargetActive,
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  projectIndex,
  projectedCount,
  showHideTarget
}: {
  readonly dragInteraction: ProjectionDockSurfaceInteraction
  readonly hidden: ReadonlyArray<DeepDiveProjectionControlModel["surfaces"][number]>
  readonly hideTargetActive: boolean
  readonly onFocusSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onHideSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"], index?: number) => void
  readonly projectIndex: number
  readonly projectedCount: number
  readonly showHideTarget: boolean
}) => {
  const heading = deepDiveProjectionDockAvailableHeading()

  return (
    <Stack className="mt-3 gap-2 border-t border-stage-200/70 pt-2.5">
      <ProjectionDockSectionHeading detail={heading.detail} text={heading.text} />
      <Stack className="gap-0">
        {hidden.map((option) => (
          <ProjectionDockSurface
            interaction={dragInteraction}
            key={option.id}
            library
            onFocusSurface={onFocusSurface}
            onHideSurface={onHideSurface}
            onProjectSurface={onProjectSurface}
            projectIndex={projectIndex}
            option={option}
            projectedCount={projectedCount}
          />
        ))}

        {showHideTarget ? <ProjectionDockHideTarget active={hideTargetActive} /> : null}
      </Stack>
    </Stack>
  )
}
