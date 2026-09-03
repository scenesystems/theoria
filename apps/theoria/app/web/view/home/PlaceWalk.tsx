import * as Arr from "effect/Array"

import type { PlaceMarker } from "../../../contracts/imagined-place-result.js"

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

/**
 * The dotted walk is masked by a second copy of itself whose dash offset
 * animates from the full path length to zero, so the walk draws itself once
 * when the arrangement arrives. `pathLength="1"` makes the offset independent
 * of the path's real length. Under reduced motion the mask is simply full.
 */
export const PlaceWalk = ({ height, markers, width }: {
  readonly height: number
  readonly markers: ReadonlyArray<PlaceMarker>
  readonly width: number
}) => {
  const d = walkPath(markers)
  const maskId = `place-walk-${String(width)}-${String(markers.length)}`
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
        <path
          className="animate-path-draw fill-none stroke-ink-900"
          d={d}
          pathLength={1}
          strokeDasharray="1 1"
          strokeLinecap="round"
          strokeWidth={8}
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
