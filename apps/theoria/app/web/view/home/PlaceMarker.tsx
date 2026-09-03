import { Popover } from "@base-ui-components/react/popover"
import { Option } from "effect"
import type { CSSProperties } from "react"

import type { PlaceMarker as Marker } from "../../../contracts/imagined-place-result.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { TagBadge } from "../primitives/TagBadge.js"

import { discClassName, markerContributor, markerLabel, markerTone, participantLabel } from "./placeViewModel.js"

/** Position with `translate`, which the compositor animates without re-laying out the text. */
const markerStyle = (marker: Marker): CSSProperties => ({
  translate: `${(marker.x - marker.radius).toFixed(1)}px ${(marker.y - marker.radius).toFixed(1)}px`,
  width: `${(marker.radius * 2).toFixed(1)}px`,
  height: `${(marker.radius * 2).toFixed(1)}px`
})

/**
 * Every trial the search accepts moves a marker a little; a merged proposal's
 * marker grows in from nothing. Both stop under `prefers-reduced-motion`, and
 * while the trace is scrubbed, when whole arrangements are swapped outright.
 */
const motionClassName =
  "transition-[translate,width,height,opacity,scale,box-shadow] duration-200 ease-out starting:scale-90 starting:opacity-0 motion-reduce:transition-none group-data-[place-scrubbing]/stage:transition-none"

const triggerClassName =
  "absolute left-0 top-0 flex cursor-default items-center justify-center rounded-full px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-0 data-[popup-open]:ring-2 data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-stage-0"

/** Named discs clip their label to the circle. */
const namedTriggerClassName = "overflow-hidden"

/**
 * Numbered discs can be drawn well under 44 px on a phone; an invisible ring
 * around them keeps the touch target at least that large without changing
 * the drawing.
 */
const numberedTriggerClassName = "before:absolute before:-inset-1 before:rounded-full before:content-['']"

const popupClassName = [
  "w-64 rounded-lg border border-stage-200/90 bg-stage-0/96 px-3 py-2.5 shadow-chip outline-none backdrop-blur-sm",
  "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
  "motion-reduce:transition-none"
].join(" ")

/**
 * One feature on the stage. The disc is a button: hover, focus or tap opens
 * the feature's description and who added it, so nothing about the place is
 * hover-only. Its accessible name is the same text the legend uses. The name
 * is drawn on the disc at the width it was measured to fit, wrapping as
 * measured; a disc too small for its name shows its number instead.
 */
export const PlaceMarkerDisc = ({ index, labelWidth, marker }: {
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
}) => {
  const role = markerContributor(marker)
  const tone = markerTone(marker)
  const named = Option.isSome(labelWidth)

  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        aria-label={markerLabel(marker)}
        className={`${triggerClassName} ${
          named ? namedTriggerClassName : numberedTriggerClassName
        } ${motionClassName} ${discClassName(role)} ${tone.focusRing}`}
        closeDelay={80}
        data-place-marker={marker.name}
        delay={120}
        openOnHover
        style={markerStyle(marker)}
      >
        {Option.match(labelWidth, {
          onNone: () => (
            <SemanticText as="span" className={tone.textStrong} role="tab-label" text={String(index + 1)} />
          ),
          onSome: (width) => (
            <Layer className="shrink-0" style={{ width: `${width.toFixed(1)}px` }}>
              <SemanticText
                as="p"
                className={`w-full ${tone.textStrong}`}
                role="marker-label"
                text={marker.name}
                variant="compact"
              />
            </Layer>
          )
        })}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="center" collisionPadding={12} side="top" sideOffset={8}>
          <Popover.Popup className={popupClassName}>
            <Stack className="gap-1.5">
              <Cluster className="items-baseline gap-x-2 gap-y-1">
                <Popover.Title render={<Layer className="min-w-0 max-w-full" />}>
                  <SemanticText
                    as="h3"
                    className="truncate text-ink-900"
                    role="selection-title"
                    text={marker.name}
                    variant="compact"
                    wrapAuthority="native-browser"
                  />
                </Popover.Title>
                <TagBadge name={participantLabel(role)} tone={tone} />
              </Cluster>
              <Popover.Description render={<Layer />}>
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={marker.description}
                  variant="compact"
                  wrapAuthority="native-browser"
                />
              </Popover.Description>
            </Stack>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
