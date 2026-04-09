export type ProjectionDockGhostTarget = {
  readonly width: number
  readonly x: number
  readonly y: number
}

const projectionDockHideTargetAttribute = "data-projection-hide-target"
const projectionDockHideTargetValue = "true"
const projectionDockLotIndexAttribute = "data-projection-lot-index"
const projectionDockLaneTargetAttribute = "data-projection-lane-target"
const projectionDockLaneTargetValue = "true"

export const projectionDockHideTargetProps = (): Record<string, string> => ({
  [projectionDockHideTargetAttribute]: projectionDockHideTargetValue
})

export const projectionDockLotIndexProps = (lotIndex: number): Record<string, string> => ({
  [projectionDockLotIndexAttribute]: `${lotIndex}`
})

export const projectionDockLaneTargetProps = (): Record<string, string> => ({
  [projectionDockLaneTargetAttribute]: projectionDockLaneTargetValue
})

export const projectionDockHideTargetSelector =
  `[${projectionDockHideTargetAttribute}='${projectionDockHideTargetValue}']`

export const projectionDockLotIndexSelector = `[${projectionDockLotIndexAttribute}]`

export const projectionDockLaneTargetSelector =
  `[${projectionDockLaneTargetAttribute}='${projectionDockLaneTargetValue}']`

export type ProjectionDockDragTarget =
  | {
    readonly _tag: "EmptyProjectionDockDragTarget"
    readonly ghostTarget: null
  }
  | {
    readonly _tag: "HideProjectionDockDragTarget"
    readonly ghostTarget: ProjectionDockGhostTarget
  }
  | {
    readonly _tag: "SlotProjectionDockDragTarget"
    readonly ghostTarget: ProjectionDockGhostTarget | null
    readonly lotIndex: number
  }

const emptyProjectionDockDragTarget = (): Extract<
  ProjectionDockDragTarget,
  { readonly _tag: "EmptyProjectionDockDragTarget" }
> => ({
  _tag: "EmptyProjectionDockDragTarget",
  ghostTarget: null
})

const projectionDockGhostTargetFor = (element: HTMLElement): ProjectionDockGhostTarget => {
  const rect = element.getBoundingClientRect()

  return {
    width: rect.width,
    x: rect.left,
    y: rect.top
  }
}

export const projectionDockDropTargetAt = ({
  clientX,
  clientY
}: {
  readonly clientX: number
  readonly clientY: number
}): ProjectionDockDragTarget => {
  if (typeof document === "undefined") {
    return emptyProjectionDockDragTarget()
  }

  const target = document.elementFromPoint(clientX, clientY)

  if (!(target instanceof HTMLElement)) {
    return emptyProjectionDockDragTarget()
  }

  const hideTarget = target.closest(projectionDockHideTargetSelector)

  if (hideTarget instanceof HTMLElement) {
    return {
      _tag: "HideProjectionDockDragTarget",
      ghostTarget: projectionDockGhostTargetFor(hideTarget)
    }
  }

  const lotTarget = target.closest(projectionDockLotIndexSelector)

  if (!(lotTarget instanceof HTMLElement)) {
    return emptyProjectionDockDragTarget()
  }

  const lotIndex = Number(lotTarget.dataset.projectionLotIndex)
  const laneTarget = lotTarget.querySelector(projectionDockLaneTargetSelector)

  return Number.isInteger(lotIndex)
    ? {
      _tag: "SlotProjectionDockDragTarget",
      ghostTarget: laneTarget instanceof HTMLElement ? projectionDockGhostTargetFor(laneTarget) : null,
      lotIndex
    }
    : emptyProjectionDockDragTarget()
}
