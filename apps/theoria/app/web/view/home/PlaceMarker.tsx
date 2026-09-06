import { Popover } from "@base-ui/react/popover"
import { useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import type { PlaceMarker as Marker } from "../../../contracts/imagined-place-result.js"
import { type PlaceDiscDrawn, placeDiscDrawnAtom } from "../../atoms/imagined-place-render.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { ParticipantName } from "../primitives/ParticipantName.js"
import { SemanticText } from "../primitives/SemanticText.js"

import {
  discClassName,
  featureLayoutId,
  markerContributor,
  markerLabel,
  markerTone,
  participantLabel
} from "./placeViewModel.js"

/** Position with `translate`, which changes without re-laying out the text. */
const markerStyle = (marker: Marker): CSSProperties => ({
  translate: `${(marker.x - marker.radius).toFixed(1)}px ${(marker.y - marker.radius).toFixed(1)}px`,
  width: `${(marker.radius * 2).toFixed(1)}px`,
  height: `${(marker.radius * 2).toFixed(1)}px`
})

/**
 * Motion measures a settled disc only when it mounts or leaves: the hand-off
 * with its proposal's name. A constant dependency means nothing else about
 * the disc's render starts a layout animation. The search's own progress is
 * drawn state by state: each accepted trial reflows the text at once and
 * places the discs at once, so the text and the discs are always the same
 * arrangement, never a text flowing around where discs are still on their
 * way to.
 */
const layoutOnHandOffOnly = "hand-off"

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
 * A settled disc is the Motion node the feature travels as; a trial's disc is
 * a plain button. Neither has a CSS transition on its position: the only
 * movement a disc makes is its hand-off, and Motion alone makes it.
 */
const discElement = (drawn: Exclude<PlaceDiscDrawn, "arriving">, marker: Marker) =>
  Match.value(drawn).pipe(
    Match.when(
      "settled",
      () => (
        <m.button
          data-place-feature-travel={marker.name}
          layout="position"
          layoutDependency={layoutOnHandOffOnly}
          layoutId={featureLayoutId(marker.name)}
        />
      )
    ),
    Match.when("trial", () => <button />),
    Match.exhaustive
  )

/**
 * The room the search is making for a feature just merged, while it runs:
 * the ring is placed with the text, state by state, and the feature's name
 * travels into it when the search settles. Not a button, since the feature
 * is not on the stage yet; the name in its proposal still is.
 */
const ringClassName = "pointer-events-none absolute left-0 top-0 rounded-full border-2 border-dashed opacity-70"

const ArrivingRing = ({ marker }: { readonly marker: Marker }) => (
  <Layer
    aria-hidden
    className={`${ringClassName} ${markerTone(marker).border}`}
    data-place-marker-arriving={marker.name}
    style={markerStyle(marker)}
  />
)

const Disc = ({ drawn, index, labelWidth, marker }: {
  readonly drawn: Exclude<PlaceDiscDrawn, "arriving">
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
        className={`${triggerClassName} ${named ? namedTriggerClassName : numberedTriggerClassName} ${
          discClassName(role)
        } ${tone.focusRing}`}
        closeDelay={80}
        data-place-marker={marker.name}
        delay={120}
        openOnHover
        render={discElement(drawn, marker)}
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
                <ParticipantName name={participantLabel(role)} tone={tone} />
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
  const drawn = useAtomValue(placeDiscDrawnAtom(marker.name))
  return Match.value(drawn).pipe(
    Match.when("arriving", () => <ArrivingRing marker={marker} />),
    Match.orElse((present) => <Disc drawn={present} index={index} labelWidth={labelWidth} marker={marker} />)
  )
}
