import { useAtomValue } from "@effect-atom/atom-react"
import { Match, Option } from "effect"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { CSSProperties } from "react"

import type { PlaceSourceId } from "../../../contracts/demo/imagined-place-provenance.js"
import type { PlaceMarker as Marker } from "../../../contracts/imagined-place-result.js"
import { placeActAtom } from "../../atoms/imagined-place-experience.js"
import { type PlaceDiscDrawn, placeDiscDrawnAtom } from "../../atoms/imagined-place-render.js"
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

/** Position with `translate`, which changes without re-laying out the text. */
const markerStyle = (marker: Marker): CSSProperties => ({
  translate: `${(marker.x - marker.radius).toFixed(1)}px ${(marker.y - marker.radius).toFixed(1)}px`,
  width: `${(marker.radius * 2).toFixed(1)}px`,
  height: `${(marker.radius * 2).toFixed(1)}px`
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
 * colours transition. Opacity is Motion's and is not transitioned.
 */
const triggerClassName =
  `absolute left-0 top-0 flex cursor-default items-center justify-center rounded-full px-1 text-center outline outline-2 outline-offset-2 transition-[outline-color,box-shadow] duration-300 ease-theme motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-stage-0 ${forcedColorsFocusClassName} data-[popup-open]:ring-2 data-[popup-open]:ring-offset-2 data-[popup-open]:ring-offset-stage-0 data-[place-focused]:ring-offset-2 data-[place-focused]:ring-offset-stage-0`

/** Named discs clip their label to the circle. */
const namedTriggerClassName = "overflow-hidden"

/**
 * Numbered discs can be drawn well under 44 px on a phone; an invisible ring
 * around them keeps the touch target at least that large without changing
 * the drawing.
 */
const numberedTriggerClassName = "before:absolute before:-inset-1 before:rounded-full before:content-['']"

/**
 * A settled disc fills in and fades out where it stands; a trial's disc is a
 * plain button, placed outright as the trace is scrubbed. Neither has a CSS
 * transition on its position: the search's movement is drawn by the frames
 * themselves.
 */
const discElement = (drawn: Exclude<PlaceDiscDrawn, "arriving">, preference: MotionPreference) =>
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
 * A disc is a mark of the one answer surface: pointing at it opens the
 * feature's description, who added it and the call that placed it. It also
 * answers back — to the act being read, with an outline, and to the code
 * line that made it, with a ring.
 */
const Disc = ({ drawn, index, labelWidth, marker, source }: {
  readonly drawn: Exclude<PlaceDiscDrawn, "arriving">
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
  readonly source: PlaceSourceId
}) => {
  const role = markerContributor(marker)
  const tone = markerTone(marker)
  const named = Option.isSome(labelWidth)
  const preference = useAtomValue(motionPreferenceAtom)
  const act = useAtomValue(placeActAtom)

  return (
    <ProvenanceMark
      aria-label={markerLabel(marker)}
      className={`${triggerClassName} ${named ? namedTriggerClassName : numberedTriggerClassName} ${
        discClassName(role)
      } ${tone.focusRing} ${discFocusRing(role)} ${discActOutline(act, marker)}`}
      data-place-marker={marker.name}
      mark={{ _tag: "Disc", name: marker.name, source }}
      render={discElement(drawn, preference)}
      style={markerStyle(marker)}
    >
      {Option.match(labelWidth, {
        onNone: () => <SemanticText as="span" className={tone.textStrong} role="tab-label" text={String(index + 1)} />,
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
 * the ring fades as the disc fills it. `propagate` lets the disc fade out
 * where it stands when the whole feature leaves the drawing.
 */
export const PlaceMarkerDisc = ({ index, labelWidth, marker, source }: {
  readonly index: number
  readonly labelWidth: Option.Option<number>
  readonly marker: Marker
  readonly source: PlaceSourceId
}) => {
  const drawn = useAtomValue(placeDiscDrawnAtom(marker.name))
  return (
    <AnimatePresence initial={false} propagate>
      {Match.value(drawn).pipe(
        Match.when("arriving", () => <ArrivingRing key="room" marker={marker} />),
        Match.whenOr(
          "settled",
          "trial",
          (present) => (
            <Disc drawn={present} index={index} key="disc" labelWidth={labelWidth} marker={marker} source={source} />
          )
        ),
        Match.exhaustive
      )}
    </AnimatePresence>
  )
}
