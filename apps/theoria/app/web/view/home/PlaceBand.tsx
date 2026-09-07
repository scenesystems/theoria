import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import { ArrowUpIcon } from "@heroicons/react/20/solid"
import { Match, Option } from "effect"
import * as Arr from "effect/Array"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"

import { placeBandAtom, placeFeatureFocusedAtom } from "../../atoms/imagined-place-experience.js"
import { placeDiscDrawnAtom, type PlaceRenderFrame, placeShownFrameAtom } from "../../atoms/imagined-place-render.js"
import { type MotionPreference, motionPreferenceAtom } from "../../atoms/motion.js"
import { elevationClassName } from "../primitives/designSystem.js"
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
 * to the stage, and says so with an arrow up; the drawing itself says
 * nothing the stage does not.
 *
 * The band lives in the page's flow so the acts scroll under it as under a
 * header, and it ends with the demonstration. Its slot has no height: the
 * strip hangs below the slot's edge, so the band coming and going moves
 * nothing else on the page, and the stage — whose leaving the viewport the
 * band answers — stays where it was.
 */
const slotClassName = `${elevationClassName("band")} sticky top-0 h-0`

const bandClassName = "flex justify-center pt-3"

/**
 * The strip is a legend's height — one line of text — raised above the page
 * as the one thing there above it, and never wider than the page gives; the
 * row scales down to fit beside the arrow.
 */
const linkClassName =
  "inline-flex max-w-full items-center gap-2 rounded-full bg-stage-50 px-2.5 py-1.5 ring-1 ring-rule-strong shadow-surface outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

/**
 * How a disc takes its place in the row: sliding over as a merge shifts the
 * row, or — under reduced motion — placed outright where it now stands,
 * fading in and out alone. `cx` is not among the values Motion holds still
 * for reduced motion, so it is kept out of Motion's hands there and written
 * as the attribute it is.
 */
const placing = (preference: MotionPreference, cx: number) =>
  Match.value(preference).pipe(
    Match.when("full", () => ({ initial: { cx, opacity: 0 }, animate: { cx, opacity: 1 } })),
    Match.when("reduced", () => ({ cx: cx.toFixed(1), initial: departed, animate: { opacity: 1 } })),
    Match.exhaustive
  )

const Disc = ({ cy, disc }: { readonly cy: number; readonly disc: BandDisc }) => {
  const drawn = useAtomValue(placeDiscDrawnAtom(disc.marker.name))
  const focused = useAtomValue(placeFeatureFocusedAtom(disc.marker.name))
  const preference = useAtomValue(motionPreferenceAtom)
  return (
    <m.circle
      className={bandDiscClassName(markerContributor(disc.marker), drawn, focused)}
      cy={cy.toFixed(1)}
      data-place-band-disc={disc.marker.name}
      data-place-focused={focused ? "" : undefined}
      exit={{ opacity: 0, transition: exitTransition }}
      r={disc.marker.radius.toFixed(1)}
      {...placing(preference, disc.cx)}
    />
  )
}

/**
 * The row at a line's height, scaled by the browser from stage units: a
 * viewBox, not a measured transform. Discs are keyed by name, so a merge adds
 * one and the rest slide over; a disc leaving fades.
 */
const Row = ({ row }: { readonly row: BandRow }) => (
  <svg
    aria-hidden
    className="block h-5 w-auto min-w-0 max-w-full"
    data-place-band-drawing
    viewBox={`0 0 ${String(row.width)} ${String(row.height)}`}
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
      <ArrowUpIcon aria-hidden className="size-3.5 shrink-0 text-ink-500" data-place-band-icon />
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
