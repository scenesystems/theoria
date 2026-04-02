import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { EyeSlashIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"
import { createPortal } from "react-dom"
import {
  clearDeepDiveDraggedSurfaceAtom,
  deepDiveDraggedSurfaceAtom,
  deepDiveDragGhostTargetAtom,
  deepDiveDragHoverHideTargetAtom,
  deepDiveDragHoverLotIndexAtom,
  deepDiveDragPointerAtom,
  dropDeepDiveDraggedSurfaceAtom,
  hideDeepDiveDraggedSurfaceAtom,
  setDeepDiveDragGhostTargetAtom,
  setDeepDiveDragHoverHideTargetAtom,
  setDeepDiveDragHoverLotIndexAtom,
  setDeepDiveDragPointerAtom,
  startDeepDiveSurfaceDragAtom
} from "../../atoms/deep-dive-layout.js"

import { surfaceMaterials } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SelectionCopy, SelectionRail } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"

import {
  type DeepDiveProjectionControlModel,
  hiddenProjectionSurfaces,
  projectedProjectionSurfaces
} from "./projection-model.js"
import { ProjectionFieldLot } from "./ProjectionFieldLot.js"
import { ProjectionSurfaceChip } from "./ProjectionSurfaceChip.js"

const dockShellClassName = "gap-5 px-4 py-4 sm:px-5"

const fieldShellClassName = "gap-1"

const hideDockClassName =
  "inline-flex min-h-11 items-center gap-2 border border-dashed border-stage-300/90 border-l-2 border-l-stage-400 bg-stage-50/60 px-3 text-ink-700 transition-colors duration-150"

const hideOverlayClassName =
  "absolute inset-x-0 bottom-0 flex justify-center border-t border-stage-200/70 bg-linear-to-t from-stage-0 via-stage-0/96 to-transparent px-2 pt-6 pb-1"

const dragGhostClassName =
  `${surfaceMaterials.supportPanel} pointer-events-none fixed z-[260] min-w-56 border-stage-300/95 bg-stage-0/96 px-3.5 py-3.5 shadow-[0_26px_54px_-28px_rgba(15,23,42,0.36)]`

const SectionHeading = ({
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
  const dragGhostTarget = useAtomValue(deepDiveDragGhostTargetAtom)
  const dragPointer = useAtomValue(deepDiveDragPointerAtom)
  const draggedSurface = useAtomValue(deepDiveDraggedSurfaceAtom)
  const hoveredHideTarget = useAtomValue(deepDiveDragHoverHideTargetAtom)
  const hoveredLotIndex = useAtomValue(deepDiveDragHoverLotIndexAtom)
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const hidden = hiddenProjectionSurfaces(projection.surfaces)
  const beginDragSurface = useAtomSet(startDeepDiveSurfaceDragAtom)
  const clearDraggedSurface = useAtomSet(clearDeepDiveDraggedSurfaceAtom)
  const dropDraggedSurface = useAtomSet(dropDeepDiveDraggedSurfaceAtom)
  const hideDraggedSurface = useAtomSet(hideDeepDiveDraggedSurfaceAtom)
  const setDragGhostTarget = useAtomSet(setDeepDiveDragGhostTargetAtom)
  const setDragPointer = useAtomSet(setDeepDiveDragPointerAtom)
  const setHoverHideTarget = useAtomSet(setDeepDiveDragHoverHideTargetAtom)
  const setHoverLotIndex = useAtomSet(setDeepDiveDragHoverLotIndexAtom)
  const draggingProjectedSurface = projected.some((surface) => surface.id === draggedSurface)
  const showLibrary = hidden.length > 0
  const showHideOverlay = draggingProjectedSurface && projected.length > 1 && hidden.length === 0
  const visibleLotCount = Math.min(
    projection.maxProjectedCount,
    projected.length + (hidden.length > 0 ? 1 : 0)
  )
  const setDraggedSurface = (surface: DeepDiveProjectionControlModel["focusedSurface"] | null): void => {
    if (surface === null) {
      clearDraggedSurface()
      return
    }

    beginDragSurface(surface)
  }
  const focusedProjectedIndex = projected.find((surface) => surface.focused)?.position ?? projected.at(-1)?.position ??
    0
  const projectIndex = projected.length < projection.maxProjectedCount ? projected.length : focusedProjectedIndex
  const draggedSurfaceOption = projection.surfaces.find((surface) => surface.id === draggedSurface) ?? null
  const projectedDetail = hidden.length === 0
    ? `${projected.length} bound · drag to reorder`
    : `${projected.length} bound · one slot open`
  const dragGhost = draggedSurfaceOption === null || dragPointer === null || typeof document === "undefined"
    ? null
    : createPortal(
      <Layer
        className={`${dragGhostClassName}${dragGhostTarget === null ? "" : " scale-[1.01]"}`}
        style={{
          left: `${dragGhostTarget?.x ?? dragPointer.x + 12}px`,
          top: `${dragGhostTarget?.y ?? dragPointer.y + 12}px`,
          width: dragGhostTarget === null ? undefined : `${dragGhostTarget.width}px`
        }}
      >
        <SelectionRail
          accent={<Layer aria-hidden className="w-1.5 self-stretch rounded-full bg-stage-400" />}
          className="items-stretch"
        >
          <SelectionCopy
            detail={draggedSurfaceOption.description}
            detailClassName="max-w-none text-ink-500"
            detailRole="status"
            title={draggedSurfaceOption.label}
            titleRole="section-title"
          />
        </SelectionRail>
      </Layer>,
      document.body
    )

  const dragTargetAt = (clientX: number, clientY: number): {
    readonly ghostTarget: { readonly width: number; readonly x: number; readonly y: number } | null
    readonly lotIndex: number | null
    readonly hideTarget: boolean
  } => {
    const target = document.elementFromPoint(clientX, clientY)

    if (!(target instanceof HTMLElement)) {
      return {
        ghostTarget: null,
        hideTarget: false,
        lotIndex: null
      }
    }

    const hideTarget = target.closest("[data-projection-hide-target='true']")

    if (hideTarget instanceof HTMLElement) {
      const rect = hideTarget.getBoundingClientRect()

      return {
        ghostTarget: {
          width: rect.width,
          x: rect.left,
          y: rect.top
        },
        hideTarget: true,
        lotIndex: null
      }
    }

    const lotTarget = target.closest("[data-projection-lot-index]")

    if (!(lotTarget instanceof HTMLElement)) {
      return {
        ghostTarget: null,
        hideTarget: false,
        lotIndex: null
      }
    }

    const laneTarget = lotTarget.querySelector("[data-projection-lane-target='true']")
    const lotIndex = Number(lotTarget.dataset.projectionLotIndex)

    return Number.isInteger(lotIndex)
      ? {
        ghostTarget: laneTarget instanceof HTMLElement
          ? {
            width: laneTarget.getBoundingClientRect().width,
            x: laneTarget.getBoundingClientRect().left,
            y: laneTarget.getBoundingClientRect().top
          }
          : null,
        hideTarget: false,
        lotIndex
      }
      : {
        ghostTarget: null,
        hideTarget: false,
        lotIndex: null
      }
  }

  const syncDragTarget = (clientX: number, clientY: number): void => {
    setDragPointer({ x: clientX, y: clientY })
    const { ghostTarget, hideTarget, lotIndex } = dragTargetAt(clientX, clientY)

    setDragGhostTarget(ghostTarget)
    setHoverLotIndex(lotIndex)
    setHoverHideTarget(hideTarget)
  }

  const completeDragSurface = (clientX: number, clientY: number): void => {
    const { hideTarget, lotIndex } = dragTargetAt(clientX, clientY)

    if (hideTarget) {
      hideDraggedSurface()
      return
    }

    if (lotIndex !== null) {
      dropDraggedSurface(lotIndex)
      return
    }

    clearDraggedSurface()
  }

  return (
    <Layer className="relative">
      <Stack className={dockShellClassName}>
        <SectionHeading detail={projectedDetail} text="Projected surfaces" />
        <Stack className={fieldShellClassName}>
          {Arr.map(Arr.range(0, visibleLotCount - 1), (index) => projected[index] ?? null).map((
            option,
            index
          ) => (
            <ProjectionFieldLot
              active={hoveredLotIndex === index}
              emptyLabel="Open slot"
              index={index}
              key={`lot-${index}`}
            >
              {option === null
                ? null
                : (
                  <ProjectionSurfaceChip
                    draggedSurface={draggedSurface}
                    onCompleteDragSurface={completeDragSurface}
                    onMoveDragSurface={syncDragTarget}
                    onStartDragSurface={(surface, clientX, clientY) => {
                      beginDragSurface(surface)
                      setDragGhostTarget(null)
                      setDragPointer({ x: clientX, y: clientY })
                    }}
                    onFocusSurface={onFocusSurface}
                    onHideSurface={onHideSurface}
                    onProjectSurface={onProjectSurface}
                    option={option}
                    projectedCount={projected.length}
                    setDraggedSurface={setDraggedSurface}
                  />
                )}
            </ProjectionFieldLot>
          ))}
        </Stack>

        {showLibrary
          ? (
            <Stack className="mt-3 gap-2 border-t border-stage-200/70 pt-2.5">
              <SectionHeading
                detail="Bind a surface into the open slot or drag it upward."
                text="Available surfaces"
              />
              <Stack className="gap-0">
                {hidden.map((option) => (
                  <ProjectionSurfaceChip
                    draggedSurface={draggedSurface}
                    key={option.id}
                    library
                    onCompleteDragSurface={completeDragSurface}
                    onMoveDragSurface={syncDragTarget}
                    onStartDragSurface={(surface, clientX, clientY) => {
                      beginDragSurface(surface)
                      setDragGhostTarget(null)
                      setDragPointer({ x: clientX, y: clientY })
                    }}
                    onFocusSurface={onFocusSurface}
                    onHideSurface={onHideSurface}
                    onProjectSurface={onProjectSurface}
                    projectIndex={projectIndex}
                    option={option}
                    projectedCount={projected.length}
                    setDraggedSurface={setDraggedSurface}
                  />
                ))}

                {draggingProjectedSurface && projected.length > 1
                  ? (
                    <Layer
                      className={[
                        hideDockClassName,
                        hoveredHideTarget ? "border-stage-400 bg-stage-100" : ""
                      ].join(" ")}
                      data-projection-hide-target="true"
                    >
                      <EyeSlashIcon aria-hidden className="h-4 w-4" />
                      <SemanticText as="span" role="code-meta" text="Drop to unbind" variant="compact" />
                    </Layer>
                  )
                  : null}
              </Stack>
            </Stack>
          )
          : null}
      </Stack>

      {showHideOverlay
        ? (
          <Layer
            className={hideOverlayClassName}
            data-projection-hide-target="true"
          >
            <Layer
              className={[
                hideDockClassName,
                hoveredHideTarget ? "border-stage-400 bg-stage-100" : ""
              ].join(" ")}
            >
              <EyeSlashIcon aria-hidden className="h-4 w-4" />
              <SemanticText as="span" role="code-meta" text="Drop to unbind" variant="compact" />
            </Layer>
          </Layer>
        )
        : null}

      {dragGhost}
    </Layer>
  )
}
