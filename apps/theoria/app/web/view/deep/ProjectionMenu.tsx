import { Popover } from "@base-ui-components/react/popover"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { ViewColumnsIcon } from "@heroicons/react/20/solid"
import {
  deepDiveProjectionMenuOpenAtom,
  setDeepDiveProjectionMenuOpenAtom
} from "../../atoms/layout/projection-menu.js"

import { chromeHeaderGlyphClassName, chromeIconButtonClassName } from "../primitives/ChromeIconButton.js"
import { surfaceMaterials } from "../primitives/designSystem.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { type DeepDiveProjectionControlModel, projectedProjectionSurfaces } from "./projection-model.js"
import { ProjectionDock } from "./ProjectionDock.js"

const projectionMenuId = "deep-dive-projection-menu"

const triggerAriaLabel = ({
  labels,
  maxProjectedCount,
  projectedCount
}: {
  readonly labels: string
  readonly maxProjectedCount: number
  readonly projectedCount: number
}): string => `Projection field: ${projectedCount} of ${maxProjectedCount} surfaces visible. ${labels}.`

export const ProjectionMenu = ({
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
  const open = useAtomValue(deepDiveProjectionMenuOpenAtom)
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const projectedLabels = projected.map((surface) => surface.label).join(", ")
  const setOpen = useAtomSet(setDeepDiveProjectionMenuOpenAtom)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
      }}
      triggerId={projectionMenuId}
    >
      <Popover.Trigger
        aria-label={triggerAriaLabel({
          labels: projectedLabels,
          maxProjectedCount: projection.maxProjectedCount,
          projectedCount: projected.length
        })}
        className={chromeIconButtonClassName({
          active: open,
          className: "w-auto gap-1.5 rounded-[1rem] px-3 sm:gap-2 sm:px-4"
        })}
        id={projectionMenuId}
      >
        <ViewColumnsIcon aria-hidden className={chromeHeaderGlyphClassName} />
        <SemanticText
          as="span"
          className="hidden sm:inline"
          role="button-label"
          text={`${projected.length}/${projection.maxProjectedCount}`}
          variant="compact"
        />
      </Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner
          align="end"
          className="z-[80]"
          collisionPadding={10}
          positionMethod="fixed"
          side="bottom"
          sideOffset={6}
        >
          <Popover.Popup
            className={[
              `w-[min(28rem,calc(100vw-1rem))] ${surfaceMaterials.evidenceToolbarDock}`,
              "origin-[var(--transform-origin)]",
              "transition-[opacity,transform] duration-75 ease-out data-[closed]:pointer-events-none",
              "data-[starting-style]:translate-y-[-1px] data-[starting-style]:scale-[0.99] data-[starting-style]:opacity-0",
              "data-[ending-style]:translate-y-[-1px] data-[ending-style]:scale-[0.99] data-[ending-style]:opacity-0"
            ].join(" ")}
          >
            <ProjectionDock
              onFocusSurface={onFocusSurface}
              onHideSurface={onHideSurface}
              onProjectSurface={onProjectSurface}
              projection={projection}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
