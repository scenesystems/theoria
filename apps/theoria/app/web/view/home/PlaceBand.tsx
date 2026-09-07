import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"

import { placeBandAtom, placeFeatureFocusedAtom } from "../../atoms/imagined-place-experience.js"
import { placeDiscDrawnAtom, type PlaceRenderFrame, placeShownFrameAtom } from "../../atoms/imagined-place-render.js"
import { Layer } from "../primitives/Layout.js"
import { AnchorLink } from "../primitives/Link.js"
import { arrivalFrom, arrivedAt, departed, exitTransition } from "../primitives/motion.js"

import { imaginedPlaceSectionId } from "./HomeHero.js"
import { type BandDisc, bandDiscClassName, type BandRow, bandRow, markerContributor } from "./placeViewModel.js"

/**
 * The place as a band, pinned to the top of the viewport while the stage is
 * scrolled past: its discs in a row on a strip of paper, at the frame being
 * drawn, so a merge made from an act below the stage is seen arriving, and a
 * code line pointed at in the Build act lights the disc it made. It carries
 * no words: the prose and the names stay on the stage. It is one link back
 * to the stage; the drawing itself says nothing the stage does not.
 *
 * The band lives in the page's flow so the acts scroll under it as under a
 * header, and it ends with the demonstration. Its slot has no height: the
 * strip hangs below the slot's edge, so the band coming and going moves
 * nothing else on the page, and the stage — whose leaving the viewport the
 * band answers — stays where it was.
 */
const slotClassName = "sticky top-0 z-10 h-0"

const bandClassName = "flex justify-center pt-3"

/**
 * The strip is paper, raised above the page as the one thing there above it,
 * and never wider than the page gives; the row scales down to fit.
 */
const linkClassName =
  "block max-w-full rounded-instrument bg-world-paper ring-1 ring-world-rule shadow-surface outline-none transition-colors duration-(--th-motion-duration-shift) ease-theme focus-visible:ring-2 focus-visible:ring-ink-900/20"

const Disc = ({ cy, disc }: { readonly cy: number; readonly disc: BandDisc }) => {
  const drawn = useAtomValue(placeDiscDrawnAtom(disc.marker.name))
  const focused = useAtomValue(placeFeatureFocusedAtom(disc.marker.name))
  return (
    <m.circle
      animate={{ cx: disc.cx, opacity: 1 }}
      className={bandDiscClassName(markerContributor(disc.marker), drawn, focused)}
      cy={cy.toFixed(1)}
      data-place-band-disc={disc.marker.name}
      data-place-focused={focused ? "" : undefined}
      exit={{ opacity: 0, transition: exitTransition }}
      initial={{ cx: disc.cx, opacity: 0 }}
      r={disc.marker.radius.toFixed(1)}
    />
  )
}

/**
 * The row at its stage size, scaled down by the browser when the strip is
 * narrower: a viewBox, not a measured transform. Discs are keyed by name, so
 * a merge adds one and the rest slide over; a disc leaving fades.
 */
const Row = ({ row }: { readonly row: BandRow }) => (
  <svg
    aria-hidden
    className="block h-auto max-w-full"
    data-place-band-drawing
    height={row.height}
    viewBox={`0 0 ${String(row.width)} ${String(row.height)}`}
    width={row.width}
  >
    <AnimatePresence initial={false}>
      {Arr.map(row.discs, (disc) => <Disc cy={row.cy} disc={disc} key={disc.marker.name} />)}
    </AnimatePresence>
  </svg>
)

/** Arrives as anything on the page does and leaves quicker, so the stage coming back leads. */
const leaving = { ...departed, transition: exitTransition }

const Band = ({ frame }: { readonly frame: PlaceRenderFrame }) => (
  <Layer
    render={<m.div animate={arrivedAt} exit={leaving} initial={arrivalFrom} />}
    className={bandClassName}
    data-place-band
  >
    <AnchorLink aria-label="Back to the place" className={linkClassName} href={`#${imaginedPlaceSectionId}`}>
      <Row row={bandRow(frame.rendering.projection)} />
    </AnchorLink>
  </Layer>
)

export const PlaceBand = () => {
  const shown = useAtomValue(placeBandAtom)
  const latest = Result.value(useAtomValue(placeShownFrameAtom))
  return (
    <Layer className={slotClassName}>
      <AnimatePresence>
        {shown
          ? Option.match(latest, {
            onNone: () => null,
            onSome: (frame) => <Band frame={frame} key="band" />
          })
          : null}
      </AnimatePresence>
    </Layer>
  )
}
