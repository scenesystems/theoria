import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"
import {
  clearDeepDiveDraggedSurfaceAtom,
  completeDeepDiveDraggedSurfaceAtom,
  deepDiveDragStateAtom,
  moveDeepDiveDraggedSurfaceAtom,
  startDeepDiveSurfaceDragAtom
} from "../../atoms/layout/deep-dive-drag.js"
import { projectionDockHideTargetProps } from "../../runtime/kernel/projection-dock-target.js"
import type { DeepDiveProjectionPlane } from "../../state/surface/deep-dive.js"

import { Layer, Stack } from "../primitives/Layout.js"
import {
  type DeepDiveProjectionControlModel,
  hiddenProjectionSurfaces,
  projectedProjectionSurfaces
} from "./projection-model.js"
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
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const hidden = hiddenProjectionSurfaces(projection.surfaces)
  const beginDragSurface = useAtomSet(startDeepDiveSurfaceDragAtom)
  const clearDraggedSurface = useAtomSet(clearDeepDiveDraggedSurfaceAtom)
  const completeDraggedSurface = useAtomSet(completeDeepDiveDraggedSurfaceAtom)
  const moveDraggedSurface = useAtomSet(moveDeepDiveDraggedSurfaceAtom)
  const draggingProjectedSurface = projected.some((surface) => surface.id === dragState.draggedSurface)
  const showLibrary = hidden.length > 0
  const showHideOverlay = draggingProjectedSurface && projected.length > 1 && hidden.length === 0
  const visibleLotCount = Math.min(
    projection.maxProjectedCount,
    projected.length + (hidden.length > 0 ? 1 : 0)
  )
  const projectedSlots = Arr.map(Arr.range(0, visibleLotCount - 1), (index) => ({
    active: dragState.hoveredLotIndex === index,
    index,
    option: projected[index] ?? null
  }))

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

  const focusedProjectedIndex = projected.find((surface) => surface.focused)?.position ?? projected.at(-1)?.position ??
    0
  const projectIndex = projected.length < projection.maxProjectedCount ? projected.length : focusedProjectedIndex
  const draggedSurfaceOption = projection.surfaces.find((surface) => surface.id === dragState.draggedSurface) ?? null
  const projectedDetail = hidden.length === 0
    ? `${projected.length} bound · drag to reorder`
    : `${projected.length} bound · one slot open`
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
  const dragGhostLayout = draggedSurfaceOption === null || dragState.dragPointer === null
    ? null
    : {
      left: dragState.dragGhostTarget?.x ?? dragState.dragPointer.x + 12,
      top: dragState.dragGhostTarget?.y ?? dragState.dragPointer.y + 12,
      ...(dragState.dragGhostTarget === null ? {} : { width: dragState.dragGhostTarget.width })
    }

  return (
    <Layer className="relative">
      <Stack className={dockShellClassName}>
        <ProjectionDockSectionHeading detail={projectedDetail} text="Projected surfaces" />
        <Stack className={slotShellClassName}>
          {projectedSlots.map(({ active, index, option }) => (
            <ProjectionFieldLot
              active={active}
              emptyLabel="Open slot"
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
                    projectedCount={projected.length}
                  />
                )}
            </ProjectionFieldLot>
          ))}
        </Stack>

        {showLibrary
          ? (
            <ProjectionDockLibrary
              dragInteraction={dragInteraction}
              hidden={hidden}
              hideTargetActive={dragState.hoveredHideTarget}
              onFocusSurface={onFocusSurface}
              onHideSurface={onHideSurface}
              onProjectSurface={onProjectSurface}
              projectIndex={projectIndex}
              projectedCount={projected.length}
              showHideTarget={draggingProjectedSurface && projected.length > 1}
            />
          )
          : null}
      </Stack>

      {showHideOverlay
        ? (
          <Layer
            className={hideOverlayClassName}
            {...projectionDockHideTargetProps()}
          >
            <ProjectionDockHideTarget active={dragState.hoveredHideTarget} />
          </Layer>
        )
        : null}

      <ProjectionDockDragGhost layout={dragGhostLayout} option={draggedSurfaceOption} />
    </Layer>
  )
}
