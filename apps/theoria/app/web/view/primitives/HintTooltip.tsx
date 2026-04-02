import { Tooltip } from "@base-ui-components/react/tooltip"
import { InformationCircleIcon } from "@heroicons/react/20/solid"

import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const triggerClassName =
  "inline-flex items-center justify-center rounded-md p-1 text-ink-700 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25"

const popupClassName = [
  "w-72 rounded-lg border border-stage-200/90 bg-stage-0/96 px-3 py-2.5 shadow-chip backdrop-blur-sm",
  "transition-[opacity,transform] duration-150",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  "origin-[var(--transform-origin)]"
].join(" ")

export const HintTooltip = ({ text }: { readonly text: string }) => (
  <Tooltip.Root>
    <Tooltip.Trigger aria-label="Hint" className={triggerClassName}>
      <InformationCircleIcon aria-hidden className="h-4 w-4" />
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner align="center" collisionPadding={16} side="bottom" sideOffset={6}>
        <Tooltip.Popup className={popupClassName}>
          <Layer className="min-w-0">
            <SemanticText as="p" className="text-ink-800" role="status" text={text} variant="compact" />
          </Layer>
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
)
