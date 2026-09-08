import { useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import { minimumTouchTarget, touchReach } from "../../../contracts/demo/imagined-place-flow.js"
import type { PlaceSourceId } from "../../../contracts/demo/imagined-place-provenance.js"
import type { PlaceMarker as Marker } from "../../../contracts/imagined-place-result.js"
import { placeActAtom } from "../../atoms/imagined-place-experience.js"
import type { PlaceDiscDrawn } from "../../atoms/imagined-place-render.js"
import { type MotionPreference, motionPreferenceAtom } from "../../atoms/motion.js"
import { forcedColorsFocusClassName } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { departed, exitTransition } from "../primitives/motion.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { ProvenanceMark } from "./PlaceProvenance.js"
import {
  discActOutline,
  discClassName,
  discFocusRing,
  markerContributor,
  markerLabel,
  markerTone
} from "./placeViewModel.js"

/** The diameter a disc is drawn at, to the tenth of a pixel. */
const drawnDiameter = (marker: Marker): number => Number((marker.radius * 2).toFixed(1))

/** Position with `translate`, which changes without re-laying out the text. */
const markerStyle = (marker: Marker): CSSProperties => ({
  translate: `${(marker.x - marker.radius).toFixed(1)}px ${(marker.y - marker.radius).toFixed(1)}px`,
  width: `${String(drawnDiameter(marker))}px`,
  height: `${String(drawnDiameter(marker))}px`
})

/**
 * A disc's only Motion is in place: it fills the room its ring marked when
 * the search settles, and fades where it stands when its feature is
 * declined. Nothing about a disc ever travels by Motion: the search's own
 * progress is drawn frame by frame by the render atom, the discs moving to
 * each new arrangement with the text flowed around them at every step, so
 * the text and the discs are always one arrangement. A disc Motion moved on
 * its own would be somewhere the text was not flowed around — over it.
 */
const filledFrom = { opacity: 0, scale: 0.9 }
const filled = { opacity: 1, scale: 1 }
const leaving = { ...departed, transition: exitTransition }

/**
 * How a settled disc fills in: hidden and a touch small, growing to size.
 * Under reduced motion it fills in by opacity alone — no scale is written
 * for Motion to cancel, so no transform is ever on the disc, not even for
 * the frame between its first paint and Motion's first.
 */
const filling = (preference: MotionPreference) =>
  Match.value(preference).pipe(
    Match.when("full", () => ({ initial: filledFrom, animate: filled })),
    Match.when("reduced", () => ({ initial: departed, animate: { opacity: 1 } })),
    Match.exhaustive
  )

/**
 * The outline answers the act in view and the ring the mark under the
 * pointer; both are always drawn, transparent when silent, so only their
 * colours transition. Opacity is Motion's and is not transitioned. Discs
 * stand above the prose lines (`z-10` within the stage's own stacking
 * context), so a touch on a disc's reach is the disc's where a line runs
 * beside it.
 */
const triggerClassName =
  `absolute left-0 top-0 z-10 flex cursor-default items-center justify-center rounded-full px-1 text-center outline outline-2 outline-offset-2 transition-[outline-color,box-shadow] duration-300 ease-theme motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-0 ${forcedColorsFocusClassName} data-[popup-open]:ring-2 data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-stage-0 data-[place-focused]:ring-offset-2 data-[place-focused]:ring-offset-stage-0`

/** A named disc's label is clipped to the width it was measured to fit. */
const labelClassName = "shrink-0 overflow-hidden"

/**
 * A disc can be drawn well under 44 px on a phone. Its reach — an invisible
 * ring, part of the disc and clipped by nothing — makes its touch target up
 * to that size without changing the drawing; the geometry already keeps the
 * reaches of neighbouring discs apart (`touchReach`).
 */
const reachClassName = "absolute rounded-full"

/**
 * The reach is the minimum target itself, centred on the disc as drawn — not
 * the disc grown by a rounded margin, which could stand a snapped fraction
 * short of the promise or a fraction into a neighbour's reach.
 */
const reachStyle = (marker: Marker): CSSProperties => {
  const offset = `${((drawnDiameter(marker) - minimumTouchTarget) / 2).toFixed(2)}px`
  return {
    width: `${String(minimumTouchTarget)}px`,
    height: `${String(minimumTouchTarget)}px`,
    left: offset,
    top: offset
  }
}

const Reach = ({ marker }: { readonly marker: Marker }) =>
  touchReach(marker.radius) > 0
    ? <Layer aria-hidden className={reachClassName} data-place-reach style={reachStyle(marker)} />
    : null

/** A disc the visitor can point at: settled on the stage, or a trial's, placed outright as the trace is scrubbed. */
type DiscPresent = Exclude<PlaceDiscDrawn, "arriving" | "leaving">

/**
 * A settled disc fills in where it stands, and fades there only if its
 * feature leaves the drawing outright — placed by a search under reduced
 * motion, or a trial scrubbed away; a trial's disc is a plain button, placed
 * outright as the trace is scrubbed. Neither has a CSS transition on its
 * position: the search's movement is drawn by the frames themselves.
 */
const discElement = (drawn: DiscPresent, preference: MotionPreference) =>
  Match.value(drawn).pipe(
    Match.when("settled", () => <m.button exit={leaving} {...filling(preference)} />),
    Match.when("trial", () => <button />),
    Match.exhaustive
  )

/**
 * The room the search is making for a feature just merged, while it runs:
 * the ring is placed with the text, state by state, and the disc fills it
 * when the search settles. Not a button, since the feature is not on the
 * stage yet; its name in the proposal still is.
 */
const ringClassName = "pointer-events-none absolute left-0 top-0 rounded-full border-2 border-dashed opacity-70"

const ArrivingRing = ({ marker }: { readonly marker: Marker }) => (
  <Layer
    render={<m.div exit={departed} transition={exitTransition} />}
    aria-hidden
    className={`${ringClassName} ${markerTone(marker).border}`}
    data-place-marker-arriving={marker.name}
    style={markerStyle(marker)}
  />
)

/**
 * A disc whose feature is leaving the drawing — declined, or gone with the
 * story — shrinking away where it stood as the drawing travels, the text
 * flowed around it to the last. It is no longer a mark: its name left with
 * the feature, so it carries no label and answers nothing, and the pointer
 * goes through it. It stands in the disc's own place in the presence, so the
 * disc becomes it outright rather than fading, at its full size, over lines
 * flowed around what it is shrinking to.
 */
const leavingClassName = "pointer-events-none absolute left-0 top-0 rounded-full"

const LeavingDisc = ({ marker }: { readonly marker: Marker }) => (
  <Layer
    render={<m.div exit={departed} transition={exitTransition} />}
    aria-hidden
    className={`${leavingClassName} ${discClassName(markerContributor(marker))}`}
    data-place-marker={marker.name}
    data-place-marker-leaving
    style={markerStyle(marker)}
  />
)

/**
 * A disc is a mark of the one answer surface: pointing at it opens the
 * feature's description, who added it and the call that placed it. It also
 * answers back — to the act being read, with an outline, and to the code
 * line that made it, with a ring.
 */
const Disc = ({ drawn, index, labelWidth, marker, source }: {
  readonly drawn: DiscPresent
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
  readonly source: PlaceSourceId
}) => {
  const role = markerContributor(marker)
  const tone = markerTone(marker)
  const preference = useAtomValue(motionPreferenceAtom)
  const act = useAtomValue(placeActAtom)

  return (
    <ProvenanceMark
      aria-label={markerLabel(marker)}
      className={`${triggerClassName} ${discClassName(role)} ${tone.focusRing} ${discFocusRing(role)} ${
        discActOutline(act, marker)
      }`}
      data-place-marker={marker.name}
      mark={{ _tag: "Disc", name: marker.name, source }}
      render={discElement(drawn, preference)}
      style={markerStyle(marker)}
    >
      <Reach marker={marker} />
      {Option.match(labelWidth, {
        onNone: () => <SemanticText as="span" className={tone.textStrong} role="tab-label" text={String(index + 1)} />,
        onSome: (width) => (
          <Layer className={labelClassName} style={{ width: `${width.toFixed(1)}px` }}>
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
    </ProvenanceMark>
  )
}

/**
 * One feature on the stage. The disc is a button: hover, focus or tap opens
 * the feature's description and who added it, so nothing about the place is
 * hover-only. Its accessible name is the same text the legend uses. The name
 * is drawn on the disc at the width it was measured to fit, wrapping as
 * measured; a disc too small for its name shows its number instead.
 *
 * The ring and the disc stand in the same place; when the search settles,
 * the ring fades as the disc fills it. A disc whose feature is leaving stands
 * in the disc's place and shrinks with the drawing; `propagate` lets whatever
 * stands there fade out — by then nothing, or a disc placed outright — when
 * the feature has left the drawing.
 *
 * How the disc is drawn comes with the frame it stands in, from the stage: a
 * disc held by Motion while it leaves is not redrawn by frames it is not in.
 */
const Standing = ({ drawn, index, labelWidth, marker, source }: {
  readonly drawn: Exclude<PlaceDiscDrawn, "arriving">
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
  readonly source: PlaceSourceId
}) =>
  Match.value(drawn).pipe(
    Match.when("leaving", () => <LeavingDisc marker={marker} />),
    Match.whenOr(
      "settled",
      "trial",
      (present) => <Disc drawn={present} index={index} labelWidth={labelWidth} marker={marker} source={source} />
    ),
    Match.exhaustive
  )

export const PlaceMarkerDisc = ({ drawn, index, labelWidth, marker, source }: {
  readonly drawn: PlaceDiscDrawn
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
  readonly source: PlaceSourceId
}) => (
  <AnimatePresence initial={false} propagate>
    {Match.value(drawn).pipe(
      Match.when("arriving", () => <ArrivingRing key="room" marker={marker} />),
      Match.whenOr(
        "settled",
        "trial",
        "leaving",
        (standing) => (
          <Standing
            drawn={standing}
            index={index}
            key="disc"
            labelWidth={labelWidth}
            marker={marker}
            source={source}
          />
        )
      ),
      Match.exhaustive
    )}
  </AnimatePresence>
)
