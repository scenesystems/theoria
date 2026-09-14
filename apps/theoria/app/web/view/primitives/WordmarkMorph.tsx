import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match, Schema } from "effect"
import * as Arr from "effect/Array"
import type { AnimationDefinition, Variants } from "motion/react"
import * as m from "motion/react-m"
import { memo } from "react"

import { motionPreferenceAtom } from "../../atoms/motion.js"
import { wordmarkPhaseAtom } from "../../atoms/wordmark.js"
import { introDelaySeconds, passSeconds, segmentPass, wordmarkMotion, WordmarkPhase } from "./wordmarkMorph.js"

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

/** Which face of the wordmark a layer shows: the Latin `en` or the Greek `gr`. */
const Face = Schema.Literal("en", "gr")
type Face = typeof Face.Type

/**
 * The variants one segment of one face animates between, built once: `rest`
 * is the Latin face alone; `pass` plays the segment's keyframes over the pass;
 * `intro` is the same pass after the cycle's lead hold.
 */
const segmentVariants = (face: Face, index: number): Variants => {
  const pass = segmentPass(index)
  const { atRest, keyframes } = Match.value(face).pipe(
    Match.when("en", () => ({ atRest: 1, keyframes: pass.latin })),
    Match.when("gr", () => ({ atRest: 0, keyframes: pass.greek })),
    Match.exhaustive
  )
  const opacity = Arr.copy(keyframes)
  const timing = { duration: passSeconds, ease: Arr.copy(pass.ease), times: Arr.copy(pass.times) }

  return {
    intro: { opacity, transition: { ...timing, delay: introDelaySeconds } },
    pass: { opacity, transition: timing },
    rest: { opacity: atRest }
  }
}

/** Each face's segments with the variants they animate between, built once. */
const LAYERS: Record<Face, ReadonlyArray<{ readonly text: string; readonly variants: Variants }>> = {
  en: Arr.map(SEGMENTS, (segment, index) => ({ text: segment.en, variants: segmentVariants("en", index) })),
  gr: Arr.map(SEGMENTS, (segment, index) => ({ text: segment.gr, variants: segmentVariants("gr", index) }))
}

/**
 * A single text layer rendered as a continuous text run.
 *
 * Because the segment `<span>`s stay in the inline formatting context, the
 * browser applies correct kerning and shaping across the entire run —
 * identical to plain "Theoria" or "θεωρία". The layer sits at
 * `col-start-1 row-start-1` so both layers stack in one grid cell. Each
 * segment follows the wordmark's phase through its own variants.
 */
const TextLayer = ({ face }: { readonly face: Face }) => (
  <span className="col-start-1 row-start-1">
    {LAYERS[face].map((segment, index) => (
      <m.span data-wordmark-face={face} key={index} variants={segment.variants}>
        {segment.text}
      </m.span>
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

const rootClassName = "inline-grid items-baseline text-ink-900"

/** A pass that was playing has ended; a `rest` completing is not a pass. */
const passEnded = (definition: AnimationDefinition): boolean =>
  Schema.is(WordmarkPhase)(definition) && definition !== "rest"

/**
 * The crossfading wordmark: its phase is the session's `wordmarkPhaseAtom`,
 * and the phase is the variant label every segment animates to. The pass is
 * keyframes Motion plays to completion, so nothing ticks while the wordmark
 * rests; a pointer meeting it asks for another pass (the header's home link
 * asks the same on focus), and a pass that finishes is told so.
 */
const AnimatedWordmark = () => {
  const phase = useAtomValue(wordmarkPhaseAtom)
  const tell = useAtomSet(wordmarkPhaseAtom)

  return (
    <m.span
      animate={phase}
      aria-hidden
      className={rootClassName}
      initial="rest"
      onAnimationComplete={(definition) => {
        if (passEnded(definition)) {
          tell("passEnded")
        }
      }}
      onPointerEnter={() => tell("replayAsked")}
    >
      <MeasureLayer />
      <TextLayer face="en" />
      <TextLayer face="gr" />
    </m.span>
  )
}

/**
 * Wordmark that crossfades per-character between "Theoria" and "θεωρία".
 *
 * Two complete text layers are stacked in a CSS grid cell. The crossfade
 * plays once as the session begins, rests on the Latin face, and plays again
 * when a reader meets it. Readers who prefer reduced motion see the Latin
 * wordmark at rest; the preference is `motionPreferenceAtom`'s, the page's
 * one source for it.
 *
 * @since 0.1.0
 */
export const WordmarkMorph = () => {
  const preference = useAtomValue(motionPreferenceAtom)

  return Match.value(wordmarkMotion(preference)).pipe(
    Match.when("still", () => (
      <span aria-hidden className={rootClassName}>
        <MeasureLayer />
        <span className="col-start-1 row-start-1">Theoria</span>
      </span>
    )),
    Match.when("crossfading", () => <AnimatedWordmark />),
    Match.exhaustive
  )
}
