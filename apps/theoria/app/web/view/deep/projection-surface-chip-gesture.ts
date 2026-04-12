import type { PointerEvent } from "react"
import { useRef } from "react"

import type { DeepDiveProjectionSurfaceOption } from "../../../contracts/presentation/deep-dive-projection.js"

type ProjectionSurfaceGesture = {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  dragging: boolean
}

export const useProjectionSurfaceChipGesture = ({
  dragging,
  onCompleteDragSurface,
  onFocusSurface,
  onMoveDragSurface,
  onProjectSurface,
  onStartDragSurface,
  option,
  projectIndex,
  setDraggedSurface
}: {
  readonly dragging: boolean
  readonly onCompleteDragSurface: (clientX: number, clientY: number) => void
  readonly onFocusSurface: (surface: DeepDiveProjectionSurfaceOption["id"]) => void
  readonly onMoveDragSurface: (clientX: number, clientY: number) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionSurfaceOption["id"], index?: number) => void
  readonly onStartDragSurface: (
    surface: DeepDiveProjectionSurfaceOption["id"],
    clientX: number,
    clientY: number
  ) => void
  readonly option: DeepDiveProjectionSurfaceOption
  readonly projectIndex: number | null
  readonly setDraggedSurface: (surface: DeepDiveProjectionSurfaceOption["id"] | null) => void
}) => {
  const gestureRef = useRef<ProjectionSurfaceGesture | null>(null)

  const releasePointer = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resetGesture = (): { readonly dragging: boolean } | null => {
    const gesture = gestureRef.current

    if (gesture === null) return null

    gestureRef.current = null

    return { dragging: gesture.dragging }
  }

  return {
    onPointerCancel: (event: PointerEvent<HTMLDivElement>): void => {
      const gesture = gestureRef.current

      if (gesture === null || gesture.pointerId !== event.pointerId) return

      releasePointer(event)
      resetGesture()

      if (dragging) {
        setDraggedSurface(null)
      }
    },
    onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) return

      gestureRef.current = {
        dragging: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>): void => {
      const gesture = gestureRef.current

      if (gesture === null || gesture.pointerId !== event.pointerId) return

      const deltaX = event.clientX - gesture.startX
      const deltaY = event.clientY - gesture.startY

      if (!gesture.dragging && Math.hypot(deltaX, deltaY) >= 6) {
        gesture.dragging = true
        onStartDragSurface(option.id, event.clientX, event.clientY)
      }

      if (gesture.dragging) {
        onMoveDragSurface(event.clientX, event.clientY)
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>): void => {
      const gesture = gestureRef.current

      if (gesture === null || gesture.pointerId !== event.pointerId) return

      releasePointer(event)
      const result = resetGesture()

      if (result === null) return

      if (result.dragging) {
        onCompleteDragSurface(event.clientX, event.clientY)
        return
      }

      if (option.projected) {
        onFocusSurface(option.id)
        return
      }

      if (projectIndex === null) {
        onProjectSurface(option.id)
        return
      }

      onProjectSurface(option.id, projectIndex)
    },
    stopPointerPropagation: (event: PointerEvent<HTMLElement>): void => {
      event.stopPropagation()
    }
  }
}
