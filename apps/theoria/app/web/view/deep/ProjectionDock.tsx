import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import {
  deepDiveProjectionDockModel,
  deepDiveProjectionDockSlotLabel
} from "../../../contracts/presentation/deep-dive-dock.js"
import {
  type DeepDiveProjectionControlModel,
  type DeepDiveProjectionPlane
} from "../../../contracts/presentation/deep-dive-projection.js"
import {
  clearDeepDiveDraggedSurfaceAtom,
  completeDeepDiveDraggedSurfaceAtom,
  deepDiveDragStateAtom,
  moveDeepDiveDraggedSurfaceAtom,
  startDeepDiveSurfaceDragAtom
} from "../../atoms/layout/deep-dive-drag.js"
import { projectionDockHideTargetProps } from "../../runtime/kernel/projection-dock-target.js"

import { Layer, Stack } from "../primitives/Layout.js"
import { ProjectionDockDragGhost } from "./ProjectionDockDragGhost.js"
import { ProjectionDockLibrary } from "./ProjectionDockLibrary.js"
import { ProjectionDockHideTarget, ProjectionDockSectionHeading, ProjectionDockSurface } from "./ProjectionDockParts.js"
import { ProjectionFieldLot } from "./ProjectionFieldLot.js"

const dockShellClassName = "gap-5 px-4 py-4 sm:px-5"

const slotShellClassName = "gap-1"

const hideOverlayClassName =
  "absolute inset-x-0 bottom-0 flex justify-center border-t border-stage-200/70 bg-linear-to-t from-stage-0 via-stage-0/96 to-transparent px-2 pt-6 pb-1"

export const ProjectionDock = ({
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  projection
}: {
  readonly onFocusSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onHideSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"], index?: number) => void
  readonly projection: DeepDiveProjectionControlModel
}) => {
  const dragState = useAtomValue(deepDiveDragStateAtom)
  const dock = deepDiveProjectionDockModel({
    draggedSurface: dragState.draggedSurface,
    hoveredLotIndex: dragState.hoveredLotIndex,
    projection
  })
  const beginDragSurface = useAtomSet(startDeepDiveSurfaceDragAtom)
  const clearDraggedSurface = useAtomSet(clearDeepDiveDraggedSurfaceAtom)
  const completeDraggedSurface = useAtomSet(completeDeepDiveDraggedSurfaceAtom)
  const moveDraggedSurface = useAtomSet(moveDeepDiveDraggedSurfaceAtom)

  const setDraggedSurface = (surface: DeepDiveProjectionControlModel["focusedSurface"] | null): void => {
    if (surface === null) {
      clearDraggedSurface()
      return
    }

    beginDragSurface(surface)
  }

  const beginProjectionSurfaceDrag = (
    surface: DeepDiveProjectionPlane,
    clientX: number,
    clientY: number
  ): void => {
    beginDragSurface(surface)
    moveDraggedSurface({ x: clientX, y: clientY })
  }

  const dragInteraction = {
    draggedSurface: dragState.draggedSurface,
    onCompleteDragSurface: (clientX: number, clientY: number) => {
      completeDraggedSurface({ x: clientX, y: clientY })
    },
    onMoveDragSurface: (clientX: number, clientY: number) => {
      moveDraggedSurface({ x: clientX, y: clientY })
    },
    onStartDragSurface: beginProjectionSurfaceDrag,
    setDraggedSurface
  }
  const dragGhostLayout = dock.draggedSurfaceOption === null || dragState.dragPointer === null
    ? null
    : {
      left: dragState.dragGhostTarget?.x ?? dragState.dragPointer.x + 12,
      top: dragState.dragGhostTarget?.y ?? dragState.dragPointer.y + 12,
      ...(dragState.dragGhostTarget === null ? {} : { width: dragState.dragGhostTarget.width })
    }

  return (
    <Layer className="relative">
      <Stack className={dockShellClassName}>
        <ProjectionDockSectionHeading detail={dock.projectedHeading.detail} text={dock.projectedHeading.text} />
        <Stack className={slotShellClassName}>
          {dock.projectedSlots.map(({ active, index, option }) => (
            <ProjectionFieldLot
              active={active}
              emptyLabel={deepDiveProjectionDockSlotLabel()}
              index={index}
              key={`lot-${index}`}
            >
              {option === null
                ? null
                : (
                  <ProjectionDockSurface
                    interaction={dragInteraction}
                    onFocusSurface={onFocusSurface}
                    onHideSurface={onHideSurface}
                    onProjectSurface={onProjectSurface}
                    option={option}
                    projectedCount={dock.projectedCount}
                  />
                )}
            </ProjectionFieldLot>
          ))}
        </Stack>

        {dock.showLibrary
          ? (
            <ProjectionDockLibrary
              dragInteraction={dragInteraction}
              hidden={dock.hidden}
              hideTargetActive={dragState.hoveredHideTarget}
              onFocusSurface={onFocusSurface}
              onHideSurface={onHideSurface}
              onProjectSurface={onProjectSurface}
              projectIndex={dock.projectIndex}
              projectedCount={dock.projectedCount}
              showHideTarget={dock.showHideTarget}
            />
          )
          : null}
      </Stack>

      {dock.showHideOverlay
        ? (
          <Layer
            className={hideOverlayClassName}
            {...projectionDockHideTargetProps()}
          >
            <ProjectionDockHideTarget active={dragState.hoveredHideTarget} />
          </Layer>
        )
        : null}

      <ProjectionDockDragGhost layout={dragGhostLayout} option={dock.draggedSurfaceOption} />
    </Layer>
  )
}
