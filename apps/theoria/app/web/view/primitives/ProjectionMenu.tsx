import { Button } from "@base-ui/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Bars2Icon, EyeIcon, EyeSlashIcon, ViewColumnsIcon, XMarkIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"
import type { PointerEvent } from "react"
import { useRef } from "react"

import {
  hiddenSurfaces,
  projectedSurfaces,
  type ProjectionModel,
  type ProjectionPlane,
  type ProjectionSurface
} from "../../../contracts/presentation/projection.js"
import {
  clearProjectionDragAtom,
  moveProjectionDragOverAtom,
  projectionDragOverIndexAtom,
  projectionDragPlaneAtom,
  projectionPanelOpenAtom,
  startProjectionDragAtom,
  toggleProjectionPanelAtom
} from "../../atoms/surface/projection.js"

import { chromeHeaderGlyphClassName, chromeIconButtonClassName } from "./ChromeIconButton.js"
import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const panelClassName = (open: boolean): string =>
  [
    "fixed inset-y-0 right-0 z-50 flex w-56 flex-col border-l border-stage-200/90 bg-stage-0/96 shadow-[-12px_0_36px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl",
    "transition-transform duration-200 ease-out",
    open ? "translate-x-0" : "translate-x-full"
  ].join(" ")

const projectedRowClassName = ({
  dragging,
  dropTarget,
  focused
}: {
  readonly dragging: boolean
  readonly dropTarget: boolean
  readonly focused: boolean
}): string =>
  [
    "flex w-full cursor-grab select-none items-center gap-1 rounded-md px-2 py-1.5 transition-[background-color,opacity,border-color] duration-100 active:cursor-grabbing",
    dragging
      ? "opacity-40"
      : focused
      ? "bg-stage-100/80 text-ink-900"
      : "text-ink-800 hover:bg-stage-50/80",
    dropTarget
      ? "border-t-2 border-ink-900/40"
      : "border-t-2 border-transparent"
  ].join(" ")

const hiddenRowClassName =
  "flex w-full cursor-grab select-none items-center gap-1 rounded-md px-2 py-1.5 text-ink-500 transition-colors duration-100 hover:bg-stage-50/60 hover:text-ink-700 active:cursor-grabbing"

const actionButtonClassName =
  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 transition-colors duration-100 hover:bg-stage-100/80 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const closeButtonClassName =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors duration-100 hover:bg-stage-100/80 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

const gripClassName = "h-3 w-3 shrink-0 text-ink-400"

const DRAG_THRESHOLD = 4

type Gesture = {
  readonly pointerId: number
  readonly startY: number
  dragging: boolean
}

export const ProjectionMenuTrigger = ({
  projected,
  max
}: {
  readonly projected: number
  readonly max: number
}) => {
  const open = useAtomValue(projectionPanelOpenAtom)
  const toggle = useAtomSet(toggleProjectionPanelAtom)

  return (
    <Button
      aria-label={`Toggle projection panel (${projected}/${max})`}
      className={chromeIconButtonClassName({
        active: open,
        className: "w-auto gap-1.5 rounded-[1rem] px-3 sm:gap-2 sm:px-4"
      })}
      onClick={() => {
        toggle()
      }}
      type="button"
    >
      <ViewColumnsIcon aria-hidden className={chromeHeaderGlyphClassName} />
      <SemanticText
        as="span"
        className="hidden sm:inline"
        role="button-label"
        text={`${projected}/${max}`}
        variant="compact"
      />
    </Button>
  )
}

const DraggableRow = ({
  index,
  isProjected,
  surface,
  projectedCount,
  maxCount,
  onFocusSurface,
  onHideSurface,
  onProjectSurface
}: {
  readonly index: number
  readonly isProjected: boolean
  readonly surface: ProjectionSurface
  readonly projectedCount: number
  readonly maxCount: number
  readonly onFocusSurface: (plane: ProjectionPlane) => void
  readonly onHideSurface: (plane: ProjectionPlane) => void
  readonly onProjectSurface: (plane: ProjectionPlane) => void
}) => {
  const gestureRef = useRef<Gesture | null>(null)
  const dragPlane = useAtomValue(projectionDragPlaneAtom)
  const dragOverIndex = useAtomValue(projectionDragOverIndexAtom)
  const startDrag = useAtomSet(startProjectionDragAtom)
  const moveDragOver = useAtomSet(moveProjectionDragOverAtom)
  const clearDrag = useAtomSet(clearProjectionDragAtom)

  const dragging = dragPlane === surface.id
  const dropTarget = isProjected && dragPlane !== null && dragOverIndex === index && dragPlane !== surface.id

  const hitTestDropIndex = (clientY: number): number | null => {
    const rows = Arr.fromIterable(document.querySelectorAll("[data-projection-row-index]"))

    return rows.reduce<{ readonly index: number | null; readonly dist: number }>(
      (best, el) => {
        if (!(el instanceof HTMLElement)) return best

        const rowIndex = Number(el.dataset.projectionRowIndex)

        if (Number.isNaN(rowIndex)) return best

        const rect = el.getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        const dist = Math.abs(clientY - midY)

        return dist < best.dist
          ? { index: clientY < midY ? rowIndex : rowIndex + 1, dist }
          : best
      },
      { index: null, dist: Infinity }
    ).index
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || gestureRef.current !== null) return

    event.currentTarget.setPointerCapture(event.pointerId)

    gestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      dragging: false
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current

    if (gesture === null || gesture.pointerId !== event.pointerId) return

    if (!gesture.dragging) {
      if (Math.abs(event.clientY - gesture.startY) < DRAG_THRESHOLD) return

      gesture.dragging = true
      startDrag(surface.id)
      return
    }

    const idx = hitTestDropIndex(event.clientY)
    moveDragOver(idx)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current

    if (gesture === null || gesture.pointerId !== event.pointerId) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    gestureRef.current = null

    if (!gesture.dragging) {
      if (isProjected) {
        onFocusSurface(surface.id)
      } else if (projectedCount < maxCount) {
        onProjectSurface(surface.id)
      }

      return
    }

    clearDrag()
  }

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current

    if (gesture === null || gesture.pointerId !== event.pointerId) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    gestureRef.current = null
    clearDrag()
  }

  if (isProjected) {
    return (
      <Layer
        className={projectedRowClassName({ dragging, dropTarget, focused: surface.focused })}
        data-projection-row-index={String(index)}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Bars2Icon aria-hidden className={gripClassName} />
        <SemanticText
          as="span"
          className="min-w-0 flex-1 truncate text-inherit"
          role="tab-label"
          text={surface.label}
          variant="compact"
        />
        {projectedCount > 1
          ? (
            <Button
              aria-label={`Hide ${surface.label}`}
              className={actionButtonClassName}
              onClick={(event) => {
                event.stopPropagation()
                onHideSurface(surface.id)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              type="button"
            >
              <EyeSlashIcon aria-hidden className="h-3 w-3" />
            </Button>
          )
          : null}
      </Layer>
    )
  }

  return (
    <Layer
      className={hiddenRowClassName}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <SemanticText
        as="span"
        className="min-w-0 flex-1 truncate text-inherit"
        role="tab-label"
        text={surface.label}
        variant="compact"
      />
      <Button
        aria-label={`Show ${surface.label}`}
        className={actionButtonClassName}
        disabled={projectedCount >= maxCount}
        onClick={(event) => {
          event.stopPropagation()
          onProjectSurface(surface.id)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        type="button"
      >
        <EyeIcon aria-hidden className="h-3 w-3" />
      </Button>
    </Layer>
  )
}

export const ProjectionPanel = ({
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  onReorderSurface,
  projection
}: {
  readonly onFocusSurface: (plane: ProjectionPlane) => void
  readonly onHideSurface: (plane: ProjectionPlane) => void
  readonly onProjectSurface: (plane: ProjectionPlane) => void
  readonly onReorderSurface: (plane: ProjectionPlane, index: number) => void
  readonly projection: ProjectionModel
}) => {
  const open = useAtomValue(projectionPanelOpenAtom)
  const toggle = useAtomSet(toggleProjectionPanelAtom)
  const dragPlane = useAtomValue(projectionDragPlaneAtom)
  const dragOverIndex = useAtomValue(projectionDragOverIndexAtom)
  const clearDrag = useAtomSet(clearProjectionDragAtom)

  const projected = projectedSurfaces(projection.surfaces)
  const hidden = hiddenSurfaces(projection.surfaces)

  const onPointerUpCapture = (): void => {
    if (dragPlane === null) return

    const isProjected = projected.some((s) => s.id === dragPlane)

    if (dragOverIndex !== null) {
      if (isProjected) {
        onReorderSurface(dragPlane, dragOverIndex)
      } else {
        onProjectSurface(dragPlane)
        onReorderSurface(dragPlane, dragOverIndex)
      }
    }

    clearDrag()
  }

  return (
    <Layer
      as="aside"
      aria-label="Projection surfaces"
      className={panelClassName(open)}
      onPointerUp={onPointerUpCapture}
    >
      <Layer className="flex shrink-0 items-center justify-between border-b border-stage-200/80 px-3 py-2.5">
        <SemanticText
          as="h2"
          className="text-ink-700 uppercase tracking-[0.14em]"
          role="code-meta"
          text="Surfaces"
          variant="compact"
        />
        <Button
          aria-label="Close projection panel"
          className={closeButtonClassName}
          onClick={() => {
            toggle()
          }}
          type="button"
        >
          <XMarkIcon aria-hidden className="h-4 w-4" />
        </Button>
      </Layer>

      <Stack className="flex-1 gap-0 overflow-y-auto px-1.5 py-1.5">
        {projected.map((surface, index) => (
          <DraggableRow
            key={surface.id}
            index={index}
            isProjected
            maxCount={projection.maxProjectedCount}
            onFocusSurface={onFocusSurface}
            onHideSurface={onHideSurface}
            onProjectSurface={onProjectSurface}
            projectedCount={projected.length}
            surface={surface}
          />
        ))}

        {hidden.length > 0
          ? (
            <>
              <Layer aria-hidden className="mx-2 my-1.5 h-px bg-stage-200/70" />
              {hidden.map((surface) => (
                <DraggableRow
                  key={surface.id}
                  index={-1}
                  isProjected={false}
                  maxCount={projection.maxProjectedCount}
                  onFocusSurface={onFocusSurface}
                  onHideSurface={onHideSurface}
                  onProjectSurface={onProjectSurface}
                  projectedCount={projected.length}
                  surface={surface}
                />
              ))}
            </>
          )
          : null}
      </Stack>
    </Layer>
  )
}
