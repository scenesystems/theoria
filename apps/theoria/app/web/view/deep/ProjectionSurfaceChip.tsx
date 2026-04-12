import { Button } from "@base-ui-components/react/button"
import { LinkSlashIcon, PlusIcon } from "@heroicons/react/20/solid"

import {
  deepDiveProjectionSurfaceActionAriaLabel,
  deepDiveProjectionSurfaceActionLabel,
  type DeepDiveProjectionSurfaceOption
} from "../../../contracts/presentation/deep-dive-projection.js"
import { Layer } from "../primitives/Layout.js"
import { SelectionCopy, SelectionRail } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { surfaceMaterials } from "../primitives/theme/surface.js"

import { useProjectionSurfaceChipGesture } from "./projection-surface-chip-gesture.js"

const chipShellClassName = ({
  focused,
  dragging
}: {
  readonly dragging: boolean
  readonly focused: boolean
}): string =>
  [
    `${surfaceMaterials.supportPanel} flex min-h-[4.5rem] w-full min-w-0 cursor-grab select-none items-stretch rounded-[1.15rem] px-3.5 py-3.5 transition-[border-color,background-color,opacity,transform,box-shadow] duration-150 active:cursor-grabbing`,
    dragging
      ? "border-stage-400 bg-stage-50/82 opacity-72 shadow-[0_20px_46px_-28px_rgba(15,23,42,0.32)]"
      : focused
      ? "border-stage-400 bg-stage-0/94 shadow-chip"
      : "hover:border-stage-300 hover:bg-stage-0/92 hover:shadow-chip"
  ].join(" ")

const actionButtonClassName = ({
  emphasis,
  disabled
}: {
  readonly disabled: boolean
  readonly emphasis: "project" | "hide"
}): string =>
  [
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[0.85rem] border px-3 transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
    disabled
      ? "cursor-not-allowed border-stage-200/70 bg-stage-50/50 text-ink-400"
      : emphasis === "project"
      ? "border-stage-200/86 bg-stage-0/86 text-ink-900 hover:border-stage-300 hover:bg-stage-50/76"
      : "border-transparent bg-transparent text-ink-600 hover:border-stage-200/90 hover:bg-stage-50 hover:text-ink-900"
  ].join(" ")

const projectedActionButtonClassName = (disabled: boolean): string =>
  [
    "inline-flex h-8 w-8 items-center justify-center rounded-[0.8rem] border border-transparent text-ink-600 transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
    disabled
      ? "cursor-not-allowed text-ink-400"
      : "hover:border-stage-200/90 hover:bg-stage-50/80 hover:text-ink-900"
  ].join(" ")

const stripeClassName = ({
  dragging,
  focused
}: {
  readonly dragging: boolean
  readonly focused: boolean
}): string =>
  dragging
    ? "bg-stage-400"
    : focused
    ? "bg-ink-900"
    : "bg-stage-300/90"

export const ProjectionSurfaceChip = ({
  draggedSurface,
  library = false,
  onCompleteDragSurface,
  onMoveDragSurface,
  onStartDragSurface,
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  projectIndex,
  option,
  projectedCount,
  setDraggedSurface
}: {
  readonly draggedSurface: DeepDiveProjectionSurfaceOption["id"] | null
  readonly library?: boolean
  readonly onCompleteDragSurface: (clientX: number, clientY: number) => void
  readonly onMoveDragSurface: (clientX: number, clientY: number) => void
  readonly onStartDragSurface: (
    surface: DeepDiveProjectionSurfaceOption["id"],
    clientX: number,
    clientY: number
  ) => void
  readonly onFocusSurface: (surface: DeepDiveProjectionSurfaceOption["id"]) => void
  readonly onHideSurface: (surface: DeepDiveProjectionSurfaceOption["id"]) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionSurfaceOption["id"], index?: number) => void
  readonly projectIndex?: number
  readonly option: DeepDiveProjectionSurfaceOption
  readonly projectedCount: number
  readonly setDraggedSurface: (surface: DeepDiveProjectionSurfaceOption["id"] | null) => void
}) => {
  const dragging = draggedSurface === option.id
  const projected = option.projected || library
  const actionDisabled = option.projected && projectedCount === 1
  const actionEmphasis = option.projected ? "hide" : "project"
  const actionLabel = deepDiveProjectionSurfaceActionLabel(option.projected)
  const ActionIcon = option.projected ? LinkSlashIcon : PlusIcon
  const detail = projected ? option.description : null
  const projectedAction = option.projected
  const gesture = useProjectionSurfaceChipGesture({
    dragging,
    onCompleteDragSurface,
    onFocusSurface,
    onMoveDragSurface,
    onProjectSurface,
    onStartDragSurface,
    option,
    projectIndex: projectIndex ?? null,
    setDraggedSurface
  })

  return (
    <Layer
      className={chipShellClassName({
        dragging,
        focused: option.focused
      })}
      onPointerCancel={gesture.onPointerCancel}
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      title={option.description}
    >
      <SelectionRail
        action={
          <Button
            aria-label={deepDiveProjectionSurfaceActionAriaLabel({
              label: option.label,
              projected: option.projected
            })}
            className={projectedAction
              ? projectedActionButtonClassName(actionDisabled)
              : actionButtonClassName({ disabled: actionDisabled, emphasis: actionEmphasis })}
            disabled={actionDisabled}
            onPointerDown={gesture.stopPointerPropagation}
            onPointerUp={gesture.stopPointerPropagation}
            onClick={() => {
              if (option.projected) {
                onHideSurface(option.id)
                return
              }

              onProjectSurface(option.id, projectIndex)
            }}
            type="button"
          >
            <ActionIcon aria-hidden className="h-3.5 w-3.5" />
            {projectedAction
              ? null
              : <SemanticText as="span" role="code-meta" text={actionLabel} variant="compact" />}
          </Button>
        }
        actionClassName={projectedAction ? "self-start w-8" : "self-center"}
        accent={
          <Layer
            aria-hidden
            className={`w-1.5 self-stretch ${stripeClassName({ dragging, focused: option.focused })}`}
          />
        }
        className="min-h-full"
      >
        <SelectionCopy
          detail={detail}
          detailClassName="max-w-none text-ink-500"
          detailRole="status"
          title={option.label}
          titleRole="selection-title"
        />
      </SelectionRail>
    </Layer>
  )
}
