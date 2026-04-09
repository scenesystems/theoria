import { createPortal } from "react-dom"

import type { DeepDiveProjectionControlModel } from "./projection-model.js"

import { Layer } from "../primitives/Layout.js"
import { SelectionCopy, SelectionRail } from "../primitives/SelectionLayout.js"
import { surfaceMaterials } from "../primitives/theme/surface.js"

const dragGhostClassName =
  `${surfaceMaterials.supportPanel} pointer-events-none fixed z-[260] min-w-56 border-stage-300/95 bg-stage-0/96 px-3.5 py-3.5 shadow-[0_26px_54px_-28px_rgba(15,23,42,0.36)]`

type ProjectionDockDragGhostLayout = {
  readonly left: number
  readonly top: number
  readonly width?: number
}

export const ProjectionDockDragGhost = ({
  layout,
  option
}: {
  readonly layout: ProjectionDockDragGhostLayout | null
  readonly option: DeepDiveProjectionControlModel["surfaces"][number] | null
}) =>
  option === null || layout === null || typeof document === "undefined"
    ? null
    : createPortal(
      <Layer
        className={`${dragGhostClassName}${typeof layout.width === "number" ? " scale-[1.01]" : ""}`}
        style={{
          left: `${layout.left}px`,
          top: `${layout.top}px`,
          width: typeof layout.width === "number" ? `${layout.width}px` : undefined
        }}
      >
        <SelectionRail
          accent={<Layer aria-hidden className="w-1.5 self-stretch rounded-full bg-stage-400" />}
          className="items-stretch"
        >
          <SelectionCopy
            detail={option.description}
            detailClassName="max-w-none text-ink-500"
            detailRole="status"
            title={option.label}
            titleRole="selection-title"
          />
        </SelectionRail>
      </Layer>,
      document.body
    )
