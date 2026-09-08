import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import * as Arr from "effect/Array"
import * as m from "motion/react-m"

import type { PlaceMarker } from "../../../contracts/imagined-place-result.js"
import { type MotionPreference, motionPreferenceAtom } from "../../atoms/motion.js"
import { walkDrawTransition } from "../primitives/motion.js"

/**
 * The walk through the place: one dotted line through the markers in the
 * order the features were named, which is the order the meander places them.
 * Nothing about it is invented — the points are the marker centres — and it
 * is decoration for sighted visitors only, so it is hidden from the tree.
 */
const walkPath = (markers: ReadonlyArray<PlaceMarker>): string =>
  Arr.join(
    Arr.map(markers, (marker, index) => `${index === 0 ? "M" : "L"}${marker.x.toFixed(1)} ${marker.y.toFixed(1)}`),
    " "
  )

const undrawn = { pathLength: 0 }
const drawn = { pathLength: 1 }

/**
 * How the mask draws: from nothing to the whole path over the walk's time, or
 * — under reduced motion, since a line drawing itself is movement — whole
 * from its first frame, with no undrawn state written for Motion to cancel.
 */
const drawing = (preference: MotionPreference) =>
  Match.value(preference).pipe(
    Match.when("full", () => ({ initial: undrawn, animate: drawn, transition: walkDrawTransition })),
    Match.when("reduced", () => ({ initial: false, animate: drawn })),
    Match.exhaustive
  )

/**
 * The dotted walk is masked by a second copy of itself whose drawn length
 * Motion animates from nothing to the whole path, so the walk draws itself
 * once when the arrangement arrives. Motion normalises the path's length to
 * 1 and writes the dash array and offset itself, so the draw is independent
 * of the path's real length.
 */
export const PlaceWalk = ({ height, markers, width }: {
  readonly height: number
  readonly markers: ReadonlyArray<PlaceMarker>
  readonly width: number
}) => {
  const d = walkPath(markers)
  const maskId = `place-walk-${String(width)}-${String(markers.length)}`
  const preference = useAtomValue(motionPreferenceAtom)
  return markers.length < 2 ? null : (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      data-place-walk
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
    >
      {/* Alpha mask: any opaque stroke reveals, so the theme's colours do not matter here. */}
      <mask id={maskId} maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <m.path
          className="fill-none stroke-ink-900"
          d={d}
          strokeLinecap="round"
          strokeWidth={8}
          {...drawing(preference)}
        />
      </mask>
      <path
        className="fill-none stroke-stage-400"
        d={d}
        mask={`url(#${maskId})`}
        strokeDasharray="1 7"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  )
}
