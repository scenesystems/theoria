import { motion, type MotionValue, useReducedMotion, useTime, useTransform } from "motion/react"
import { memo } from "react"

import { frameAt, segmentProgress } from "./wordmarkMorph.js"

/**
 * Semantic character units: 7 Latin chars → 6 Greek chars in 6 positions.
 *
 * Each entry maps a Latin segment to its Greek counterpart. The segments
 * are used to build inline `<span>` wrappers within two complete text
 * layers so that per-character opacity can be driven independently while
 * preserving natural kerning within each language's text run.
 */
const SEGMENTS: ReadonlyArray<{ readonly en: string; readonly gr: string }> = [
  { en: "Th", gr: "θ" },
  { en: "e", gr: "ε" },
  { en: "o", gr: "ω" },
  { en: "r", gr: "ρ" },
  { en: "i", gr: "ί" },
  { en: "a", gr: "α" }
]

type Face = "en" | "gr"

/** One character unit whose opacity follows the shared clock without re-rendering React. */
const Segment = ({
  face,
  index,
  text,
  time
}: {
  readonly face: Face
  readonly index: number
  readonly text: string
  readonly time: MotionValue<number>
}) => {
  const opacity = useTransform(time, (elapsedMs) => {
    const progress = segmentProgress(frameAt(elapsedMs), index)

    return face === "en" ? 1 - progress : progress
  })

  return <motion.span style={{ opacity }}>{text}</motion.span>
}

/**
 * A single text layer rendered as a continuous text run.
 *
 * Because the segment `<span>`s stay in the inline formatting context, the
 * browser applies correct kerning and shaping across the entire run —
 * identical to plain "Theoria" or "θεωρία". The layer sits at
 * `col-start-1 row-start-1` so both layers stack in one grid cell.
 */
const TextLayer = ({ face, time }: { readonly face: Face; readonly time: MotionValue<number> }) => (
  <span className="col-start-1 row-start-1">
    {SEGMENTS.map((segment, index) => (
      <Segment
        face={face}
        index={index}
        key={index}
        text={segment[face]}
        time={time}
      />
    ))}
  </span>
)

/**
 * Invisible measure layer that sizes the grid cell.
 *
 * Renders whichever text run is wider (in this case "Theoria" since Latin
 * glyphs at the same font-size are typically wider than their Greek
 * counterparts in Figtree). Both visible layers stack on top of this
 * sizing reference so the container never changes size.
 */
const MeasureLayer = memo(() => (
  <span aria-hidden className="col-start-1 row-start-1 invisible">
    Theoria
  </span>
))

const AnimatedWordmark = () => {
  const time = useTime()

  return (
    <>
      <TextLayer face="en" time={time} />
      <TextLayer face="gr" time={time} />
    </>
  )
}

/**
 * Animated wordmark — crossfades per-character between "Theoria" and "θεωρία".
 *
 * Two complete text layers are stacked in a CSS grid cell. Motion's shared
 * frame clock (`useTime`) drives each segment's opacity through
 * `segmentProgress`, so the crossfade runs at the display's refresh rate
 * without React re-rendering. Readers who prefer reduced motion see the
 * Latin wordmark at rest.
 *
 * @since 0.1.0
 */
export const WordmarkMorph = () => {
  const reducedMotion = useReducedMotion()

  return (
    <span aria-hidden className="inline-grid items-baseline text-ink-900">
      <MeasureLayer />
      {reducedMotion === true ? <span className="col-start-1 row-start-1">Theoria</span> : <AnimatedWordmark />}
    </span>
  )
}
